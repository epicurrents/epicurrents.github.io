[[toc]]

## Overview

Epicurrents moves multi-channel signal data between three logical contexts on every frame:

1. The **format worker** (e.g. EDF reader) that decodes raw file bytes into typed `Float32Array` samples.
2. The **montage worker** that applies channel derivations and filters to produce displayable traces.
3. The **main thread** that pushes the result into the WebGL renderer.

Copying the full signal across each boundary on every read is expensive — a 32-channel EEG at 256 Hz with a 10-second view window is over a megabyte per frame, and at 60 fps that becomes a hot copy loop. Epicurrents handles this through one of two paths, picked automatically at launch based on what the host environment supports.

| Path | When it's used | How signals travel between threads |
|---|---|---|
| [Path A — SharedArrayBuffer](#path-a-sharedarraybuffer) | `useSAB: true` **and** cross-origin isolation is active **and** `SharedArrayBuffer` is supported by the browser | Single SAB shared between all workers; the format worker writes, the montage worker reads, no copies |
| [Path B — JS heap fallback](#path-b-js-heap-fallback) | `useSAB: false`, or cross-origin isolation is not configured | Signal records are passed between workers as transferable `ArrayBuffer`s on every cache update |

Both paths use the same `MontageProcessor` for the actual signal math, so the only thing that changes is how the raw samples reach it.

## Requirements for the SharedArrayBuffer path

`SharedArrayBuffer` is only available to a page that is **cross-origin isolated**. The page must be served with these HTTP headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

The browser exposes `window.crossOriginIsolated === true` only when both are present. Without isolation `SharedArrayBuffer` is `undefined`, and the library transparently falls back to Path B. No client-side code changes are needed to handle the fallback.

Configure the application with `useSAB: true` to opt into the SAB path when isolation is available:

```ts
const app = new Epicurrents({
    containerId: 'viewer',
    useSAB: true,
    signalCacheMaxSize: 1000,   // MB
})
```

`signalCacheMaxSize` controls the single SAB pool size used by the memory manager. The default is 1000 MB. Each open recording requests a slice of this pool sized to its full signal length in float32 samples. When `signalCacheMaxSize` is too small for the active recording, the load fails with an out-of-memory error rather than silently falling back.

## Path A — SharedArrayBuffer

### The memory manager

`ServiceMemoryManager` ([source](https://github.com/epicurrents/core/blob/main/src/assets/service/ServiceMemoryManager.ts)) is created during `app.launch()` if `useSAB` is on. It allocates one large `SharedArrayBuffer` (`signalCacheMaxSize` MB) and acts as a sub-allocator:

- Each service that opens a recording calls `allocate(amount, service)` to reserve a contiguous byte range inside the pool.
- The first 32 bits of the pool are reserved as a global master lock so allocations and frees are mutually exclusive across threads.
- When a service finishes (recording closed, resource destroyed), `freeMemory(service)` releases its range and the manager can rearrange remaining allocations to keep free space contiguous.

The same SAB is then passed by reference (via `postMessage` with the buffer in the transfer list) to every worker that needs to touch the recording's samples, so each worker sees the same underlying memory.

### `BiosignalMutex` — the per-recording locking discipline

`BiosignalMutex` ([source](https://github.com/epicurrents/core/blob/main/src/assets/biosignal/service/BiosignalMutex.ts)) wraps the recording's slice of the SAB with an asymmetric reader/writer protocol from the [`asymmetric-io-mutex`](https://www.npmjs.com/package/asymmetric-io-mutex) package. The mutex is designed for one writer (the format worker) and one or more readers (the montage worker, and any service that needs to peek at samples, such as the Pyodide service).

Inside the recording's range the mutex carves out per-channel sub-arrays. Each channel's view is laid out as:

```
[sampling_rate, updated_start, updated_end, <signal samples ...>]
   index 0         index 1        index 2          index 3 onward
```

- `sampling_rate` — the channel's sample rate (Hz)
- `updated_start` / `updated_end` — the lowest and highest sample indices that have been fully written by the format worker. The reader uses these to know which range is safe to consume.
- `signal samples` — the raw `float32` samples in data-time (gap-exclusive: a 30-second EDF+D interruption does not consume 30 seconds of buffer space)

A reader that wants samples `[s, e)` must check `updated_start <= s` and `updated_end >= e` before reading. If the requested range has not been fully written yet, the reader either waits, returns a partial result, or signals "not ready". This is the only synchronisation needed — the writer never moves `updated_end` backwards, so any range that satisfies the check is stable.

### `MutexExportProperties`

To give another worker access to the same mutex, the owning service exports a `MutexExportProperties` object describing the SAB, the byte offsets of each channel's view, and the field layout. The receiving worker reconstructs typed-array views over the shared buffer at those offsets. No data is copied.

```ts
// Format worker side
const props: MutexExportProperties = mutex.exportProperties()
postMessage({ action: 'setup-input-mutex', props })

// Montage worker side
const mutex = new BiosignalMutex(/* ... */).importProperties(props)
const inputViews: Float32Array[] = mutex.inputSignalViews
```

The same export is also sent to the Pyodide service when Python-side processing is enabled — see [Pyodide and the SAB](docs/pyodide-service#sab-input-and-the-slice-refresh-model) on the Pyodide page.

### Signal data flow

```
Format worker (e.g. EDF)
  → BiosignalMutex writes raw float32 samples into the SAB
  → MutexExportProperties posted to other workers

Montage worker
  → Imports the mutex, reads samples directly from the SAB
  → MontageProcessor.getSignals(range) computes derivation + filtering
  → Result Float32Array[] posted back to main thread
```

The montage worker's read path never crosses a copy boundary until the final `postMessage` of the per-frame result, which is intentionally already filter-applied and downsampled — only the displayed-channel × visible-samples slice is copied.

## Path B — JS heap fallback

When `SharedArrayBuffer` is unavailable, `BiosignalCache` is used instead. It holds a single `SignalCachePart`:

```ts
type SignalCachePart = {
    start: number
    end: number
    signals: {
        data: Float32Array
        samplingRate: number
    }[]
}
```

A cache instance lives on the main thread. The format worker decodes records on its own thread and transfers each completed range as a `Float32Array` back to the main thread, which appends or merges it into the cache (`combineSignalParts`). The montage worker is then handed a reference to that cache.

There is no locking — `BiosignalCache` is single-threaded by design. The format worker and the cache communicate via standard `postMessage` with transferable buffers, so even though each record transfer is a "copy" from the worker's perspective, it is a zero-copy ownership transfer of the underlying `ArrayBuffer`. The cost compared to Path A shows up on the montage worker side: when the montage worker needs samples, the main thread has to forward a copy of the relevant cache slice to it.

## How the resource decides

`GenericBiosignalResource` holds two properties:

- `_mutexProps: MutexExportProperties | null` — the SAB path's exported handle, populated when the memory manager allocates a slice
- `_cacheProps: BiosignalCache | null` — the JS-heap fallback, populated when no memory manager is available

`get dataCache()` returns whichever is non-null. Downstream code (`MontageService.setupWorker`, the Pyodide service's `setInputMutex`) inspects which it received and wires the corresponding setup commission to the montage worker.

Falling back to Path B is automatic. The resource lifecycle (`added → loading → loaded → ready`) is identical on both paths. The user-visible difference is only performance.

## Sizing and tuning

`signalCacheMaxSize` (configured at `Epicurrents` construction time) is the total SAB pool size in megabytes. As a rule of thumb:

```
required MB ≈ (channels × sampling_rate × duration_seconds × 4) / (1024 × 1024)
```

For a 32-channel routine EEG at 256 Hz, 1 hour of data needs `(32 × 256 × 3600 × 4) / 1024^2 ≈ 113 MB`. The default of 1000 MB comfortably holds many recordings open simultaneously. Long intensive-monitoring recordings (multi-day, high channel count, high sample rate) may need to raise this.

The pool is allocated once at launch. If browser memory is tight when the pool size is set very high, the `SharedArrayBuffer` constructor throws and Epicurrents falls back to Path B even when isolation is available. Watch the log for `Failed to allocate a shared array buffer for memory management.`

## Cross-thread visibility caveats

`SharedArrayBuffer` provides shared memory but **not** automatic synchronisation. Cross-thread reads of an unsynchronised float can return torn samples. The `BiosignalMutex` discipline of bounding reads by `updated_start` / `updated_end` is the synchronisation: as long as the reader only consumes samples within that range, the writer guarantees those samples are stable.

When wiring a new reader against the mutex, always check both bounds before reading. If you only check `updated_end`, you can miss the case where the writer is still backfilling earlier samples after a seek.

## Recording activation lifecycle

Each recording goes through a lifecycle — `added → loading → loaded → ready` — and can be activated and deactivated multiple times during a session (for example, when the user switches between open recordings). The cache infrastructure must be cleanly reset between activations so that a freshly allocated SAB slice is fully populated from the file, rather than silently returning the zero-filled buffer from the previous allocation.

### The two-level design

Currently `GenericBiosignalResource` has two teardown levels:

| Level | Method | What it frees |
|---|---|---|
| Partial | `releaseCache()` | SAB allocation returned to the memory manager; typed array views nulled; in-progress caching processes stopped |
| Full | `destroy()` | Everything: events, interruptions, montages, channel list, subscriptions |

`releaseCache()` is called when a recording is deactivated so its SAB slice can be reused; `destroy()` is called when the recording object itself is discarded.

### Cross-activation state leaks

The most common source of bugs at this layer is **cross-activation state** — fields that belong logically to one SAB occupancy session but live on the recording object and are not reset when the buffer is freed. If any such field survives `releaseCache()`, the next activation can misread it and skip caching, leaving the buffer permanently empty.

Three categories to watch:

- **Caching-process bookkeeping** — anything that tracks which ranges are "already cached" must be cleared when the SAB is freed; otherwise the new, zero-filled buffer is considered fully loaded.
- **`signalCacheStatus`** — the `[start, end]` progress indicator must be reset to `[0, 0]` synchronously as part of teardown, before any macro tasks that could deliver stale progress updates from the old session.
- **ACTIVATE listener phase** — `GenericAsset.isActive` dispatches an ACTIVATE event for *both* the `'before'` and `'after'` phases. Any subclass that performs setup work (requesting memory, wiring the mutex, starting caching) inside an ACTIVATE listener **must** guard with `if (!this._isActive) return` at the top of the handler. Without the guard the setup runs in the `'before'` phase when `_isActive` is still `false`, and the `'after'` phase sees an already-initialised resource and skips caching.

### Planned improvement: three-level lifecycle

The two-level design conflates releasing the SAB byte range (which should preserve the mutex field definitions for a cheap re-wire on next activation) with tearing down the mutex object entirely (needed only when the channel layout changes). A planned three-level split would make this explicit:

| Level | What it does |
|---|---|
| `releaseSignalArrays()` | Free the SAB range; null the typed array views; reset caching state. The `BiosignalMutex` object survives, retaining its field-definition knowledge so re-activation needs only a cheap `reinitialize(newBuffer, bufferStart)` call and a lightweight `reinitialize-input-buffer` commission to each montage worker. |
| `unloadCache()` | Level 1 + null the mutex entirely. Use when the channel layout changes between activations or when switching cache backends. |
| `destroy()` | Full recording teardown, unchanged. |

The main benefit of Level 1 is that `signalCacheStatus` is reset **synchronously** as part of the teardown rather than at the end of `releaseBuffers()`, eliminating the macro-task race that could restore a stale non-zero value before the next activation begins.

## Related concepts

- [Pyodide service](docs/pyodide-service) — how the Python-side reader handles SAB input under Pyodide's WASM memory constraints
- [Library structure — Signal data flow](docs/library-structure#signal-data-flow) — the high-level data-flow summary
- [Implementation — Cross-origin isolation](docs/implementation#cross-origin-isolation-and-sharedarraybuffer) — deployment-side header configuration
- [EDF reader — Worker architecture](docs/edf-reader#worker-architecture) — concrete example of a format worker writing to the mutex
