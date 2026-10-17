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

The EEG module matches source channels to the positions of the active setup by label, case-insensitively. Each setup channel takes the first source channel its pattern matches that no earlier setup channel has taken. A source channel no setup channel matches is not displayed.

An electrode label is read as an optional prefix, the electrode name, and an optional reference:

- **Prefix** — `EEG`, with or without a separator (`EEG Fp1`, `EEG_Fp1`, `EEGFp1`), or one of the generic input prefixes `POL` and `ECG`. Some systems put these on every polygraphic input, including spare inputs carrying extra electrodes, so `POL T9` and `ECG T9` are read as T9. A prefix naming another modality (`EMG F7`, `EOG Fp1`) is not read as an electrode.
- **Electrode** — the whole token, so FT9 is never read as T9, F10 as F1 or FCz as Cz. Trailing primes and a `+` polarity mark are allowed (`EEG Fp1'`, `Fp1+`). The pre-1991 temporal names T3/T4/T5/T6 are read as T7/T8/P7/P8.
- **Reference** — anything after a `-` (`Fp1-Ref`, `Fp1-A1`). It is never read as an electrode of its own, so `Fp1-Cz` is not matched as Cz.

Polygraphic channels are matched by the same prefix rules, with the modality named either as the prefix or as the channel name itself (`ECG EOG+` is an EOG channel):

| Label | Recognised as |
|---|---|
| `ECG`, `EKG`, `ECG1`, `ECG II`, a bare lead name (`II`), or a stored bipolar pair (`ECG L-ECG R`, `ECG1-ECG2`) | Cardiac, single channel |
| `ECG L` / `ECG R`, `ECGL` / `ECGR`, `EKG Left` / `EKG Right` | Cardiac electrodes, from which the montages derive a bipolar trace free of the EEG reference |
| `EOG` | Eye movement, single channel |
| `LOC` / `ROC`, `E1` / `E2`, `EOG L` / `EOG R`, `EOGL` / `EOGR` | Left and right eye, from which the montages derive a bipolar trace |
| `EMG…`, `Chin`, `Submental`, `Musc…` | Electromyography |
| `Resp…`, `Chest`, `Thorax`, `Abdomen`, `Airflow`, `Flow`, `Nasal` | Respiration |
| `Photic`, `Flash`, `Strobe`, including `EEG Photic-Ref` | Photic stimulation |
| `EDF Annotations` | Annotation channel (never displayed as a signal) |

Polygraphic channels are displayed in the viewer when their type is supported, with colours distinct from the EEG channels.
