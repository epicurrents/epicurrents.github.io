[[toc]]

## Capabilities

The EDF ([European Data Format](https://edfplus.info)) reader handles all common variants of the format:

| Format | Description |
|---|---|
| **EDF** | Standard integer-sample EDF. All signal channels, no annotations. |
| **EDF+C** | EDF with embedded annotations (continuous recording). TAL records are parsed for events and interruption markers. |
| **EDF+D** | EDF with data gaps (discontinuous recording). Gap positions are tracked precisely so displayed timestamps remain correct across interruptions. |
| **BDF** | BioSemi 24-bit variant. Same structure as EDF, but samples are 24-bit integers rather than 16-bit. Used by active electrode EEG systems (BioSemi, g.tec, etc.). |
| **BDF+** | BioSemi 24-bit with embedded annotations and optional discontinuities. |

EDF+ and BDF+ annotation channels (TALs — time-stamped annotation lists) are parsed inline during signal decoding. The annotation text and onset times are extracted and forwarded to the study module as `BiosignalEvent` objects.

## Worker architecture

Parsing and signal I/O run inside a dedicated web worker (`edf.worker.ts`). This keeps the main thread responsive during file loading and progressive background caching.

The worker holds a single `EdfReader` instance for the lifetime of the study. Communication follows the commission/promise pattern used throughout the library: the main thread posts a message with a unique commission ID and awaits a reply with the same ID.

Worker actions:

| Action | Description |
|---|---|
| `setup-worker` | Parse EDF/BDF header, store file URL or `File` reference |
| `setup-cache` | Allocate a `BiosignalMutex` (SharedArrayBuffer path) or `BiosignalCache` (heap fallback) |
| `cache-signals` | Progressively read and store all data records in the background |
| `get-signals` | Fetch a specific time range on demand (used before background cache reaches that range) |
| `release-cache` | Free the SAB or heap allocation |
| `shutdown` | Terminate the worker |
| `update-settings` | Apply new settings (e.g. changed display scale) |

An `EdfWorkerSubstitute` runs the same code synchronously on the main thread as a fallback for environments where web workers are not available.

## Progressive loading

The reader does not load the entire file upfront. After setup, `cache-signals` begins reading data records progressively from the start, yielding between chunks so the worker thread stays responsive. Progress is reported back to the main thread via update callbacks, which update `signalCacheStatus` on the resource. The UI uses this to show a loading indicator.

If `get-signals` is called for a range not yet cached (e.g. the user jumps to the end of a long recording), the reader fetches only the requested records immediately via an HTTP `Range: bytes=…` request or `File.slice()`, returning them while background caching continues.

## Discontinuous recordings

In EDF+D files the recording has explicit gaps where no signal data was collected. The reader computes gap positions during header parsing and stores them as *interruptions*. Signal data is stored in *data time* (gap-exclusive): a gap of 30 seconds does not occupy 30 seconds of cache space. When signals are returned to the caller, gap periods are filled with zeros and the correct wall-clock timestamps are applied.

## Digital-to-physical conversion

Each EDF channel header specifies a digital range (`dMin`/`dMax`) and a corresponding physical range (`pMin`/`pMax`). The decoder converts raw 16-bit (or 24-bit BDF) integers to floating-point physical values using:

```
physical = (digital − dMin) × (pMax − pMin) / (dMax − dMin) + pMin
```

This conversion is applied in `EdfDecoder.decodeData()`, which returns `Float32Array` typed arrays ready for display.

## Limitations

- **Multi-segment files**: very large files recorded in multiple segments are supported but each segment must be a valid EDF/BDF file.
- **Video-EEG**: linked video channels are not yet decoded; the signal channels are displayed normally.
- **Encryption**: no support for encrypted EDF variants.
- **Very high channel counts**: files with hundreds of channels (e.g. high-density EEG > 256 channels) work correctly but may require more memory than is available in the fallback JS-heap path. Use the SharedArrayBuffer path for large channel counts.
