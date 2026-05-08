[[toc]]

## EDF and BDF

The EEG module works with any file reader that returns compatible biosignal data. Currently the [EDF reader](docs/edf-reader) is the primary reader for EEG recordings. All of the following variants are supported:

| Format | Typical source | Notes |
|---|---|---|
| **EDF** | Most EEG systems | Standard 16-bit integer samples |
| **EDF+C** | EEG systems with annotation support | Continuous recording with embedded TAL annotations |
| **EDF+D** | EEG systems with pause/resume | Discontinuous recording; data gaps are tracked and displayed correctly |
| **BDF** | BioSemi Active Two and similar | 24-bit integer samples; used by active electrode systems |
| **BDF+** | BioSemi with annotations | 24-bit with TAL annotations and optional discontinuities |

## Annotation handling

EDF+ and BDF+ files may contain an annotation channel (the EDF+ TAL channel) with time-stamped clinical notes, event markers, and gap boundaries. These are parsed by the EDF reader during loading and handed to the EEG module as `BiosignalEvent` objects, which appear as vertical markers in the EEG navigator and annotation sidebar.

The platform's ingest pipeline strips annotation text from the stored file by default (replacing it with null-byte padding while keeping the channel intact so the file remains spec-compliant). The original text is extracted and saved to the database before stripping. Per-recording opt-out is available at upload time.

## DICOM

The [DICOM reader](docs/dicom-reader) can also provide EEG data when the recording is stored in the DICOM neurophysiology format (WG-32 standard). Single-file routine EEG is supported. DICOM recordings are handled by the same EEG module after import.

## Channel recognition

The EEG module matches source channels to electrode positions using a configurable setup. Channels are matched by label against the setup's channel name patterns (case-insensitive, supporting common variants like `EEG Fp1`, `Fp1-Ref`, etc.).

Channels that are not matched to any electrode position in the active setup are treated as polygraphic channels. The module checks for common polygraphic labels and classifies them automatically:

| Label pattern | Recognised type |
|---|---|
| `EKG`, `ECG` | Cardiac |
| `EMG` | Electromyography |
| `EOG` | Eye movement |
| `Resp`, `Airflow` | Respiration |
| `EDF Annotations` | Annotation channel (never displayed as a signal) |

Polygraphic channels are displayed in the viewer when their type is supported, with colours distinct from the EEG channels.
