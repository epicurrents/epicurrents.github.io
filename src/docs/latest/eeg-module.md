[[toc]]

## Overview

The default EEG module is designed for viewing normal-density EEG recordings based on the international 10-20-system. It has the following features out-of-the-box:
- Reconstructing EEG signals in the following 10-20 montages:
  * As recorded (with only 10-20 system EEG channels displayed).
  * Average reference (identical to "as recorded" if the source singals are average referenced).
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
