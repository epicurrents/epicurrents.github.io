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

Most of those commissions are not EDF's own. `EdfWorker` extends `SignalReaderWorker` from `@epicurrents/core`, which answers everything a signal reader answers alike, and adds what the format needs of its own:

| Action | Answered by | Description |
|---|---|---|
| `setup-worker` | `EdfWorker` | Parse EDF/BDF header, store file URL or `File` reference |
| `setup-cache` | shared | Allocate a `BiosignalMutex` (SharedArrayBuffer path) or `BiosignalCache` (heap fallback) |
| `cache-signals` | shared | Progressively read and store all data records in the background |
| `get-signals` | shared | Fetch a specific time range on demand (used before background cache reaches that range) |
| `request-signals` | shared | Fetch a range through the view-anchored protocol, positioning a rolling window over it first |
| `set-interruptions` | shared | Replace the interruption table from external metadata |
| `set-buffer-range` | shared | Move the reader's views after the memory manager rearranges the shared buffer |
| `set-signal-polarity` | shared | Invert the sign of a recording exported with a reversed phase |
| `release-signal-arrays` | shared | Drop the signal views but keep the cache layout for re-activation |
| `release-cache` | shared | Free the SAB or heap allocation |
| `reset-network` | `EdfWorker` | Clear the per-origin breakers after re-authentication |
| `shutdown` | shared | Terminate the worker |
| `update-settings` | shared | Apply new settings (e.g. changed display scale) |

EDF also reports the annotations and interruptions it discovers while decoding, which ride along with the `get-signals` reply.

An `EdfWorkerSubstitute` drives the same `EdfReader` on the main thread as a fallback for environments where web workers are not available — a page that is not cross-origin isolated, and so has no `SharedArrayBuffer`, is the common case. It answers asynchronously like the worker, through a dispatch of its own, and answers fewer commissions.

## Progressive loading

The reader does not load the entire file upfront. After setup, `cache-signals` begins reading data records progressively from the start, yielding between chunks so the worker thread stays responsive. Progress is reported back to the main thread via update callbacks, which update `signalCacheStatus` on the resource. The UI uses this to show a loading indicator.

If `get-signals` is called for a range not yet cached (e.g. the user jumps to the end of a long recording), the reader fetches only the requested records immediately via an HTTP `Range: bytes=…` request or `File.slice()`, returning them while background caching continues.

## Discontinuous recordings

In EDF+D files the recording has explicit gaps where no signal data was collected. The header says only that the file is discontinuous; where the gaps fall is in the data records, because every EDF+ record opens with a timekeeping annotation stating its own start in recording time. A record that starts later than its position in the file would put it has a gap before it as long as the difference, and the reader stores that as an *interruption*. Signal data is stored in *data time* (gap-exclusive): a gap of 30 seconds does not occupy 30 seconds of cache space. When signals are returned to the caller, gap periods are filled with zeros and the correct wall-clock timestamps are applied.

## Digital-to-physical conversion

Each EDF channel header specifies a digital range (`dMin`/`dMax`) and a corresponding physical range (`pMin`/`pMax`). The decoder converts raw 16-bit (or 24-bit BDF) integers to floating-point physical values using the precomputed form of the specification's conversion, rather than recomputing the range ratio for every sample:

```
unitsPerBit  = (pMax − pMin) / (dMax − dMin)
digitalOffset = pMax / unitsPerBit − dMax
physical      = unitsPerBit × (digital + digitalOffset) × scale
```

The last factor is the one worth knowing: `scale` normalises the channel's own unit to the SI base unit, so a channel recorded in microvolts is decoded and cached in **volts**. Every reader in the library follows that convention, and the unit each channel reports stays as the file wrote it, because that is what a consumer displays the signal against.

A channel whose digital range has no width has no conversion to offer — the division would yield infinity and every sample would decode as `NaN` — so a header declaring one is refused rather than read.

This conversion is applied in `EdfDecoder.decodeData()`, which returns `Float32Array` typed arrays ready for display.

## Exporting

`EdfExporter` writes a recording as an EDF file with a JSON metadata sidecar. It reads the decoded resource rather than the source file, so it exports a recording from any reader. Pass it as the fourth argument of the module's study loader and register the loader as an exporter:

```ts
import { EdfExporter } from '@epicurrents/edf-reader'

const exporter = new EdfExporter()
const loader = new EegStudyLoader('EegEdfLoader', ['eeg'], new EdfImporter(), exporter)
app.registerStudyExporter('eeg/edf-export', 'Export as de-identified EDF', 'file', loader)
```

The viewer's file menu then opens the export dialog, and `exporter.exportActiveResource(options)` returns `{ edf, sidecar, fileName }` for a host that runs the export itself.

| Option | Type | Description |
|---|---|---|
| `deidentify` | `boolean` | Blank the subject identifiers in the header and remove event and label text. Defaults to `true`. |
| `deidentifySidecar` | `boolean` | De-identify the sidecar as well. Defaults to `false`, so the sidecar keeps the original metadata. |
| `dither` | `boolean` | Add noise of under one digital step to each sample before it is rounded, from a cryptographic source, so that the same recording never exports to the same bytes. This stops an export from being found by re-encoding a copy of the original and comparing bytes or hashes; it does not stop correlating the signal with the original. A destination that identifies a file by its hash should hand the sender a receipt, since a second export will not reproduce it. Defaults to `false`. |
| `embedFooter` | `boolean` | Carry the sidecar as a footer inside the EDF file, marked in the header's reserved field, so the recording travels as one file. The footer is de-identified whenever the file is. |
| `removeMetadataKeys` | `string[]` | Leave every property with one of these names out of the sidecar and the footer, at any depth. De-identification blanks `subject` and empties event and label `text`; this removes the keys themselves, for a destination that refuses them. |
| `selection` | `SignalExportSelection` | Reduce the recording before encoding: a time range, an ordered set of channels under output labels, one output rate and an amplitude range. |

A selection is applied with core's `applyExportSelection`. The range is in recording time; an end that falls inside an interruption moves to the edge of the data. Events and interruptions are clipped to the range and moved to start from its beginning, and an event keeps only the channels the selection keeps (an event left with none is dropped). Downsampling uses an anti-aliasing low-pass, and a downsampled channel's recorded low-pass is lowered to match. The output rate must be a whole number of hertz, since the file is written in one-second records, and the file holds whole records only.

## Limitations

- **Multi-segment files**: very large files recorded in multiple segments are supported but each segment must be a valid EDF/BDF file.
- **Video-EEG**: linked video channels are not yet decoded; the signal channels are displayed normally.
- **Encryption**: no support for encrypted EDF variants.
- **Very high channel counts**: files with hundreds of channels (e.g. high-density EEG > 256 channels) work correctly but may require more memory than is available in the fallback JS-heap path. Use the SharedArrayBuffer path for large channel counts.
