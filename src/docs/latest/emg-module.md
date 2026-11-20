[[toc]]

## Overview

The EMG module (`@epicurrents/emg-module`) displays electromyography recordings: a signal trace on a millisecond timebase with audio playback, since surface EMG is read by ear as much as by eye, and a cascade view that stacks consecutive pages of one channel as rows.

EMG recordings are read from WAV files by the [WAV reader](docs/wav-reader). The module has no file-format code of its own and no other source format.

The module is part of the `full` edition. The `eeg` edition does not include it.

## Opening a recording

The module adds an `Electromyography` section to the `File` menu, with an `Open WAV` submenu holding `From file`, `From folder` and `From URL` (see [Opening files](docs/getting-started/opening-files)). A URL must point at the WAV file itself, on a server that answers range requests.

The channels of a WAV file carry no names, so they are labelled `Chan 1`, `Chan 2` and so on, in microvolts.

## Viewer controls

### Controls bar

- **Sensitivity**: The trace amplitude, from 10 µV to 5 mV per division, 300 µV by default. The buttons beside the dropdown step to the neighbouring value. The audio volume follows the sensitivity, so the trace and the sound stay in step.
- **Timebase**: Time per division, from 5 to 50 ms, 10 ms by default. The screen is ten divisions wide, so the default page is 100 ms. With epoch mode on (see [settings](#settings)), the page is one epoch and the dropdown is disabled.

On the right end of the bar:

- `[[icon:bars]]` `Toggle cascade view` switches between the cascade of the first channel and the raw signals (see [Cascade view](#cascade-view)).
- `[[icon:search]]` `Inspect EMG segments` switches the pointer to the inspection cursor. The `I` key toggles it as well.
- `[[icon:message-middle]]` `Toggle annotation tools` opens the annotation sidebar on the right. The `A` key toggles it when no selection is active.

### Navigator

The navigator below the trace shows the whole recording, with the visible page marked. The time on its left is the cursor position in seconds and milliseconds. Double-clicking [`[[icon:mouse]]`] the navigator moves to that point.

The buttons on its right:

- `[[icon:backward-fast]]` rewinds playback and returns to the start of the recording. It is disabled while audio is playing.
- `[[icon:play]]` / `[[icon:pause]]` starts and pauses audio playback. The `Space` key does the same.
- `[[icon:chevron-left]]` / `[[icon:chevron-right]]` move one page backward or forward.

### Keyboard and mouse

| Input | Action |
|---|---|
| `←` / `→`, `Page up` / `Page down` | Move one page backward or forward; in the cascade, one whole stack. Holding the key keeps browsing. |
| Mouse wheel | Move one page, forward when rolled down. |
| `Space` | Start or pause audio playback. |
| `N` | Toggle the notch filter at the module's default notch frequency, 50 Hz unless the host configures another. |
| `I` | Toggle the inspection cursor. |
| `A` | Toggle the annotation sidebar. Held with a selection active, a digit key adds an annotation of the class with that quick code. |
| `Escape` | Cancel a pending hotkey. |

Hotkeys follow the [Require Alt for hotkey actions](docs/user-interface/settings#require-alt-for-hotkey-actions) setting. Annotations are created and edited as described in [Annotations](docs/annotations).

Filters are applied in the cascade rows only. The raw-signal view is drawn unfiltered, so the notch filter has a visible effect only in the cascade.

## Audio playback

The `[[icon:play]]` button starts playback from the beginning of the visible page if the view has been moved while playback was paused, and otherwise resumes where it stopped. `Space` always resumes where playback stopped. The view follows playback a page at a time. When playback reaches the end of the recording it rewinds, and the view returns to the start.

The audio is built from the cached signal, so playback is available once the recording has loaded.

## Cascade view

The cascade shows the first channel of the recording as a stack of rows, each row one page long and each starting where the row above it ends. It is built the first time it is opened, once the recording has signal data cached, and has ten rows by default.

- Page turns move the view by the whole stack.
- During audio playback the rows are drawn in as the sound plays. Once the last row has been drawn, the cascade either clears the rows and starts over or draws over the previous rows, leaving a blank ahead of the new signal; the `emg.cascade.sweep` setting chooses which.
- When playback ends the final stack stays in view.
- Annotations are drawn on the rows they fall on and cannot be edited in the cascade.
- Double-clicking [`[[icon:mouse]]`] a row leaves the cascade for the page holding the clicked time.

Changing the row count in the settings rebuilds the rows in place.

## Settings

The module adds an `EMG` tab to the settings (see [Settings](docs/user-interface/settings)):

| Group | Entry | Default |
|---|---|---|
| Memory management | `Use the application memory manager with EMG resources.` Applies to files opened after the change. | On |
| | `Unload cached signal data when EMG resources are closed.` | Off |
| Display options | `Invert EMG trace polarity.` | On |
| | `Apply antialiasing to EMG traces.` | Off |
| Color options | `Default color of the EMG traces.` | Black |
| Grid options | Show, width and colour of the major and minor grid lines. | Hidden |
| Channel isoelectric lines | Show, width and colour of each channel's isoelectric line. | Hidden |
| Epoch mode options | `Use epoch-based data browsing (requires setting an epoch length).` | Off |
| | `Only display full epochs (hide possible partial last epoch).` | Off |
| | `Length of a single epoch in seconds (set to zero to disable).` From 0 to 60. | 0 |
| Cascade options | `Number of rows in the cascade.` From 2 to 30. | 10 |
| | `What playback does once the last row has been drawn.` `Clear the rows and start over` or `Draw over the previous rows`. | Clear |
| | `Width of the blank ahead of the signal when drawing over previous rows, in percent of a row.` From 1 to 50. | 10 |

The epoch mode entries are not stored with saved preferences and return to their defaults in a new session.

The memory manager needs a cross-origin isolated page (see [Memory management](docs/memory-management)). Without it, or with the setting off, the WAV file is read on the main thread instead of in a worker.

## Registering the module

The module reads its signals through the WAV reader, wrapped in an `EmgStudyLoader`, and its viewer comes from the interface's EMG module. The builder's registrar (`setup/modules/emg.ts`) does this, and an edition activates it by listing `emg` in its `activeModules`:

```ts
import * as interfaceEmgModule from '@epicurrents/interface/modules/emg'
import * as emgModule from '@epicurrents/emg-module'
import { WavImporter, WavWorkerSubstitute } from '@epicurrents/wav-reader'

app.registerModule('emg', emgModule)
const wavImporter = new WavImporter()
wavImporter.setWorkerOverride('emg', () => {
    const emgSAB = window.__EPICURRENTS__.RUNTIME!.SETTINGS.getFieldValue('emg.useMemoryManager')
    return useSAB && emgSAB ? wavWorker() : new WavWorkerSubstitute()
})
const emgLoader = new emgModule.EmgStudyLoader('EmgWavLoader', wavImporter)
app.registerStudyImporter('emg/wav-file', 'Open WAV file', 'file', emgLoader)
app.registerStudyImporter('emg/wav-folder', 'Open WAV files from folder', 'folder', emgLoader)
app.registerStudyImporter('emg/wav-url', 'Open WAV from URL', 'url', emgLoader)
registerInterfaceModule('emg', interfaceEmgModule)
```

`useSAB` and `registerInterfaceModule` come from the builder's setup context, and `wavWorker` is the builder's factory for the reader's worker. `EmgStudyLoader` refuses a study whose metadata lacks the channel count, duration or sampling rate.

| Export | Role |
|---|---|
| `EmgRecording` | The resource: channels, signal cache and the audio asset, with `playAudio`, `pauseAudio`, `rewindAudio` and `addCascadeMontages`. |
| `EmgStudyLoader` | Builds an `EmgRecording` from a loaded study. |
| `EmgCascadeMontage` | The cascade of one channel. It keeps the recording's ms/div timebase and takes its row length from the page the display draws. |
| `EmgEvent`, `EmgLabel` | Annotations. |
| `EmgEvents` | The playback events: `emg-audio-playback-started`, `-paused`, `-stopped` and `-ended`. |
