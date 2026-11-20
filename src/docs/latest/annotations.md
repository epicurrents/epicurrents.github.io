[[toc]]

## Overview

Annotations are structured notes attached to a recording that describe either the recording as a whole or specific moments within it. They are a first-class concept in Epicurrents because the two primary use cases of the platform — educational annotation workflows and research data curation — both revolve around the ability to mark, classify, and exchange observations about signal data.

Two concrete examples:

- **Supervised learning for AI** — researchers annotate seizures, sleep stages, or artefacts across a dataset, producing labelled ground truth that a model can be trained on. Coded annotations (see below) make this output interoperable with external tooling without re-labelling.
- **Student annotation validation** — in an educational session, students annotate the same recording independently. The instructor later compares submissions against a reference set, using the annotation data as the unit of assessment. A teaching project plugin can be built entirely around this flow.

## Labels and events

Annotations fall into two categories.

**Labels** describe the recording as a whole. A label answers the question *"what kind of recording is this?"* — for example, a sleep stage classification, a quality flag, or a diagnostic category applied to the entire file.

**Events** describe what happens at a specific point or interval in the recording. An event answers the question *"what is happening here?"* — a spike, an artefact, a stimulus, a patient action. Events have a start time and an optional duration; labels do not.

Both types share a common set of properties and both can carry coded values.

## Properties

Every annotation (label or event) has the following properties:

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier for the annotation within the recording, assigned when the annotation is added to the resource if it does not carry one. |
| `name` | `string` | Name of the annotation type, shared by every annotation of that type (every EEG event is named `EegEvent`). Not a unique identifier. |
| `label` | `string` | Short display string shown in the viewer UI. Falls back to a string representation of `value` when not set. |
| `type` | `string` | Structural type tag used by the application (e.g. `'event'`, `'label'`). |
| `class` | `string` | Semantic class — one of the predefined classes below. Selects the class colour the viewer draws the annotation in. |
| `value` | `boolean \| number \| number[] \| string \| string[] \| null` | The annotation's primary data payload. |
| `text` | `string` | Free-text comment or clinical note. |
| `annotator` | `string` | Identifier of the person or system that created the annotation. |
| `priority` | `number` | Display priority, `0` when not set. See [event classes and priorities](#event-classes-and-priorities). |
| `codes` | `Record<string, string \| number>` | Coded classification values (e.g. `{ icd10: 'G40.9', snomed: '84757009' }`). |
| `locked` | `boolean` | When `true`, every property, `text` included, is protected against modification and the annotation cannot be removed. Once set to `true`, it cannot be unset. |
| `visible` | `boolean` | Controls whether the annotation is displayed in the viewer. |

Events additionally have:

| Property | Type | Description |
|---|---|---|
| `start` | `number` | Start time in seconds from the recording start. |
| `duration` | `number` | Duration in seconds (0 for an instantaneous event). |
| `channels` | `(number \| string)[]` | Channels the event applies to; empty means all channels. |
| `background` | `boolean` | When `true`, the event is drawn behind the traces. |
| `color` | `SettingsColor` | Optional colour override for this specific event. |
| `opacity` | `number` | Optional opacity multiplier applied on top of the class default. |

## Event classes and priorities

The `class` property groups events into semantic categories. Core declares these event classes:

| Class | Intended meaning |
|---|---|
| `activation` | Any activation procedure that may affect the signal (hyperventilation, photic stimulation, eyes open/closed). |
| `comment` | Free-form commentary, which may be unrelated to the recording itself. |
| `event` | Something taking place during the recording at that moment. The default class. |
| `technical` | Technical data or events of the recording, such as impedance readings, calibration or input montage switches. |
| `trigger` | A reference event for measuring effects, such as a stimulus. |
| `answer`, `example`, `question` | Educational classes: a quiz question, an answer to one, and an example of a feature, finding or technique. |

The EEG viewer offers four of them when an annotation is created — `event`, `activation`, `comment` and `technical` — and draws each in its class colour. The classes, their labels, colours and quick codes are the `eeg.annotations.classes` setting.

`priority` defaults to `0`. Core defines suggested values for the general-purpose classes in `GenericBiosignalEvent.PRIORITY` (`technical` 100, `comment` 200, `activation` 300, `event` 400), but nothing assigns them automatically: an annotation carries the priority it was created with, and the EEG viewer creates user annotations with priority `1`. The viewer uses priority to order the labels of annotations that start at the same time.

## Coded annotations

Any annotation can carry an arbitrary set of code values in its `codes` property — a plain object mapping a coding system name to a value:

```json
{
  "icd10":  "G40.9",
  "snomed": "84757009",
  "loinc":  "LP6786-4",
  "custom": "SPIKE_R_TEMPORAL"
}
```

Coded annotations have several advantages over free-text labels:

- **Interoperability** — output can be consumed directly by external pipelines, databases, and statistical tools without additional parsing.
- **Consistency** — standardised codes eliminate spelling variation and synonym ambiguity across annotators or sessions.
- **De-identification** — this is perhaps the most significant advantage for research. EDF+ files often embed rich clinical narratives in their annotation channels (physician notes, patient names, medical history). The platform strips this text at ingest, but the clinical meaning can be preserved by converting text annotations to coded form first. A recording that originally contained `"Patient reports aura, history of JME"` can be exported as `{ icd10: "G40.3" }` — the key information is retained while all identifying free text is discarded.
- **Multi-scheme support** — the same event can carry codes from multiple standards simultaneously, accommodating both clinical reporting requirements and research workflows.

### Coded events

Core ships `GenericBiosignalEvent.CODED_EVENTS`, a catalogue of event codes every biosignal modality shares: technical events, interventions, what was observed of the patient at the bedside, and disturbances from the surroundings. The `eeg-module` adds its activation procedures in `EegEvent.CODED_EVENTS` (hyperventilation, photic stimulation per frequency, eyes open and closed, sensory stimuli). Terms carry DICOM, IEEE or HED-SCORE equivalents where those standards have one.

The catalogue records what happened during the recording that the signal cannot show on its own. What a reader concludes from the signal, such as a spike, a seizure or a sleep stage, is a finding, and findings are coded in HED-SCORE rather than in this catalogue. A project adds terms to a category with `extendEvents()`.

## Locking

Annotations support two levels of write protection, and a resource can also be held against additions for a while.

### Annotation-level lock

Setting `annotation.locked = true` on an individual annotation prevents every property change to that annotation, `text` included, and also prevents it from being removed from the recording. The lock is one-way: once set, it cannot be cleared. The annotation editor opens a locked annotation read-only.

This is used, for example, when loading a student's submitted annotations for review — locking prevents accidental modification of the submission.

### Resource-level lock

Setting `resource.annotationsLocked = true` on a biosignal resource sets the resource flag only: no events or labels can be added or removed, but existing annotations that are not locked themselves can still be modified. `resource.lockAnnotations()` locks the entire annotation set: it locks every existing annotation individually and then sets the flag. Neither can be undone.

This is the appropriate level for read-only reference sets — for example, a validated ground-truth annotation set loaded alongside a recording for comparison.

### Resource hold

Setting `resource.annotationsHold` to a reason string holds the resource against adding and removing events and labels; setting it back to `null` releases it. While held, `annotationsLocked` reads `true`, so every place the interface checks the lock refuses an addition, and the interface announces the reason in place of opening the annotation editor. Unlike `lockAnnotations()`, a hold locks no existing annotation, and unlike either form of the resource-level lock it can be released, so an application uses it while nothing added to the resource would be kept — for example, while a review leaves the reader no set of their own to write into — and releases it when that changes. Releasing a hold never releases a resource-level lock.

### Difference in scope

| | Add new annotation | Modify annotation properties | Edit `text` | Remove annotation |
|---|---|---|---|---|
| Annotation locked | ✓ allowed | ✗ blocked | ✗ blocked | ✗ blocked |
| Resource flag set (`annotationsLocked`) | ✗ blocked | ✓ allowed | ✓ allowed | ✗ blocked |
| Resource locked (`lockAnnotations()`) | ✗ blocked | ✗ blocked | ✗ blocked | ✗ blocked |
| Resource held | ✗ blocked | ✓ allowed | ✓ allowed | ✗ blocked |

## Creating annotations

Annotations can be created in these ways:

- **Annotations menu** — open with the `A` key (when no selection is active) or the [[icon:message-middle]] button in the controls bar; use the form to create a new event at a specific time.
- **Keyboard shortcuts** — `A` pressed together with a quick code creates an annotation of that class: `A+0` event, `A+1` activation, `A+2` comment, `A+3` technical. `A` alone with a selection active annotates the selection with the default class, and `Shift+A` repeats the last saved annotation over the selection or, with nothing selected, at the cursor.
- **Annotate tool** — the [[icon:highlighter]] button in the controls bar turns on a cursor tool: clicking on the signal creates an event of the default class, dragging creates a span, and holding `Shift` makes the annotation global; the editor then opens on the new annotation. The tool is disabled while the resource is [locked](#locking).
- **Context menu** — right-click [`[[icon:mouse]]`] on the recording.

When a signal selection is active (a range has been dragged on the trace), the new annotation is created over that selection with the selection's start time and duration pre-filled. When there is no active selection, an instantaneous (spot) annotation is created at the cursor position.

### Context menus

Right-clicking on the signal plot without dragging opens a menu for that point in time:
- **Create channel annotation** — a spot annotation on the channel under the pointer. Offered only when the pointer is on a channel.
- **Create global annotation** — a spot annotation that applies to all channels.
- **Start / End channel selection** and **Start / End global selection** — mark the two ends of a selection one at a time, for a range too long to drag across on one page. `Cancel selection` discards a selection that has been started.

Right-clicking on an existing annotation opens a menu naming it, with an option to delete it. The creation and deletion options are disabled while the annotation or the resource is [locked](#locking). An application embedding the viewer can add its own actions to both menus.

### Editing spot annotations

Double-clicking [`[[icon:mouse]]`] an annotation opens it in the editor; a locked annotation opens read-only. An unlocked spot annotation can also be dragged to a new position along the time axis.

## Saving and exporting

Annotations are not stored inside the EDF file. They are managed separately and can be persisted in several ways:

- **Platform backend** — the Epicurrents platform stores annotations through its annotations REST API. The viewer does not write the annotations edited in it to the server by itself; a project integration can persist them through that API.
- **Dataset output (WebDAV)** — with the `annotations.saveToDataset` setting on (off by default), every change to the annotations writes `<resource name>_annotations.json` to the active dataset's output connector, such as a WebDAV source. An existing file is overwritten by default; the dataset's output conflict resolution can instead refuse the write, or rename or version the existing copy first.
- **Export** — annotations can be exported manually as a JSON file from the annotations menu, or as part of a structured report.

The exported file is a JSON object in one of two formats. The Epicurrents format carries `events` and `labels` as arrays of `serialize()` output in the shape of the properties table above, with `format: 'epicurrents'`, the active `montage` and the recording `startTime`. The MNE format follows the structure of an MNE `Annotations` object (`onset`, `duration`, `description`, `ch_names`, `orig_time`), with the event's display name as its description.
