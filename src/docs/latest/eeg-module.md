[[toc]]

## Overview

The default EEG module is designed for viewing normal-density EEG recordings based on the international 10-20-system. It has the following features out-of-the-box:
- Reconstructing EEG signals in the following 10-20 montages:
  * As recorded (with only 10-20 system EEG channels displayed).
  * Average reference (identical to "as recorded" if the source signals are average referenced).
  * Double banana (longitudinal bipolar).
  * Laplacian (source density).
  * Transverse bipolar.
- Viewing select polygraphic channels (EKG, EMG, EOG, respiration) *if* they are correctly labeled in the source file.
- Adjusting signal sensitivity for all channels or each channel individually.
- Adjusting signal filters (high-pass, low-pass and notch) for all channels or each channel individually.
- Adjusting signal colors based on signal type (polygraphic signals) or side of the body (for EEG signals).
- Viewing, editing and adding global and channel-specific annotations.

## Configuration

### Basic settings

Before browsing EEG recordings, it may be necessary to check that some basic settings are correct. You can find these from the `Settings > User preferences` menu. It is recommendable to at least verify that [the signal scaling setting](docs/user-interface/settings#signal-scaling) is correct.

### Module settings

EEG module settings can be found under the `EEG` tab on the settings screen.

#### Display settings

Display options affect the general look of EEG signals. Options include:

**Invert EEG trace polarity**
- `On`: Signals are displayed with smaller voltage values towards the top of the viewport and larger values towards the bottom the of the viewport (i.e. negative up, positive down). This is the default by general convention.
- `Off`: Signals are displayed with larger voltage values towards the top of the viewport and smaller values towards the bottom of the viewport (i.e. positive up, negative down).

**Apply antialiasing to traces**
- `On`: Traces are drawn using the browser's WebGL antialiasing. Due to technical limitations the traces can only be drawn at 1px thickness. Antialiasing can improve perceived contrast between the trace and background on high-density displays.
- `Off`: Traces are drawn without antialising applied (default).

#### Color options and presets

Color of the three main signal modalities (EEG, EKG and EOG) can be set individually. For EEG, separate colors can be applied to signals on the right hemisphere, left hemisphere and midline.

Color presets have preconfigured options for commonly used signal color configurations.

#### Grid options

The EEG viewer supports individual display of a number of grid lines. For the time axis, there are `major` grid lines displayed every 1 second and `minor` grid lines for every 0.2 seconds (or 5 per second). For the voltage axis there is an `isoelectric` line displayed at zero voltage level of each channel. In addition to hiding or displaying these lines, both the thickness and color of each line can be configured.

## Recording, setup, and montage hierarchy

Understanding how the EEG module organises signal data helps when configuring custom electrode setups or deploying the module programmatically.

```
EegRecording
  ├── EegSetup[]            one or more electrode position maps
  │     └── SetupChannel[]  source channels mapped to electrode positions
  └── EegMontage[]          one or more display derivations
        └── EegMontageChannel[]  active minus reference arithmetic per channel
```

**Recording** — the top-level resource. Contains the raw signal data as recorded in the file and holds all setups and montages.

**Setup** — maps the raw file channels to named electrode positions (e.g. 10-20 system). A setup defines which physical channels exist and how they relate to standard electrode names. When a setup is applied to a recording, each file channel label is matched against the setup's channel name patterns. Multiple setups can be registered (e.g. one for 10-20, one for 10-10) and switched at runtime.

**Montage** — defines the displayed derivation. Each montage channel has an *active* electrode and an optional *reference* (or list of references for average reference). The montage worker computes `active − reference` arithmetic, applies filtering, and returns the derived signals. Multiple montages can be registered per setup (e.g. double banana, average reference, Laplacian).

Setting an active montage automatically stops signal caching from the previous montage, updates filters in the worker, and triggers a redraw.

## Built-in setups and montages

The following are included out of the box and loaded automatically when a recording is opened:

**Setups:**
- `standard-1020` — standard 10-20 system (19 electrodes + Cz reference)
- `standard-1010` — extended 10-10 system (64 electrodes)

**Montages (per setup):**
- `as-recorded` — source channels only, no re-referencing
- `average` — common average reference
- `longitudinal` — double banana (longitudinal bipolar)
- `laplacian` — source density (small Laplacian)
- `transverse` — transverse bipolar

## Custom setups and montages

Deployment-specific electrode layouts and montage definitions can be injected via the module configuration. They are applied to every recording that is opened, without modifying core module code.

**Inline configuration** (when registering the module programmatically):

```ts
app.registerModule('eeg', eegRuntime, {
    extraSetups: [
        { name: 'my-clinic-cap', channels: [ /* channel definitions */ ] }
    ],
    extraMontages: {
        'standard-1020': [
            { name: 'cz-reference', label: 'Cz ref', /* ... */ },
            '/montages/laplacian-extended.json',  // URL to a JSON file
        ],
    },
})
```

**From a configuration file** (when loading from a URL or embedded JSON in the platform): the `applyConfiguration` method on the EEG runtime processes a `EegModuleConfiguration` object, fetching any URL-referenced montage or setup files on demand.

## Annotation event filtering

EDF+ files often contain annotation labels that are specific to the recording system — internal event markers, status codes, or vendor-specific strings that are not meaningful to the end user. The EEG module supports two configuration options to handle these before they reach the UI:

**`ignorePatterns`** — a list of regular expressions. Any annotation label matching one of these patterns is silently discarded. Useful for suppressing recording-system internal events.

**`convertPatterns`** — a list of `{ pattern, properties }` rules. Any annotation label matching `pattern` is not discarded but instead has its properties remapped according to `properties` (e.g. renaming the label, changing the display colour). Useful for normalising vendor-specific event codes into standard clinical terminology.

Both are set via the EEG module settings object and take effect on every recording loaded while those settings are active.
