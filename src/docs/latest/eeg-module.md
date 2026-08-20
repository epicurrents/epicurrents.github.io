[[toc]]

## Overview

The default EEG module is designed for viewing normal-density EEG recordings based on the international 10-20-system. It has the following features out-of-the-box:
- Reconstructing EEG signals in the following 10-20 montages:
  * As recorded (with only 10-20 system EEG channels displayed).
  * Average reference (identical to "as recorded" if the source signals are average referenced).
  * Double banana (longitudinal bipolar).
  * Laplacian (source density).
  * Transverse bipolar.
  * Cz reference.
- Viewing select polygraphic channels (EKG, EMG, EOG, respiration) *if* they are correctly labeled in the source file.
- Optional polygraphic *cascade* view — N time-shifted slices of a single polygraphic channel stacked vertically, for at-a-glance scanning of long segments.
- Adjusting signal sensitivity for all channels or each channel individually.
- Adjusting signal filters (high-pass, low-pass and notch) for all channels or each channel individually.
- Adjusting signal colors based on signal type (polygraphic signals) or side of the body (for EEG signals).
- Viewing, editing and adding global and channel-specific annotations.
- Scalp voltage field topography at the cursor position, computed natively in the browser and drawn both as a flat map and on an anatomical head surface (see [analysis tools](docs/eeg-module/analysis-tools#voltage-field-topogram)).

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
- `default:10-20` — labelled *Default IFCN 25*: the 19 electrodes of the 10-20 system, the inferior chain (F9/F10, T9/T10, P9/P10), and the polygraphic channels the module recognises. Electrodes a recording does not carry go unmatched, so the same setup serves a plain 10-20 record and an extended one. The `name` still reads `default:10-20` — it keys `defaultMontages`, every montage identifier and every host that injects against it, so it is left alone until the setup is reworked properly.

**Default montages**, listed in `defaultMontages` and added to every recording:
- `rec` — As recorded: source channels only, no re-referencing
- `avg` — Average reference (active electrode included in the average)
- `lon` — Double banana (longitudinal bipolar)
- `trv` — Transverse bipolar

**Extra montages**, shipped with the module and added after the defaults:
- `cz-ref` — Cz reference
- `laplacian` — source density (small Laplacian)

These are textbook derivations any deployment might want. A montage that belongs to one deployment goes in that deployment's own configuration instead — see [Custom setups and montages](#custom-setups-and-montages) below.

The name in each list is the montage's own name, not its full identifier: a montage is registered as `<setup>:<name>` (`default:10-20:laplacian`), and the `eeg.defaultMontage` setting is matched against the trailing segment. Keying the setting by name rather than by position is deliberate — the set of montages available to a deployment changes, and a stored preference has to keep pointing at the same montage when it does. The default-montage dropdown in the settings view is built at render time from the default montages, the module's own extras and anything the host injected, so a montage added by either route appears there without a code change.

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

Injected montages are added to a recording before its channel layout is applied and before `eeg.defaultMontage` is resolved, so they behave like the built-in ones: they are laid out with the user's spacing settings, and one of them can be the deployment's default montage. (Cascade montages are the exception — they are added after the layout pass on purpose, because a cascade stacks N rows of a single channel and computes its own equidistant offsets that a group layout would overwrite.)

## Trend derivations

The [trend strip](docs/eeg-module/eeg-viewer#trend-strip) computes its values over derivations resolved against the recording's setup, and the defaults name 10-20 electrodes. A deployment with a different electrode array — a sub-hairline array, an intracranial grid — must declare its own, or the affected trends are silently skipped and the strip stays empty.

The aEEG, ratio and spectrogram trends each build one trend per entry in a derivation list, and pdBSI averages an index over a list of homologous electrode pairs. `aeeg.derivations` doubles as the fallback for the other two, so an array where all three read the same signal declares it once:

```ts
app.registerModule('eeg', eegRuntime, {
    aeeg: {
        derivations: [
            {
                id: 'left',
                label: 'Left',
                color: [0.20, 0.45, 0.85, 0.85],
                candidates: [
                    { source: 'C3', reference: 'P3' },
                    { source: 'C3', reference: '' },
                ],
            },
            // ... one entry per trend slot, conventionally one per hemisphere
        ],
    },
    // Optional: only when a trend should not share the aEEG derivations.
    ratio: {
        derivations: [ /* same shape as aeeg.derivations */ ],
    },
    spectrogram: {
        derivations: [ /* same shape as aeeg.derivations */ ],
    },
    pdbsi: {
        pairs: [
            { left: 'Fp1', right: 'Fp2' },
            { left: 'F7', right: 'F8' },
        ],
    },
    trends: {
        pdbsi: { epochLength: 2, band: [1, 4] },
    },
})
```

- `candidates` are tried in order and the first one that resolves wins, so a list can cover several electrode arrays at once. Each entry resolves by three strategies in turn: an empty `reference` matches the named channel on its own; otherwise a single channel named like the pair (`'c3-p3'`) is tried, then the two electrodes individually with the subtraction applied at compute time.
- Splitting `ratio` or `spectrogram` off is worth it where the trends want different signals. aEEG measures amplitude, so it wants the widest bipolar span the array offers, while a band-ratio index computed against a common average reference is usually taken from a single electrode (an empty `reference`).
- `pairs` whose left or right electrode is missing from the setup are skipped individually. A partially-resolving list computes the index over the pairs that did resolve, so an incomplete list is a silent narrowing rather than an error — declare every pair the array actually carries.
- `trends` holds the per-type math knobs (epoch length, frequency bands, referencing). It merges per trend type over the defaults, so naming one knob leaves the rest of that type's defaults in place.

## Scalp topography

The [voltage field topogram](docs/eeg-module/analysis-tools#voltage-field-topogram) is computed in the module itself. Nothing about it needs the Pyodide service, and a frame costs one matrix-vector product and a colour ramp, which is what lets the map follow the cursor directly instead of trailing it behind a debounce.

Two independent paths back the two views:

- **`EegTopogram`** builds a spherical-spline interpolation operator at runtime, for any electrode set, from a bundled position table covering the 10-20, 10-10 and 10-05 systems. The operator depends only on the electrode positions, so it is built once per montage and reused for every frame. Positions are matched case-insensitively and the pre-1991 temporal names (T3/T4/T5/T6) resolve to their modern equivalents.
- **`EegSurfaceFieldMap`** evaluates `field = mapping @ data` against a matrix computed offline against an anatomical scalp mesh. That matrix is a pseudo-inverse over a whole channel set, so columns cannot be dropped to serve a subset: a map serves exactly the electrode array it was baked for. Two are bundled — the classic 19-electrode 10-20 array and the IFCN standardised array, which adds F9/F10, T9/T10 and P9/P10 — and `EegSurfaceFieldMap.forLabels` picks the richest one a recording can feed, matching electrodes by resolved position rather than by name.

The two views therefore disagree slightly on purpose: one interpolates over a sphere fitted to the electrodes, the other onto an averaged anatomical scalp. Both are seeded from the same sphere origin and share a colour ramp and contour formula, so a feature that moves in one moves correspondingly in the other, but the anatomy shifts maxima by a few millimetres relative to the sphere and spreads the surrounding field differently.

Both paths agree with MNE-Python's own interpolation to about `1e-7` relative on identical input, which the tooling in the package's `tools/topography/` verifies against MNE directly rather than against a stored fixture. Baking a map for a new electrode array is done with the same tooling; its README covers the procedure and the pitfalls.

Adding a surface map is worth it only for arrays that recur across recordings. A dense array is better served by the 2D view, which builds its operator at runtime for any montage — a baked map costs roughly `vertices × channels × 4` bytes in the bundle, which is around 230 KiB for 19 channels and would approach 700 KiB for a full 10-10 array.

> **Third-party material:** the baked assets are not original work of this project. The mapping matrices are computed with MNE-Python (BSD-3-Clause), and the mesh is a modified version of the FreeSurfer fsaverage head surface, under a licence that is not OSI-approved and that requires its text to accompany copies. The package ships `NOTICE` and `licenses/` with the terms, and each generated asset repeats its own provenance internally. Anything that redistributes a built application carries the mesh, and these conditions, with it.

## Cascade montages

A *cascade montage* is a special-purpose view that takes one source channel and renders it as N vertically stacked rows. Each row covers a fixed `pageLength` seconds, so the visible reach across the whole stack is `rowCount * pageLength` and a page-turn advances by the full reach — successive screens do not overlap. The intended use case is fast visual scanning of a single polygraphic signal (EKG, breathing, EMG, EOG) where the user would otherwise have to page through dozens of regular pages to cover the same duration.

Cascade montages are registered against a setup (the same way as regular montages) and ship as part of the EEG module configuration:

```ts
app.registerModule('eeg', eegRuntime, {
    cascadeMontages: {
        'standard-1020': [
            {
                id: 'ekg',
                label: 'EKG cascade',
                candidates: ['EKG', 'ECG', 'EKG1'],
                rowCount: 15,
                pageLength: 10,
                sensitivity: 100,
                highpass: 0.5,
                lowpass: 40,
                notch: 50,
            },
        ],
    },
})
```

Per-entry fields:
- `id` — stable identifier; the resulting montage's name is `cascade:<id>`.
- `label` — display name shown in the montage selector.
- `candidates` — source channel labels tried in priority order against the keyed setup. The first label that matches a channel name in that setup wins. An entry whose candidates do not resolve is silently skipped.
- `rowCount` — number of stacked rows (typical scanning ranges from 10 to 15).
- `pageLength` — seconds displayed per row. Becomes the montage's own `pageLength` while it is active.
- `sensitivity`, `highpass`, `lowpass`, `notch` — optional initial display state. Cascade montages own their own state independently from the recording's regular montages: changes the user makes while a cascade is active land on the cascade, and the regular montage settings are preserved and reapplied on switch.

The cascade configuration mirrors the `extraMontages` shape (setup name → list of entries) so the same configuration file or inline object covers both.

## Annotation event filtering

EDF+ files often contain annotation labels that are specific to the recording system — internal event markers, status codes, or vendor-specific strings that are not meaningful to the end user. The EEG module supports two configuration options to handle these before they reach the UI:

**`ignorePatterns`** — a list of regular expressions. Any annotation label matching one of these patterns is silently discarded. Useful for suppressing recording-system internal events.

**`convertPatterns`** — a list of `{ pattern, properties }` rules. Any annotation label matching `pattern` is not discarded but instead has its properties remapped according to `properties` (e.g. renaming the label, changing the display colour). Useful for normalising vendor-specific event codes into standard clinical terminology.

Both are set via the EEG module settings object and take effect on every recording loaded while those settings are active.
