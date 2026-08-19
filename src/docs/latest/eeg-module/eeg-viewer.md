[[toc]]

## Viewer components

### General controls

![eeg-controls](/img/eeg-controls.png)
_EEG controls row above the EEG viewer._

The first three icons on the bar belong to the dataset navigator:
- `[[icon:bars]]` Toggles the dataset navigator; if the navigator is visible clicking this hides it and vice versa.
- `[[icon:angle-up]]` Selects the item that is above the currently open item in the dataset navigation. This control is disabled if there is no preceding item (i.e. the currently open item is the first item in the dataset).
- `[[icon:angle-down]]` Selects the item that is below the currently open item in the dataset navigation. This control is disabled if there is no following item (i.e. the currently open item is the last item in the dataset).

The controls toolbar above the signals apply general settings on the recording level or to preconfigured channel types. Controls include:
- **Montage**: A list of preconfigured montages to display the signals in.
- **Sensitivity**: Signal sensitivity in uV/cm units; larger values will attenuate signal amplitudes and smaller values will increase them.
- **Timescale**: Controls the amount of time displayed on the screen. The dynamic 3cm/second is recommended for general EEG viewing, but a list of static number of seconds per screen is also provided.
- **Filters**: Settings for high-pass, low-pass and band-reject filters can be chosen from a predefined list of options. The `Low` option applies to the lower (highpass) filter, the `High` to the higher (lowpass) filter, and `Notch` to the band-reject filter (either 50 Hz or 60 Hz to filter AC artifact).

On the right end of the controls bar is a set of tool buttons:
- The `[[icon:magnifying-glass]]` **inspection tool** allows selecting (by `[[icon:mouse]]` dragging) an EEG signal segment for closer inspection in the [EEG analysis window](docs/eeg-module/analysis-tools). Alternatively, the `I` key can be used to toggle the inspection tool.
- The `[[icon:message-dots]]` opens the **annotation display** on the right end of the viewer. Optionally, the `A` key can be used to toggle the drawer.

### Channel labels

Channel names are displayed on labels on the left side of the signals. Right-clicking [`[[icon:mouse]]`] on a channel name will open a context menu that contains individual settings for filters and sensitivity. Settings for multiple channels can be changed at the same time by selecting the channels by left-clicking and then right-clicking [`[[icon:mouse]]`] any of these selected channels (or the final unselected channel).

![eeg-channel-properties](/img/eeg-channel-properties.png)

### Cursor line

Cursor line is a vertical red line that shows the current video position (if video is present). By default it is at the start of the visible page, but can be dragged with the mouse.

### Navigator

The EEG view includes a navigator displaying the whole record span, including data gaps and annotations. The navigator is placed on the bottom of the viewport, but would be relatively simple to move above the trace display, if so desired.

![eeg-navigator](/img/eeg-navigator.png)
_The red area is the visible page, blue bars on top are annotations._

The time displayed on the left side of the navigator shows the time position of the **cursor line**. It reads as time elapsed from the start of the recording by default; unticking *Display time elapsed from the recording start instead of the time of day* under the `EEG` settings tab switches it to the wall-clock time at that point of the recording instead. The same applies to the time intervals displayed below the navigator bar. Absolute time needs the EEG source file to carry a recording start time, and a de-identified recording deliberately does not — which is why relative time is the default.

Sometimes EEG recordings may have gaps (i.e. missing segments) in the data. These gaps are shown as gray areas in the navigator.

![eeg-navigator-with-gaps](/img/eeg-navigator-gaps.png)
_An EEG file with two longer gaps._

Double-clicking [`[[icon:mouse]]`] on the navigator will browse to that point in the recording, attempting to position the clicked point in time in the middle of the screen.

### Trend strip

The trend strip is an optional band rendered just above the navigator, showing one or more derived signals computed over the full recording. Each *trend* compresses an entire epoch of EEG into a single value (or a pair of values) per epoch, so the full recording fits on one horizontal line and lets the user spot long-term patterns at a glance.

The strip is hidden by default. Toggle it from the `Display` → `Biosignal` → `Trend strip` menu item; the menu shows a check mark while the strip is visible. Toggling on expands the bottom compartment to make room for the strip; toggling off collapses it back to the navigator's natural height. The same red view-position marker that appears on the navigator is mirrored on the trend strip so the user can see where the current page sits in the wider trend.

The currently implemented trend type is **amplitude-integrated EEG (aEEG)**:
- For each epoch (15 seconds by default) the signal is band-pass filtered (2–15 Hz), an amplitude envelope is computed, and the minimum and maximum envelope width within the epoch are recorded.
- The pair is rendered as a vertical line per epoch on a semi-log scale: linear up to 10 µV, logarithmic above (the Hellström-Westas scale). Tick marks on the right of each trend mark 10, 20, 50, 100, 200 and 500 µV; 10 and 100 carry labels.
- Two homologous derivations (one per hemisphere — C3/C4 or P3/P4 by default) are computed in parallel and shown side-by-side. The left-hemisphere band uses the EEG left-side trace colour, the right-hemisphere band uses the right-side colour, and each band carries the corresponding electrode label aligned to the bottom of its band.

Those derivations are resolved against the recording's setup, and the ratio and spectrogram trends fall back to them unless they declare their own. A deployment whose electrode array does not carry the default 10-20 electrodes therefore has to declare its own — see [trend derivations](docs/eeg-module#trend-derivations) — or all three trends build nothing at all and the strip stays empty.

The strip has two display modes that switch automatically depending on the available height:
- **Stacked** (default when there is room): each derivation gets its own horizontal slot, with a separator line between them at the value-0 line.
- **Superimposed** (when the strip is dragged narrow): the bands overlap on the same slot, drawn with partial transparency so both sides remain visible. Labels stack at the bottom-right of the combined slot in this mode.

If the user drags the bottom compartment too small to fit the strip, the trend is hidden automatically and the navigator takes the full slot — the strip reappears as soon as the compartment is expanded again.

### Cascade montage view

When the active montage is a cascade (see [cascade montage configuration](docs/eeg-module#cascade-montages)), the viewer switches to a stacked-row layout: one source channel rendered as N rows top-to-bottom, each row covering a fixed `pageLength` seconds. The visible reach across the whole stack is `rowCount * pageLength`, and the navigator's red view-position bar widens accordingly to span the full reach.

![eeg-cascade](/img/eeg-cascade.png)
_EKG cascade with ten 30-second rows. Timestamps on the Y axis mark each row's start time, the blue bars above some rows are span annotations, the translucent band marks the recording's main-page position, and the navigator at the bottom spans the full five-minute reach._

The Y-axis column on the left of the viewer carries recording-time stamps instead of the repeated source channel name — each row's label is the start time of the slice it displays, and the labels update live as `viewStart` scrolls. Clicking on a row label has no effect in cascade view because every row points at the same source channel.

A translucent light-blue band sits over the rows that hold the recording's regular page (the time range your last non-cascade montage was parked on). The band scrolls with `viewStart`, so it acts as a continuous "if you switch back to a regular montage, this is what you would see" cue.

Annotations on a cascade are drawn as compact markers only:
- Spot events are vertical lines on the row containing the event time.
- Span events render as narrow horizontal bars at the top edge of each row the duration covers.

Annotation labels are stripped to keep the rows readable — hover over a marker to see the full label and text in the tooltip. Cascade annotations are read-only; to edit or add annotations, switch to a regular montage first.

Filter and sensitivity changes made while a cascade is active stay with the cascade. The recording's regular montage settings are preserved and reapplied when the user switches away. Filter changes apply on the main thread for now, so the rendered rows update immediately but heavier modality-specific processing is not yet available through the cascade.

## Browsing an EEG

There are five means to browse an EEG:

1. Using the arrow keys `←` and `→`, or `Page up` and `Page down`. Arrow keys move the view by one second and page up/down keys by up to 10 seconds, limited by how much can fit on your screen. If you don't have page up/down keys on your keyboard, holding down the `Shift` key while pressing an arrow key will have the same effect.
2. Rolling the mouse wheel will scroll the EEG by up to 10 seconds at a time (roll down to move forward and up to move backward).
3. Swiping left or right over the EEG traces on a touch screen.
4. Double-clicking [`[[icon:mouse]]`] on the navigation bar below the EEG display will move to that location.
5. If the recording has annotations, clicking on an annotation will jump to that location (annotations can be viewed by pressing `A`).
6. Double-clicking [`[[icon:mouse]]`] on a cascade signal recenters `viewStart` on that point. The light-blue band on the cascade shifts to mark the new location, and any regular montage you switch to afterwards is parked around that time.
