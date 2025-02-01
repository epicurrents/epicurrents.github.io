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

TBA

### Examination tool

TBA

## Python tools

The Python integration (using the Pyodide service) unlocks more advanced EEG analysis tools. As the service significantly increases the memory requirement of the application it should be employed only when the features are required.

### Voltage topogram visualizer

This tool uses MNE-Python's topomap feature to calculate surface voltage maps at a specific point in time. In addition to the exact time point a voltage development series can be computed with voltage maps at certain time intervals before and after the selected time point. The tool uses the EEG cursor's position as the analysis time point. A cursor tool is included to make it easier to select the exact position. The cursor can be dragged to a rought position and then adjusted one sample at a time by using the the `arrow` keys.

### Power spectrum analysis tool

TBA