[[toc]]

## Native tools

The EEG interface module contains a set of analysis tools that can be used in the native JavaScript mode. These tools can be used to analyse signal segments.
- Fast-Fourier transform (FFT) tool to compute signal frequency spectrums of selected signal segments.
- Displaying exact durations and amplitudes of signal segments.
- Inspecting segments more closely, including time and amplitude difference between exact positions (e.g. to calculate spike duration).
- Scalp voltage field topogram at the cursor position, drawn both as a flat map and on a three-dimensional head surface.

### Usage

To select a signal segment drag over a signal in the EEG view. Using the right mouse button will automatically open the previously used analysis tool (FFT by default).

To select multiple segments for comparison, drag over them with the left mouse button while pressing down the `Ctrl` key. Clicking (instead of dragging) [`[[icon:mouse]]`] on a signal while pressing the `Ctrl` key will select a segment at the exact same time position as the first selected segment on that channel. The active signal segment can be selected from the upper right corner of the analysis tool window.

After selecting the desired segments the analysis tool can be opened by using a hotkey or by selecting the last segment using the right mouse button. Hotkeys for the different analysis tools are:
- `F`: Fast-Fourier transform tool.
- `E`: Segment examination tool.
- `T`: Voltage field topogram.

In a [cascade montage view](docs/eeg-module/eeg-viewer#cascade-montage-view), selections are sized to one channel band (rather than the full viewport) and a drag that crosses row boundaries is split into one bar per affected row. All bars share the same underlying selection — clicking any of them opens the analysis window for the full selected time range.

### Fast-Fourier transform tool

The FFT tool can be used to analyze the frequency components of one or more signal segments. The frequency components are displayed as a line graph, with lower frequencies to the left and higher frequencies to the right.

The graph includes guidelines for the four commonly used frequency ranges:
- `Delta`: below **4 Hz**.
- `Theta`: from **4 Hz** to below **8 Hz**.
- `Alpha`: from **8 Hz** to below **13 Hz**.
- `Beta`: from **13 Hz** upward (also including higher ranges).

There is no minimum length for a selection, but selecting longer segments allow for more detailed analysis. For segments under 1 seconds the analysis may be unreliable.

![fast-fourier-transform-tool](/img/fast-fourier-transform-tool.png)

Holding a mouse over the graph will display the exact frequency at that point.

The upper right corner of the analysis window displays channel names and graph colors of up to three signal segments. Clicking [`[[icon:mouse]]`] on the channel name will select that segment.

Below the FFT tool is a `signal properties` display that shows the selected signal segment, its duration and maximum positive and negative amplitudes.

### Examination tool

The examination tool makes it possible to more closely examine a selected signal segment.

Left-clicking [`[[icon:mouse]]`] on the signal plot will place a marker. By placing multiple markers, the time elapsed between each consecutive marker and the frequency of three or more markers are displayed. Markers can be dragged to a new position. Markers can be remove individually by right-clicking [`[[icon:mouse]]`] and all markers can be removed with the `Clear` button.

![signal-examination-tool](/img/signal-examination-tool.png)

Below the examination tool is a segment cropping tool. Dragging [`[[icon:mouse]]`] the handles from the edges of the segment will crop out those parts of the signal and allow closer examination of individual waveforms, for example.

### Voltage field topogram

The topogram displays the scalp voltage field at a single point in time, computed from the signal values under the EEG cursor. Both views are calculated in the browser as the cursor moves, so the tool is available in every deployment and does not need the Python integration.

![voltage-field-map-tool](/img/voltage-field-map-tool.png)
_Voltage field map of the vertex sharp wave._

The tool uses the EEG cursor's position as the analysis time point. Double-clicking [`[[icon:mouse]]`] on the signal will move the cursor to that position, after which the cursor can be either dragged or adjusted one sample at a time by using the `arrow` keys. The cursor tool below the map makes it easier to select the exact position.

Electrode positions are marked on both views, and the electrode of the active channel is drawn in yellow, which shows at a glance where the signal being read sits in the field. Selecting several channels highlights each of their electrodes.

The topogram needs a montage with a common reference — a bipolar montage such as the double banana describes voltage *differences* between electrode pairs, which cannot be placed at a single scalp position. It also needs enough channels whose electrode positions are known; channels the module cannot place, including polygraphic ones, are left out of the interpolation.

#### The two views

Two views are drawn side by side from the same values, using the same colour scale and the same contour levels:
- **Voltage field map** — the familiar flat map, viewed from above with the nose pointing up. It is drawn for any montage that meets the requirements above.
- **Scalp surface** — the same field projected onto an anatomical head surface, which can be rotated by dragging [`[[icon:mouse]]`]. This view needs a surface map prepared in advance for the recording's electrode array, and the module ships two: the classic 19-electrode 10-20 array, and the IFCN standardised array, which adds the inferior temporal chain (F9/F10, T9/T10, P9/P10) to those 19. The richest of the two that the recording can feed is used automatically. If neither matches, the view reports that no surface field map is available for the montage and the flat map is displayed alone.

![scalp-surface-field-map](/img/scalp-surface-field-map.png)
_The same field on the scalp surface view._

**The two views are not meant to look identical.** They are computed from the same voltages at the same instant, but over different head models: the flat map interpolates over a sphere fitted to the electrode positions, while the surface view interpolates onto the anatomical scalp of an averaged head. Anatomy that a sphere does not have — the temporal flattening, the occipital slope, the frontal curvature — shifts a maximum by a few millimetres and stretches the surrounding field differently in each view. The pair should be read for agreement about where a field is centred and how it is signed, not for a pixel-by-pixel match.

The views also differ in handedness, which is likewise intentional. The scalp surface is a realistic view of a head, so the subject's right side is on the viewer's left when facing them, whereas the flat map is seen from above with the nose up, placing the subject's right side on the right of the image.

#### Display options

The map's appearance is configured under the `Voltage field topogram` heading of the `EEG` settings tab:
- **Colour scale** — displays the voltage limit next to the map.
- **Contour levels** — the number of field contours drawn either side of zero; `0` draws none.
- **Fixed voltage scale** — the voltage in µV mapped to full colour saturation. At `0` every frame is scaled to its own maximum, which is what makes a single field easiest to read but also renders a flat stretch and a burst identically. Setting a fixed scale is what allows amplitudes to be compared across a time window.
- **Colour saturation of the mid range** — at `0` the colour is proportional to the voltage, which is the clearest setting for focal findings such as spikes. Raising it lifts low-amplitude structure into view — a diffuse asymmetry, a background gradient — at the cost of making a focal field appear to spread further than it does.
- **Colours** — the colours of the most negative and most positive values and of the midpoint. The default poles stay distinguishable for the common forms of colour vision deficiency, and the midpoint is deliberately neutral; a hue there reads as a third category.

## Python tools

The Python integration (using the Pyodide service) unlocks more advanced EEG analysis tools. As the service significantly increases the memory requirement of the application it should be employed only when the features are required.

### Power spectrum analysis tool

Python integration includes a power spectrum tool that computes the frequency characteristics of every channel on the currently visible display. This tool can be useful for visualizing hemispheric asymmetries and includes a set of basic indices on the right side of the graph.

Channels on the right hemisphere are colored blue, channels on the left are red, and midline channels are green.

![signal-power-spectrum-tool](/img/signal-power-spectrum-tool.png)
_Power spectrum of a photic stimulation run._
