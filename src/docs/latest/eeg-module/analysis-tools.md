[[toc]]

## Native tools

The EEG interface module contains a set of analysis tools that can be used in the native JavaScript mode. These tools can be used to analyse signal segments.
- Fast-Fourier transform (FFT) tool to compute signal frequency spectrums of selected signal segments.
- Displaying exact durations and amplitudes of signal segments.
- Inspecting segments more closely, including time and amplitude difference between exact positions (e.g. to calculate spike duration).

### Usage

To select a signal segment drag over a signal in the EEG view. Using the right mouse button will automatically open the previously used analysis tool (FFT by default).

To select multiple segments for comparison, drag over them with the left mouse button while pressing down the `Ctrl` key. Clicking (instead of dragging) on a signal while pressing the `Ctrl` key will select a segment at the exact same time position as the first selected segment on that channel. The active signal segment can be selcted from the upper right corner of the analysis tool window.

After selecting the desired segments the analysis tool can be opened by using a hotkey or by selcting the last segment using the right mouse button. Hotkeys for the different analysis tools are:
- `F`: Fast-Fourier transform tool.
- `E`: Segment examination tool.

### Fast-Fourier transform tool

The FFT tool can be used to analyze the frequency components of one or more signal segments. The frequency components are displayed as a line graph, with lower frequencies to the left and higher friequencies to the right.

The graph includes guidelines for the four commonly used frequency ranges:
- `Delta`: below **4 Hz**.
- `Theta`: from **4 Hz** to below **8 Hz**.
- `Alpha`: from **8 Hz** to below **13 Hz**.
- `Beta`: from **13 Hz** upward (also including higher ranges).

There is no minimum length for a selection, but selecting longer segments allow for more detailed analysis. For segments under 1 seconds the analysis may be unreliable.

![fast-fourier-transform-tool](/img/fast-fourier-transform-tool.png)

Holding a mouse over the graph will display the exact frequency at that point.

The upper right corner of the analysis window displays channel names and graph colors of up to three signal segments. Clicking on the channel name will select that segment.

Below the FFT tool is a `signal properties` display that shows the selected signal segment, its duration and maximum positive and negative amplitudes.

### Examination tool

The examination tool makes it possible to more closely examine a selected signal segment.

`Left-clicking` on the signal plot will place a marker. By placing multiple markers, the time elapsed between each consecutive marker and the frequency of three or more markers are displayed. Markers can be dragged to a new position. Markers can be remove individually by `right-clicking` and all markers can be removed with the `Clear` button.

![signal-examination-tool](/img/signal-examination-tool.png)

Below the examination tool is a segment cropping tool. Dragging the handles from the edges of the segment will crop out those parts of the signal and allow closer examination of individual waveforms, for example.

## Python tools

The Python integration (using the Pyodide service) unlocks more advanced EEG analysis tools. As the service significantly increases the memory requirement of the application it should be employed only when the features are required.

### Voltage topogram visualizer

This tool uses MNE-Python's topomap feature to calculate surface voltage maps at a specific point in time. In addition to the exact time point a voltage development series can be computed with voltage maps at certain time intervals before and after the selected time point. The tool uses the EEG cursor's position as the analysis time point. A cursor tool is included to make it easier to select the exact position. The cursor can be dragged to a rought position and then adjusted one sample at a time by using the the `arrow` keys.

![voltage-topogram-tool](/img/voltage-topogram-tool.png)
_Voltage topogram of the vertex sharp wave._

### Power spectrum analysis tool

Python integration includes a power spectrum tool that computes the frequency characteristics of every channel on the currently visible display. This tool can be useful for visualizing hemispheric asymmetries and a set of basic indices on the right side of the graph.

Channels on the right hemisphere are colored blue, channels on the left are red, and midline channels are green.

![signal-power-spectrum-tool](/img/signal-power-spectrum-tool.png)
_Power spectrum of a photic stimulation page._
