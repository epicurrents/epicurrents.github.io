[[toc]]

## Capabilities

The Pyodide service (`@epicurrents/pyodide-service`) embeds a full Python interpreter inside the browser via [Pyodide](https://pyodide.org), and exposes it to the rest of the application as a regular Epicurrents service. Once registered, any module or interface component can submit Python code to it for execution and receive the result asynchronously.

This unlocks analysis routines that rely on scientific libraries which have no comparable JavaScript equivalent — primarily `numpy`, `scipy`, `matplotlib`, and `mne`. The built-in EEG module uses it for:

- Welch's-method power spectral density (PSD)
- Voltage topomaps and propagation series
- Distributed and dipole source localisation (sLORETA, eLORETA, dSPM, MNE, MUSIC)
- Bandpass / highpass / lowpass / notch filtering of derived signals

You can also load arbitrary Python scripts at runtime to run your own algorithms — see [Writing custom scripts](#writing-custom-scripts).

The service is **optional**. If it is not registered, the application falls back to JavaScript-side filtering and analysis features that depend on Python are simply not available.

## Worker architecture

Pyodide runs inside a dedicated web worker (`pyodide.worker.ts`). Communication uses the same commission/promise pattern as the rest of the library — every method call on `PyodideService` generates a UUID-keyed message that the worker replies to with the same UUID.

The first commission after registration is `setup-worker`, which:

1. Loads `pyodide.js` from a CDN (or a local path you provide).
2. Initialises the WASM runtime.
3. Loads the default packages (`numpy`, `scipy`) plus any extras supplied via `config.packages`.
4. Resolves once the interpreter is ready to accept code.

```ts
import { PyodideService } from '@epicurrents/pyodide-service'

app.registerService('pyodide', new PyodideService())

const pyodide = app.runtime.SERVICES.get('pyodide') as PythonInterpreterService
await pyodide.setupWorker({
    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/',
    packages: ['matplotlib', 'mne'],
})
```

Setup typically takes 3–10 seconds on a warm cache and longer on cold load. The `initialSetup` promise resolves once setup is complete; callers can `await` it before submitting code.

## Script loading lifecycle

Most useful Python code is too long to embed as a string in every call. Instead, scripts are registered by name and only re-executed when their content changes:

```ts
import myAnalysis from './my-analysis.py?raw'

await pyodide.runScript('my-analysis', myAnalysis, {
    threshold: 0.5,
})
```

Each named script has a state in `_scripts`:

| State | Meaning |
|---|---|
| `not_loaded` | Not yet sent to the worker |
| `loading` | Commission sent, awaiting the worker's reply |
| `loaded` | Executed successfully — subsequent calls with the same name are idempotent |
| `error` | Execution failed |

A script that is already `loaded` returns immediately without re-executing. A script in `loading` state is awaited. Re-running a modified version of the same script requires using a different name or calling `runCode()` directly.

`loadDefaultScript('biosignal')` loads the built-in `biosignal.py` module that ships with the package. It is loaded automatically the first time `setInputMutex()` is called for a recording.

## The JS↔Python bridge

`runCode(code, context)` is the lowest-level primitive. Every key in `context` is temporarily bound onto Pyodide's global scope, the code runs, then the bindings are removed:

```ts
const result = await pyodide.runCode(
    `
from js import data, fs
import numpy as np
arr = np.frombuffer(data, dtype=np.float32)
{'mean': float(arr.mean()), 'fs': float(fs)}
    `,
    {
        data: someTypedArray,
        fs: 256,
    },
)
console.log(result.result)   // { mean: 0.0034, fs: 256 }
```

Inside the Python code, `from js import data, fs` makes the JS-side context values accessible. The return value of the last expression is converted to a JS object via `.toJs({ dict_converter: Object.fromEntries, create_proxies: false })` and travels back through the commission reply.

For long-running or stateful work, prefer `runScript()` so the script's function definitions remain available for subsequent `runCode()` calls without re-executing the module body.

## The built-in `biosignal.py` module

The package ships with `biosignal.py`, a Python module pre-loaded into Pyodide that handles montage-side signal processing. It exposes a set of functions that the JS side calls via `runCode()`:

| Function | Purpose |
|---|---|
| `biosignal_set_buffers()` | Registers the SAB-backed `Float32Array` views as the source-channel input (called by the service when a recording's mutex is wired in) |
| `biosignal_get_signals(channels)` | Computes the requested montage channels (derivation + filtering) from the input, refreshing only the slice it needs |
| `biosignal_refresh_channels(specs)` | Batched preload primitive for callers that read many small windows from the same channels |
| `biosignal_set_default_filters()` | Configures the default Butterworth filter cutoffs |
| `biosignal_set_filter()` | Configures a single filter (highpass / lowpass / notch) |
| `biosignal_add_montage()` / `biosignal_set_montage()` | Register and activate named montages |
| `biosignal_calculate_signals()` | Computes channels and writes the result back into a JS-side output buffer |

### SAB input and the slice-refresh model

The service receives raw samples through the [SharedArrayBuffer](docs/memory-management#path-a-sharedarraybuffer) memory manager, via the same `MutexExportProperties` handle used by the montage worker. However Pyodide cannot alias an external `SharedArrayBuffer` directly into Python-visible memory: both `JsBuffer.to_py()` and `JsBuffer.to_memoryview()` materialise a *snapshot* at the moment of conversion. Every read into a Python `numpy` array is a copy.

To minimise the cost, `biosignal.py` uses **lazy allocation** plus **on-demand slice refresh**:

- After `biosignal_set_buffers()` the Python-side input arrays are `None`. A full-channel-sized `numpy.zeros` is allocated only when a compute step first touches the channel. Channels never touched (e.g. the 30 channels a single-derivation trend doesn't read) never allocate.
- Before any read, `biosignal_get_signals()` calls an internal helper `_refresh_channel_range(idx, start, end)` that copies the channel's metadata header plus the requested data range from the live SAB into the channel's numpy array via `buf.subarray(start, end).assign_to(target[start:end])`. The header (`sampling_rate`, `updated_start`, `updated_end`) is always refreshed so the load-status check sees live values.
- A per-call `(idx, start, end)` set deduplicates the copy when many montage channels share an active or reference at the same range (e.g. common average reference).

Per-frame bandwidth is therefore `O(window + header)` instead of `O(full channel)`. Consumers writing their own scripts that read signal data through `_biosignal['input']` should use `biosignal_refresh_channels(specs)` to preload the channels and ranges they need before iterating.

### `biosignal_refresh_channels` — the batched preload

For workloads that read the same channel(s) repeatedly across many small windows, a single bulk preload is cheaper than many slice refreshes inside the inner loop (each `subarray.assign_to` crosses the JS↔WASM boundary). Two common cases:

- **Trend computation** (e.g. spectrogram trend) — one derivation, scanned across hundreds of epochs covering the full recording. Preload the full range of the referenced channels once, then iterate epochs entirely in Python.
- **Source-localization epoch extraction** — many channels read in small windows at scattered event timestamps. Preload one window covering all channels per event.

```ts
// Preload everything the trend will read before entering the epoch loop
await pyodide.runCode(
    'biosignal_refresh_channels()',
    {
        specs: [
            [activeChannelIdx, 0, fullChannelLength],
            [referenceChannelIdx, 0, fullChannelLength],
        ],
    },
)
// Inside the loop, biosignal_get_signals' internal dedup means no redundant copies
```

`specs` is a list of `[channel_idx, start, end]` triples. `start` may be less than the data offset and `end` may exceed the channel length — both are clamped to valid SAB bounds, and out-of-bounds positions retain zeros from lazy allocation (callers handle their own padding).

When the JS heap [fallback path](docs/memory-management#path-b-js-heap-fallback) is active (no `SharedArrayBuffer`), the Pyodide service is not wired up to montage-side signal data and the slice-refresh model does not apply.

## Built-in analysis scripts

The EEG module bundles several ready-to-use scripts that consume the `biosignal.py` input arrays:

| Script | Module | Purpose |
|---|---|---|
| `psd.py` | `interface/src/app/modules/eeg/scripts/` | Welch's method PSD and squared FFT coefficients |
| `topomap.py` | `interface/src/app/modules/eeg/scripts/` | Voltage topomap rendering via MNE + matplotlib, including a 3×3 propagation series grid |
| `eeg_source_localize.py` | `eeg-module/src/pyodide/scripts/` | Distributed and dipole source localisation (sLORETA, eLORETA, dSPM, MNE, MUSIC). Requires a pre-computed lead field matrix supplied from the server. |
| `eeg_filter_signal.py` | `eeg-module/src/pyodide/scripts/` | One-shot Butterworth filter application for arbitrary signal arrays |
| `eeg_load_topomap.py` | `eeg-module/src/pyodide/scripts/` | Setup helper for the topomap script |

The source localisation script is intentionally designed so that the heavy `mne.make_forward_solution()` computation (which requires compiled MNE-C code that does not run in Pyodide) happens server-side via the platform's `compute` app, while the inverse computation and all visualisation run entirely in the browser.

## Rendering matplotlib to a canvas

Plotting scripts render matplotlib figures directly onto a JavaScript canvas via `putImageData`, which avoids the cost of base64-encoding an image and decoding it back. The pattern is:

```python
from matplotlib.backends.backend_agg import FigureCanvasAgg
from js import ImageData, Uint8ClampedArray

def draw_to_canvas(fig, canvas):
    agg = FigureCanvasAgg(fig)
    agg.draw()
    w, h = agg.get_width_height()
    rgba = np.frombuffer(agg.buffer_rgba(), dtype=np.uint8)
    canvas.width = w
    canvas.height = h
    ctx = canvas.getContext('2d')
    img = ImageData.new(Uint8ClampedArray.new(rgba.tobytes()), w, h)
    ctx.putImageData(img, 0, 0)
```

Both `HTMLCanvasElement` and `OffscreenCanvas` work — the latter is useful when the analysis runs entirely off the main thread.

## Writing custom scripts

To add a new analysis routine:

1. Write a `.py` file that defines top-level functions reading inputs via `from js import …` and returning a JSON-serialisable result.
2. Import the script as a raw string in your TypeScript code (`?raw` query) and register it with `pyodide.runScript()`.
3. Call individual functions via `pyodide.runCode()` with the function name and any per-call arguments in the context.

```python
# my_analysis.py
import numpy as np

def detect_spikes(threshold=3.0):
    from js import signal, fs
    arr = np.frombuffer(signal, dtype=np.float32)
    z = (arr - arr.mean()) / (arr.std() + 1e-12)
    above = np.where(z > float(threshold))[0]
    return {'count': int(len(above)), 'positions_s': (above / float(fs)).tolist()}
```

```ts
import script from './my_analysis.py?raw'

await pyodide.runScript('my-analysis', script)

const { result } = await pyodide.runCode(
    'detect_spikes(threshold=float(threshold))',
    { signal: signalArray, fs: 256, threshold: 3.5 },
)
console.log(result.count, result.positions_s)
```

A script that needs persistent state across calls (e.g. precomputed coefficients, cached montages) can store it in a module-level dict and read from it in subsequent function calls — see `_biosignal` in `biosignal.py` for the pattern.

## Limitations

- **No compiled MNE-C code** — Pyodide is a WASM build of CPython and does not include any Python-C extensions that rely on dynamically loaded shared libraries beyond what is precompiled to WASM. `mne.make_forward_solution` and a few other compiled MNE routines are not available; for source localisation this is worked around by computing the lead field server-side.
- **No threading** — Pyodide is single-threaded. A script that needs to wait for data cannot block; instead it must return a "not ready" result and the caller must retry once the data is available. See the `updated_start`/`updated_end` check in `biosignal_get_signals` for the canonical handling.
- **External `SharedArrayBuffer` is not zero-copy on the Python side** — every refresh of input samples copies bytes from the SAB to a Python-owned `numpy` array. The slice-refresh design described above keeps each copy small, but it is still a copy. A future Pyodide release that allows aliasing external SABs into wasm-visible memory would remove this cost; until then, treat the input arrays as a cached mirror that must be refreshed on demand.
- **Cold-start time** — the worker takes several seconds to initialise on first load, and additional time to download any packages beyond `numpy`/`scipy`. Call `pyodide.setupWorker()` early (during `app.launch()`) so the interpreter is warm by the time the user requests an analysis.

## Related concepts

- [Memory management](docs/memory-management) — the `SharedArrayBuffer` memory manager and `BiosignalMutex` discipline that supply the Python side's input
- [EEG module — Analysis tools](docs/eeg-module/analysis-tools) — PSD, topomaps, and other features that use the Pyodide service
- [Implementation — App lifecycle](docs/implementation#app-lifecycle) — where `registerService` fits in the startup sequence
