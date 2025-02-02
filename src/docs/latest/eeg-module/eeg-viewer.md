[[toc]]

## Viewer components

### General controls

![eeg-controls](/img/eeg-controls.png)
_EEG controls row above the EEG viewer._

The controls toolbar above the signals apply general settings on the recording level or to preconfigured channel types. Controls include:
- **Montage**: A list of preconfigured montages to display the signals in.
- **Sensitivity**: Signals selsitivity in uV/cm units; larger values will attenuate signal amplitudes and smaller values will increase them.
- **Timescale**: Controls the amount of time displayed on the screen. The dynamic 3cm/second is recommended for general EEG viewing, but a list of static number of seconds per screen is also provided.
- **Filters**: Settings for high-pass, low-pass and band-reject filters can be chosen from a predefined list of options. The `Low` option applies to the lower (highpass) filter, the `High` to the higher (lowpass) filter, and `Notch` to the band-reject filter (either 50 Hz or 60 Hz to filter AC artifact).

On the right end of the controls bar is a button for the annotation display that opens on the right end of the viewer. Optionally, the `A` key can be used to toggle the drawer.

### Channel labels

Channel names are displayed on labels on the left side of the signals. Right-clicking on a channel name will open a context menu that contains individual settings for filters and sensitivity.

### Cursor line

Cursor line is a vertical red line that shows the current video position (if video is present). By default it is at the start of the visible page, but can be dragged with the mouse.

### Navigator

The EEG view includes a navigator displaying the whole record span, including data gaps and annotations. The navigator is placed on the bottom of the viewport, but would be relatively simple to move above the trace display, if so desired.

![eeg-navigator](/img/eeg-navigator.png)
_The red area is the visible page, blue bars on top are annotations._

The time displayed on the left side of the navigator shows the time position of the **cursor line**. Depending on the setting, the cursor either displays time elapsed from the start of the recording or the actual time at that point of the recording, provided the EEG source file contains the recording start time. The same applies to the time intervals displayed below the navigator bar.

Double-clicking on the navigator will browse to that point in the recording, attempting to position the exact time in the middle of the screen.

## Browsing an EEG

There are five means to browse an EEG:

1. Using the arrow keys `←` and `→`, or `Page up` and `Page down`. Arrow keys move the view by one second and page up/down keys by up to 10 seconds, limited by how much can fit on your screen. If you don't have page up/down keys on your keyboard, holding down the `Shift` key while pressing an arrow key will have the same effect.
2. Rolling the mouse wheel will scroll the EEG by up to 10 seconds at a time (roll down to move forward and up to move backward).
3. Swiping left or right over the EEG traces on a touch screen.
4. Double clicking on the navigation bar below the EEG display will move to that location.
5. If the recording has annotations, clicking on an annotion will jump to that location (annotations can be viewed by pressing A).
