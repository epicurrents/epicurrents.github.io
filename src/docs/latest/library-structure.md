[[toc]]

## Package overview

Epicurrents is structured as a pseudo-monorepo. Each package is independently versioned and published to npm under the `@epicurrents` namespace. You install only what you need.

### Core

| Package | npm | Description |
|---|---|---|
| `core` | `@epicurrents/core` | Shared abstractions, runtime state manager, base classes for assets, resources, modules, services, readers, and workers. Everything else depends on this. |

### File readers

File readers parse a specific binary format into a structured signal representation. They each run a dedicated web worker and expose a study importer that the application registers by name.

| Package | npm | Formats |
|---|---|---|
| `edf-reader` | `@epicurrents/edf-reader` | EDF, EDF+C, EDF+D, BDF, BDF+ (European/BioSemi data formats) |
| `dicom-reader` | `@epicurrents/dicom-reader` | DICOM neurophysiology (WG-32: routine EEG) |
| `wav-reader` | `@epicurrents/wav-reader` | WAV audio |
| `htm-reader` | `@epicurrents/htm-reader` | HTM |
| `pdf-reader` | `@epicurrents/pdf-reader` | PDF documents |
| `api-reader` | `@epicurrents/api-reader` | Remote API URL import |

### Study modules

A study module handles the display and interaction for one modality. It contributes Vue components (viewer, controls, footer), Vuex actions, and settings. Modules are registered with the application before launch.

| Package | npm | Modality |
|---|---|---|
| `eeg-module` | `@epicurrents/eeg-module` | EEG — signal display, montages, annotations, analysis tools |
| `emg-module` | `@epicurrents/emg-module` | EMG — electromyography |
| `ncs-module` | `@epicurrents/ncs-module` | NCS — nerve conduction studies |
| `doc-module` | `@epicurrents/doc-module` | Document viewing |
| `tab-module` | `@epicurrents/tab-module` | Tabular data |

### Services

Services extend the application with capabilities that run in a separate web worker. They are optional — the application works without them.

| Package | npm | Description |
|---|---|---|
| `pyodide-service` | `@epicurrents/pyodide-service` | Python-in-browser via [Pyodide](https://pyodide.org). Unlocks spectral analysis, source localisation, and other scipy/MNE-based tools. |
| `onnx-service` | `@epicurrents/onnx-service` | ONNX model inference for ML-assisted annotation. |

### Interface

| Package | npm | Description |
|---|---|---|
| `interface` | `@epicurrents/interface` | Default Vue 3 viewer application. Assembles all the above into a ready-to-use UI. Can be used as a standalone app or embedded inside a larger page. |

### Utility packages

These are standalone utility libraries with no dependency on the core runtime.

| Package | Description |
|---|---|
| `asymmetric-io-mutex` | `SharedArrayBuffer`-based mutex designed for asymmetric I/O: one writer (format worker) and one reader (montage worker). Used by the memory manager for zero-copy signal transfer. |
| `scoped-event-bus` | Typed event bus with scoped events (event name + asset ID + phase). Wraps a standard `EventTarget`. |
| `scoped-event-log` | Global application log with per-scope entries and severity levels. |

## Core concepts

| Concept | Class / Interface | Description |
|---|---|---|
| Application | `Epicurrents` / `EpicurrentsApp` | Entry point. Manages the runtime, event bus, memory manager, and registered modules. |
| Runtime | `RuntimeStateManager` | Central state store: `APP`, `MODULES`, `SERVICES`, `SETTINGS`, `WORKERS`, `INTERFACE` maps. Mutation-event pattern — every setter dispatches scoped events. |
| Asset | `BaseAsset` | Root type for everything in the system — has `id`, `name`, `modality`, `state`, and an event API. |
| Resource | `DataResource` | A loadable asset with a lifecycle: `added → loading → loaded → ready → destroyed`. |
| Module | `ResourceModule` / `RuntimeResourceModule` | Pluggable modality support registered with `registerModule(name, module)`. Contributes Vue components and Vuex actions at runtime via `hotUpdate()`. |
| Service | `GenericService` / `AssetService` | Web worker abstraction. Every method call creates a commission (UUID-keyed Promise) and posts a message to the worker; the worker replies with the same UUID to resolve it. |
| Study loader | `GenericStudyLoader` / `StudyLoader` | Knows how to take a parsed file header and produce a typed `DataResource` (e.g. `EegRecording`). |
| Study importer | `GenericStudyImporter` | Parses a file header and produces a `StudyContext`. The entry point for "open file". |
| Interface | `InterfaceModule` | Vue UI shell. Receives the `EpicurrentsApp` and `RuntimeStateManager` at `launch()`. |
| Dataset | `MixedMediaDataset` / `MediaDataset` | Container for a set of resources that have been opened together. |
| Event bus | `EventBus` | Application-wide typed event dispatch, exposed as `window.__EPICURRENTS__.EVENT_BUS`. |

## Signal data flow

Signal data travels along two paths depending on whether cross-origin isolation (and therefore `SharedArrayBuffer`) is available.

### Path A — Memory manager (SharedArrayBuffer)

When `SharedArrayBuffer` is available the memory manager allocates a single large SAB and carves it into per-channel typed-array views. This allows the format worker to write raw samples and the montage worker to read them without copying.

```
Format worker (e.g. EDF)
  → BiosignalMutex writes raw Float32 samples into SharedArrayBuffer
  → MutexExportProperties transferred to montage worker
MontageWorker.setupInputMutex()
  → MontageProcessor reads raw samples directly from SAB
  → Applies derivation + filtering → output Float32Array[]
  → Posted back to main thread
```

### Path B — JS heap (fallback)

When `SharedArrayBuffer` is not available, signal data is copied through the JS heap.

```
Format worker (e.g. EDF)
  → BiosignalCache (SignalCachePart, main thread JS heap)
  → Cache reference passed to montage worker
MontageWorker.setInputCache()
  → MontageProcessor reads from cache copy
  → Applies derivation + filtering → output Float32Array[]
  → Posted back to main thread
```

The same `MontageProcessor` handles both paths. `GenericBiosignalResource` holds both `_mutexProps` (SAB) and `_cacheProps` (heap), and whichever is non-null is used.

## Reader pattern

All `*-reader` packages follow the same pattern:

1. **Importer** (e.g. `EdfImporter`) — parses the file header, creates a `StudyContext`, and provides a format worker constructor. This is the entry point registered with `app.registerStudyImporter()`.
2. **Reader** (e.g. `EdfReader`) — runs *inside* the format worker. Handles progressive background loading of signal data records and on-demand range fetches.
3. **Decoder** (e.g. `EdfDecoder`) — converts raw binary bytes to `Float32Array` typed arrays.
4. **Worker** (e.g. `edf.worker.ts`) — receives commission messages (`setup-worker`, `cache-signals`, `get-signals`) and delegates to the reader.
5. **Worker substitute** — runs the same reader code synchronously on the main thread as a fallback when web workers are not available.

## Module pattern

All `*-module` packages follow the same pattern:

1. **Recording** (e.g. `EegRecording`) — extends `GenericBiosignalResource`. The top-level resource added to a `Dataset`. Holds setups and montages.
2. **Setup** (e.g. `EegSetup`) — maps raw file channels to named electrode positions. There can be multiple setups per recording (e.g. 10-20, 10-10).
3. **Montage** (e.g. `EegMontage`) — defines derived channels (active minus reference), filter settings, and display options. There can be multiple montages per setup.
4. **Source channel** (e.g. `EegSourceChannel`) — one physical channel as recorded in the file.
5. **Montage channel** (e.g. `EegMontageChannel`) — one display channel derived from source channels.
6. **Service** (e.g. `EegService`) — commissions the format worker for signal data.
7. **Study loader** (e.g. `EegStudyLoader`) — creates the `EegRecording` from a parsed study.

## Service pattern

All `*-service` packages follow the same pattern:

1. **Service** (main thread, e.g. `PyodideService`) — extends `GenericService`. Each method call creates a UUID-keyed Promise, posts a message to the worker, and returns the promise.
2. **Worker** (e.g. `pyodide.worker.ts`) — receives messages, processes them, replies with the same UUID.
3. **Worker substitute** — same logic without a worker, for environments that do not support workers.

Commission/promise pattern used throughout:

```ts
// Main thread
const { promise } = _commissionWorker('get-signals', { start: 0, end: 10 })
const signals = await promise

// Worker
onmessage = ({ data }) => {
    const result = processAction(data)
    postMessage({ uuid: data.uuid, result })
}
```

## Annotations

For a full treatment of annotations — labels vs events, properties, coded annotations, locking, creation, and export — see the dedicated [Annotations](docs/annotations) page. The section on event classes and the configurable `GenericBiosignalEvent.PRIORITY` defaults is also covered there.
