[[toc]]

## Coding a finding

The EEG viewer's annotation editor carries a finding picker, which codes an annotation as a finding in the HED-SCORE vocabulary: what a reader concludes from the signal, such as a spike, a seizure pattern or a sleep feature. The finding is stored on the annotation as a code, beside its text and class (see [coded annotations](docs/annotations#coded-annotations)), so an annotation can say what it marks without any typed text.

An annotation with a finding and no text is shown by the finding's name on the plot and in the annotation list, and hovering its label on the plot lists everything the code says. Text typed into the editor still takes precedence as the name.

### Opening the picker

The picker is the row below the text and class fields of the annotation editor, marked with `[[icon:wave-pulse]]`. The editor opens when an annotation is created (see [creating annotations](docs/annotations#creating-annotations)) or when an existing one is double-clicked [`[[icon:mouse]]`]. The terms are loaded the first time the picker is shown, and a spinner stands in for the row until then.

On a locked annotation the picker is read-only: it shows the coded finding and its properties, and an annotation without a finding shows no picker row at all.

### Choosing a finding

There are four ways to pick a finding:
- **Search** — type into the `Finding` field. Every word typed must start a word of the term's name, so `inter epi` finds `Epileptiform interictal activity`. Common abbreviations and word forms are recognised as well, such as `LPD`, `GPD`, `FIRDA`, `IED`, `HFO`, `PDR` or `spike`; an abbreviation that stands for a finding with a property, such as `FIRDA` or `spike`, picks both. Findings picked recently rank first. The arrow keys move through the results, `Enter` picks the highlighted one and `Escape` clears the search.
- **Browse** — the `Browse` menu lists the findings of one group at a time: `Interictal`, `Seizures and episodes`, `Background`, `Sleep`, `Benign variants`, `Critical-care patterns`, `Physiologic`, `Polygraphic channels` and `Artifacts`.
- **Palette** — a host application can configure up to twenty findings that are offered as buttons below the field. While nothing is typed, the number keys `1` to `9` and `0` pick the first ten.
- **Finding groups** — once the recording has [finding groups](#finding-groups), the `Browse` menu also lists them under `Finding groups`, and picking one makes the annotation another event of that group.

Each result names the group the finding belongs to, so that findings of the same name in different groups, such as a spike and the critical-care spike-and-wave pattern, are not mixed up. Hovering a result shows the term's description.

The chosen finding replaces the search field, followed by its group name. `[[icon:xmark]]` (`Remove finding`) removes it, and the annotation is then uncoded again.

### Properties

Picking a finding fills in what the viewer already knows:
- **Location** — the electrodes the annotation is drawn on. A global annotation has no location.
- **Side** — left, right or bilateral, from the side those electrodes lie on.
- **Frequency** — for a finding with a frequency property, a frequency measured with markers in the [examination tool](docs/eeg-module/analysis-tools#examination-tool) on a span the annotation covers. It is written as approximate, to one decimal. Measurements are kept in the page only, and one made elsewhere in the recording is never used.

Everything filled in can be changed. The properties set are shown as chips below the finding, each with its own remove button, and `Properties` opens the fields for the rest. Which fields are offered depends on the finding's group. For example:
- Interictal findings: `Side`, `Morphology` (spike, sharp wave, polyspikes and the other waveforms), `Activity` (the forms of rhythmic and irregular slowing), `Discharge pattern`, `Incidence`, `Spread`, `Photic response` and `Frequency`.
- Seizures and episodes: `Side`, `Seizure type`, `Onset pattern`, `Semiology`, `Postictal` and `Context`.
- Background: `Side`, `Rhythmic activity`, `Posterior dominant rhythm`, `Prevalence`, `Frequency` and `Amplitude`.
- Critical-care patterns: `Side`, `Morphology` with a `Triphasic` checkbox, `Prevalence`, and under `Pattern properties` the `Frequency`, `Duration`, `Onset`, `Dynamics` and `Superimposed` activity of the pattern. The duration is that of the whole pattern, not of the one discharge the annotation may be drawn on, so it is never filled in.
- Artifacts: `Side` and `Significance`.

Some fields appear only after the findings they apply to: `Morphology` after epileptiform activity, `Activity` after abnormal rhythmic activity.

`Location` lists the electrodes of the recording under the standard 10-10 names, grouped as `Frontal`, `Temporal`, `Central`, `Parieto-occipital` and `Ear and mastoid`; an older name such as `T3` is shown as `T7`. With more than one electrode in the location, `Maximum` marks the electrodes where the finding is greatest. A bilateral finding also takes a balance: `Symmetrical`, `Left dominant`, `Right dominant` or `Asymmetrical`.

A number field takes its value in a fixed unit (Hz for frequencies, µV for amplitudes), rounded and held to the range that unit allows. The small menu before it says how the number is meant: `=` exactly, `≥` at least, `≤` at most, `≈` about, or `–` a range with an upper bound.

### How the finding is stored

The finding is saved with the annotation when the editor's save button is pressed, as a HED string under the `hed` code. A bare finding is stored as its tag, such as `Epileptiform-interictal-activity`. A finding with properties is stored as one group with the finding first, for example `(Epileptiform-interictal-activity, Left, Spike, Sensor-list/F7;T7)`. A bounded number is written as a comparison, such as `(Greater-than-or-equal-to, Feature-frequency/2 Hz)`. The annotation's start and duration are its own and are never repeated in the code.

A code the picker did not write, such as one that came with an imported file, is shown as stored, and its properties are not offered for editing, so that an edit cannot rewrite what it says.

### Finding groups

One finding often appears as many events: the same spike in several places, or a discharge repeated through a recording. Events of one finding can share a finding group, a number from 100 to 999 stored in the code. The group is shown beside the finding as `Group <number>`, and hovering or selecting one of its events marks the others.

A group is started by copying an annotation that has a finding. `Shift+A` repeats the last saved annotation over the selection or at the cursor, and `[[icon:stamp]]` in the picker row saves the annotation and turns on the annotate tool, so that each click on the signal adds a copy. The first copy of a finding that is in no group starts a new one, which the original joins too. Each copy takes its location and side from the channels it is placed on.

With a group in place:
- `[[icon:check-double]]` saves the annotation and gives the other events of its group the same finding and properties, each keeping its own location. Locked events are left as they are.
- `[[icon:link-slash]]` takes the annotation out of its group and leaves the rest of the group as it is.
- Removing the finding and picking another in the same edit keeps the annotation in its group.

### When the picker is limited

When the viewer runs inside an application with a server behind it, that server decides which codes it accepts, and the picker offers only those. A server that accepts no HED codes hides the picker. A server that validates against a different HED-SCORE release than the viewer carries disables it with a message saying so, because what the picker writes might be refused. Comparisons other than `=`, and finding groups, are offered only where the server accepts them. A recording with no server behind it, such as a local file, is offered the whole vocabulary, with no palette.

The vocabulary is HED-SCORE, licensed CC BY 4.0; the release in use is named at the bottom of the picker.

## The report

The report window holds a structured form for describing the recording. Open it with the `[[icon:file-lines]]` button at the right end of the controls bar or with the `R` key, which also closes it.

Like the [analysis tools](docs/eeg-module/analysis-tools#usage), the report opens in a window of its own: a Picture-in-Picture window where the browser supports it, otherwise a window over the viewer moved by its title bar. The button in its corner moves it from one to the other. The report window can also be resized. One such window is shown at a time, so opening the report closes the analysis window.

The form is loaded from report files the deployment serves with the viewer. If they cannot be loaded, the button opens nothing.

### Fields

The menu at the top of the form selects the report type; the viewer ships one, `Routine EEG`. Its `Description` section asks for:
- **Background activity** — the posterior dominant rhythm (such as symmetric alpha activity, an asymmetric occipital rhythm or theta-dominant mixed activity), with its frequency range in Hz, amplitude in µV and the montage it was read in for the rhythms that have them, and the side for an asymmetric one; disseminated slowing; and beta activity.
- **Reactivity** — reactivity to eyes closing.
- **Vigilance** — the level of consciousness and the reactivity to pain.
- **Sleep** — the depth of drowsiness and sleep reached, and whether the sleep phenomena are age-appropriate.
- **EKG** — the heart rate and rhythm.

Each item is chosen from a list. Some fields appear only after the choices they apply to. The free-text fields beside the lists (`More specifically?`) are disabled in the EEG viewer.

### What happens to the report

The report lives in the page only. It is not saved with the recording, exported or sent anywhere, and it does not read the recording's annotations or findings.
