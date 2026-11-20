[[toc]]

## Overview

The PSG module (`@epicurrents/psg-module`) adds polysomnography support: continuous EDF/BDF sleep studies. It builds on the [EEG module](docs/eeg-module) rather than beside it, since a sleep study is an EEG recording with more channels than electrodes, and it carries no file-format code of its own; the [EDF reader](docs/edf-reader) decodes the bytes.

A study keeps the `eeg` modality, which is what routes it to the EEG viewer, reader worker and settings. It therefore opens in the [EEG viewer](docs/eeg-module/eeg-viewer) with filters, navigation and annotations working as they do for an EEG, and the sleep-specific parts are added on top: an electrode setup and montages built from the channels the study has, per-channel display settings for the polygraphic signals, the `epicurrents.psg` scoring vocabulary and a hypnogram.

| Export | Role |
|---|---|
| `PsgStudyLoader` | Builds a `PsgRecording` from a loaded study, and refuses one whose timeline is interrupted. |
| `PsgRecording` | The resource. Extends `EegRecording`, replacing its electrode setup and montages with ones built from the study's channels, and exposes the study's `hypnogram`. |
| `PsgEvent` | Annotations, carrying the `epicurrents.psg` scoring vocabulary stacked on the EEG and shared sets. |
| `Hypnogram` | The stage of every scoring epoch, read from the study's events, and the sleep measures derived from them. |
| `buildSetup`, `buildMontage`, `canonicalLabel`, `channelRole` | How a stored channel label becomes a setup channel, a role group and a modality, against the setup in `PSG_SETUP_CONFIG`. |

## Registering the module

The module adds no interface module of its own, so the EEG module must be registered as well. A study is claimed for the `eeg` modality, the reader worker it is decoded by, and the importer wraps an EDF importer in a `PsgStudyLoader`:

```ts
import { EdfExporter, EdfImporter } from '@epicurrents/edf-reader'
import { PsgStudyLoader } from '@epicurrents/psg-module'

const edfLoader = new EdfImporter()
const psgLoader = new PsgStudyLoader('PsgEdfLoader', ['eeg'], edfLoader, new EdfExporter())
app.registerStudyImporter('psg/edf-file', 'Open polysomnography (EDF)', 'file', psgLoader)
app.registerStudyImporter('psg/edf-url', 'Open polysomnography from URL', 'url', psgLoader)
```

The builder carries a registrar for the `psg` modality (`setup/modules/psg.ts`) that does this, and an edition activates it by listing `psg` beside `eeg` in its `activeModules`. The package is not published, so no public edition includes it; an edition that does is a local profile, built by someone with access to the package's repository.

A polysomnography must be a continuous recording. `PsgStudyLoader` puts a study with interruptions (EDF+D) into the `error` state, the same rule the platform applies at ingest.

## Setup

What a study's channels are is described in `config/defaults/psg/setup.json`, laid out like the EEG module's setups, with the montages beside it in `montages/`. The setup is still built per study when it opens (`buildSetup`), against the channels the study actually has: a study records no fixed set of channels, and each of them gets one exact label pattern so a stored derivation such as `C4-M1` is not read as the electrode `C4`.

The setup file holds:

- **Roles**, in display order: the groups channels are shown in, each with the modality its channels are drawn as, a label pattern, a channel order and default display settings. The shipped roles are EEG, EOG, chin EMG, limb EMG, other EMG, ECG, respiration, oximetry and other. The last role has no pattern and takes every label no other role does, so an unknown channel is shown rather than dropped.
- **Channel types**: channels known by name, each under the platform's stored name, with a pattern of the other names files give it (`Saturation` for `SpO2`), an optional role and default display settings.
- **Electrodes** that files name otherwise, such as the AASM eye electrodes `E1` and `E2` read as `LOC` and `ROC`.
- **The recording's default filters** (`defaultFilters`), 0.3–35 Hz for EEG and EOG.

Patterns are matched against the whole label, ignoring case. A label is matched against the channel types first, then against the roles in order.

## Montages

Every study gets three montages, built from definitions independent of any study (`buildMontage`, listed in `PSG_MONTAGES`):

| Montage | Shows |
|---|---|
| As recorded | Every channel, one group per role, all the same height. |
| Sleep staging | F3-M2, F4-M1, C3-M2, C4-M1, O1-M2 and O2-M1, then the other roles, with room for EEG and EOG. |
| Respiratory events | C3-M2 and C4-M1, for arousals, then the other roles, with room for respiration and oximetry. |

These replace the EEG module's 10-20 default montages. Wait on `montagesReady` rather than counting montages (see [Built-in setups and montages](docs/eeg-module#built-in-setups-and-montages)).

A definition is a list of groups, each with a `height` and channels:

```json
{
    "name": "staging",
    "label": "Sleep staging",
    "description": ["…"],
    "groups": [
        { "height": 1, "channels": [{ "active": "C4", "reference": ["M1"] }] },
        { "height": 0.5, "role": "chin" }
    ]
}
```

- **A named channel** gives the stored label of a channel or electrode as `active`, and optionally `reference`, `label`, `modality` and display settings. With one reference it is read from the study's stored derivation of that name when there is one, and otherwise derived from the two channels, so the same montage serves a study that stored derivations and one that stored electrodes. A channel the study cannot supply either way is kept as missing.
- **A role** adds the study's channels of that role in its order, except those a named channel of the montage already reads from.
- **Anything no group names is left out**, and a group left with no channels is dropped with its height.

A group's `height` becomes the template's `groupHeights` (see [Group heights and per-channel display](docs/eeg-module#group-heights-and-per-channel-display)). It gives the group's channels more or less room; it does not scale the traces.

## Channel display

A channel is drawn either by **sensitivity** (per cm, around its isoelectric line, independent of the viewer's sensitivity control) or by **range** (`displayRange`, the values at the bottom and top of its band), and may have **filters** of its own that replace the recording's. A montage definition sets them on a named channel; the setup's roles and channel types set them for every montage. A role's default gives way to the channel type's, and both to a montage definition.

Values are given in the channel's `unit` and converted when a study records the channel in another unit of the same quantity (`cmH2O`, `mbar`, `Pa`, `kPa` and `mmHg` agree, as do `uV` and `mV`). A channel recorded in units of different quantities can be given a value per unit (`"sensitivity": { "uV": 50, "cmH2O": 0.05 }`). A unit that cannot be converted leaves the channel at the viewer's sensitivity and logs a warning.

Some of the shipped defaults:

| Channel | Default |
|---|---|
| ECG | 0.5–40 Hz, 1000 µV/cm, positive up |
| Chin, leg and arm EMG | 1–40 Hz |
| Airflow and effort | 0.1–10 Hz |
| Nasal pressure | 0.1 cmH2O/cm |
| SpO2 | Range 50–100 % |
| Heart and pulse rate | Range 40–120 bpm |
| EtCO2 and TcCO2 | Range 5–15 kPa |

The recording's own filters reach only EEG and EOG (and the notch, ECG), which is why every other band is set per channel. The full table and the rules for combining defaults are in the package README.

## Scoring and the hypnogram

The `epicurrents.psg` vocabulary covers sleep stages, arousals, respiratory events and limb movements. It extends HED-SCORE: a term takes the SCORE tag as its name where SCORE has one and carries it as a `hed` crosswalk. Annotations are `PsgEvent`s, carrying this vocabulary on top of the EEG and shared sets (see [Annotations](docs/annotations)).

A sleep stage is a coded event rather than a free-text label, so it survives de-identification. An event covers every 30-second epoch that starts inside it, so a scorer's per-epoch stage and a file's long stage annotation read the same way.

`PsgRecording.hypnogram` builds a `Hypnogram` from the recording's events as they stand: `stages` holds the stage of every epoch (`null` for unscored), and where two stage events cover an epoch the later one decides. `summary()` returns the sleep measures over the span from the first scored epoch to the last:

| Property | Type | Description |
|---|---|---|
| `timeInBed` | `number` | Minutes from the first scored epoch to the last. |
| `totalSleepTime` | `number` | Minutes of all sleep stages together. |
| `stageMinutes` | `Record<SleepStage, number>` | Minutes spent in each of `W`, `N1`, `N2`, `N3` and `REM`. |
| `sleepEfficiency` | `number \| null` | Total sleep time over time in bed, 0 to 1. |
| `sleepOnsetLatency` | `number \| null` | Minutes from the first scored epoch to sleep onset. |
| `remLatency` | `number \| null` | Minutes from sleep onset to the first REM epoch. |
| `wakeAfterSleepOnset` | `number \| null` | Minutes awake between sleep onset and the last sleep epoch. |

A measure that needs sleep is `null` when there was none, rather than zero.

## Limits

- Trends read the live signal cache, so on a recording under the rolling cache a whole-night trend covers only what has been loaded.
- A trace drawn against a range is not clipped to its band: a value outside the range is drawn past the band's edge, over its neighbours.
- A channel label the setup's channel types and roles do not know gets no default display, and nothing reports it: the channel is shown in the last role at the viewer's sensitivity. A site's or vendor's spellings are added to the setup's patterns.
