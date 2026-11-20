[[toc]]

## Capabilities

The WAV reader (`@epicurrents/wav-reader`) reads a RIFF/WAVE file as a biosignal recording. It has no modality or interface of its own: the [EMG module](docs/emg-module) uses it as its importer, so a WAV file opened from the `Electromyography` section of the `File` menu is displayed as an EMG recording.

A WAV file opened from the `Audio` section is a different path: it is played by the browser's own audio player, and this reader is not involved (see [Media module](docs/media-module)).

The reader is part of the `full` edition, through the EMG module.

| Property | Support |
|---|---|
| Container | RIFF/WAVE, little-endian |
| Sample format | 16-bit signed integer PCM |
| Channels | Any number, interleaved frame by frame |
| Chunks | `fmt ` (standard or extended), `data` and `fact`; any other chunk before `data` is skipped |
| Sources | A local file, or an HTTP URL that answers range requests |
| File type | `.wav` (`audio/wav`) |

**Only 16-bit samples are read.** A file of any other bit depth is refused when it is opened, with the depth named in the log, rather than read as 16-bit pairs. The format tag in the `fmt ` chunk is not checked, only the sample width.

A file whose header cannot be parsed, or which has no `data` chunk within the bytes read, is refused.

## What a recording contains

- **Channels** are labelled `Chan 1`, `Chan 2` and so on, since WAV stores no channel names.
- **Amplitude**: WAV stores no calibration, so each stored integer is read as one microvolt and the channel reports µV as its unit, unless the host gives the importer a [calibration](#calibration).
- **Duration** is the per-channel sample count over the sampling rate. The count comes from the `fact` chunk when there is one, and otherwise from the size of the `data` chunk.
- **Timing**: a WAV recording is one continuous span with no start time, annotations or interruptions. An interruption table supplied from outside is refused rather than applied.

## Worker

Samples are read inside a web worker when the page has `SharedArrayBuffer` and the host's memory manager setting allows it (`emg.useMemoryManager` in the EMG module). Otherwise `WavWorkerSubstitute` runs the same commission handlers on the main thread. The worker is inlined into the package build, so there is no bundle to deploy beside it; a host whose content security policy forbids `worker-src blob:` can serve the standalone bundle from `umd/wav.worker.js` and register a URL-based factory instead.

## Registering the reader

The reader is registered as the importer of a study module, with a worker override keyed by that module's modality:

```ts
import { WavImporter, WavWorkerSubstitute } from '@epicurrents/wav-reader'
import { EmgStudyLoader } from '@epicurrents/emg-module'

const importer = new WavImporter()
importer.setWorkerOverride('emg', () => useSAB ? wavWorker() : new WavWorkerSubstitute())
app.registerStudyImporter('emg/wav-file', 'Open WAV file', 'file', new EmgStudyLoader('EmgWavLoader', importer))
```

The full registration, with the folder and URL importers, is shown under [Registering the module](docs/emg-module#registering-the-module).

### Calibration

A host that knows what the acquisition device writes gives the importer the physical value of full scale:

```ts
const importer = new WavImporter({ calibration: { physicalMax: 5, physicalUnit: 'mV' } })
```

- **`physicalMax`** is the value a stored -32768 stands for, negated, so the example reads -32768 as -5 mV and 16384 as 2.5 mV. It must be a finite number above zero.
- **`physicalUnit`** names the unit of `physicalMax` and of every channel, and is `uV` when omitted. Samples are delivered in the base unit of a voltage unit (volts), as for every other reader; a unit the viewer does not recognise as a voltage is taken at face value.

The calibration applies to every file the importer opens after it is set. `importer.setCalibration(...)` changes it for the files that follow, and `setCalibration(null)` returns to one microvolt per integer; a recording already open keeps the scale it was opened with. The importer records the calibration in the study metadata as `calibration` and hands it to the reader's worker itself, so the study module needs no configuration of its own.

An invalid calibration is refused with an error in the log, and the importer then opens no file until a valid one is set, rather than opening it at the default scale.

| Export | Role |
|---|---|
| `WavImporter` | Recognises the file, reads its header and calibration into the study metadata and hands over the worker. |
| `WavWorkerSubstitute` | The worker's commission handlers, run on the main thread. |
