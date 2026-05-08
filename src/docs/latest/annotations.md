[[toc]]

## Overview

Annotations are structured notes attached to a recording that describe either the recording as a whole or specific moments within it. They are a first-class concept in Epicurrents because the two primary use cases of the platform — educational annotation workflows and research data curation — both revolve around the ability to mark, classify, and exchange observations about signal data.

Two concrete examples:

- **Supervised learning for AI** — researchers annotate seizures, sleep stages, or artefacts across a dataset, producing labelled ground truth that a model can be trained on. Coded annotations (see below) make this output interoperable with external tooling without re-labelling.
- **Student annotation validation** — in an educational session, students annotate the same recording independently. The instructor later compares submissions against a reference set, using the annotation data as the unit of assessment. The `edu` platform plugin is built entirely around this flow.

## Labels and events

Annotations fall into two categories.

**Labels** describe the recording as a whole. A label answers the question *"what kind of recording is this?"* — for example, a sleep stage classification, a quality flag, or a diagnostic category applied to the entire file.

**Events** describe what happens at a specific point or interval in the recording. An event answers the question *"what is happening here?"* — a spike, an artefact, a stimulus, a patient action. Events have a start time and an optional duration; labels do not.

Both types share a common set of properties and both can carry coded values.

## Properties

Every annotation (label or event) has the following properties:

| Property | Type | Description |
|---|---|---|
| `name` | `string` | Unique identifier for the annotation within the recording. |
| `label` | `string` | Short display string shown in the viewer UI. Falls back to a string representation of `value` when not set. |
| `type` | `string` | Structural type tag used by the application (e.g. `'event'`, `'label'`). |
| `class` | `string` | Semantic class — one of the predefined classes below. Controls colour and priority defaults. |
| `value` | `boolean \| number \| number[] \| string \| string[] \| null` | The annotation's primary data payload. |
| `text` | `string` | Free-text comment or clinical note. This field remains editable even when the annotation is locked. |
| `annotator` | `string` | Identifier of the person or system that created the annotation. |
| `priority` | `number` | Display priority; higher values are shown on top when annotations overlap. |
| `codes` | `Record<string, string \| number>` | Coded classification values (e.g. `{ icd10: 'G40.9', snomed: '84757009' }`). |
| `locked` | `boolean` | When `true`, all properties except `text` are protected against modification and the annotation cannot be removed. Once set to `true`, it cannot be unset. |
| `visible` | `boolean` | Controls whether the annotation is displayed in the viewer. |

Events additionally have:

| Property | Type | Description |
|---|---|---|
| `start` | `number` | Start time in seconds from the recording start. |
| `duration` | `number` | Duration in seconds (0 for an instantaneous event). |
| `channels` | `(number \| string)[]` | Channels the event applies to; empty means all channels. |
| `background` | `boolean` | When `true`, the event is drawn as a coloured background band rather than a vertical line. |
| `color` | `SettingsColor` | Optional colour override for this specific event. |
| `opacity` | `number` | Optional opacity multiplier applied on top of the class default. |

## Event classes and priorities

The `class` property groups events into semantic categories. Each class carries a default colour and priority that determine how events are rendered when they overlap. The EEG module defines four built-in classes:

| Class | Default priority | Intended meaning |
|---|---|---|
| `technical` | 100 | Recording-system internal markers — usually hidden from clinical review. |
| `comment` | 200 | Free-text clinical or research notes. |
| `activation` | 300 | Stimulus and activation procedure markers (hyperventilation, photic stimulation, eyes open/closed). |
| `event` | 400 | Clinical findings and research events — the most prominent class. |

Higher priority values are rendered on top. These defaults live in `GenericBiosignalEvent.PRIORITY` as a plain static object and can be adjusted for a deployment before the application launches:

```ts
// Flatten the priority scale for a project that doesn't need differentiation
GenericBiosignalEvent.PRIORITY.TECHNICAL  = 1
GenericBiosignalEvent.PRIORITY.ACTIVATION = 2
GenericBiosignalEvent.PRIORITY.EVENT      = 2
```

Because `PRIORITY` is not frozen, this reassignment takes effect globally for the session without subclassing or configuration overhead. The values are intended as sensible defaults, not enforced constants.

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

### EEG coded events

The `eeg-module` ships with `EegEvent.CODED_EVENTS`, a comprehensive catalogue of standardised event codes for routine EEG, mapped to their DICOM and IEEE equivalents where available. Categories include activation procedures (hyperventilation, photic stimulation, eyes open/closed), background activity, sleep stages, and common EEG findings. These serve as a reference and can be extended per project using `EegEvent.addCodedEvents()`.

## Locking

Annotations support two levels of write protection.

### Annotation-level lock

Setting `annotation.locked = true` on an individual annotation prevents all property changes to that annotation except the `text` field, and also prevents it from being removed from the recording. The lock is one-way: once set, it cannot be cleared.

This is used, for example, when loading a student's submitted annotations for review — locking prevents accidental modification while still allowing the reviewer to add notes via `text`.

### Resource-level lock

Setting `resource.annotationsLocked = true` on a biosignal resource locks the entire annotation set: no events or labels can be added, modified, or removed. Before setting the resource lock, all existing annotations are automatically locked individually as well.

This is the appropriate level for read-only reference sets — for example, a validated ground-truth annotation set loaded alongside a recording for comparison.

### Difference in scope

| | Add new annotation | Modify annotation properties | Edit `text` | Remove annotation |
|---|---|---|---|---|
| Annotation locked | ✓ allowed | ✗ blocked | ✓ allowed | ✗ blocked |
| Resource locked | ✗ blocked | ✗ blocked | ✗ blocked | ✗ blocked |

## Creating annotations

Annotations can be created in three ways:

- **Annotations menu** — open with the `A` key or the [[icon:message-dots]] button in the controls bar; use the form to create a new event at a specific time.
- **Keyboard shortcuts** — `A` followed by a class shortcut (`A+1` through `A+4` for the four built-in classes) creates an annotation at the current cursor position.
- **Context menu** — right-click on a signal selection or on the recording at any point.

When a signal selection is active (a range has been dragged on the trace), the new annotation is created over that selection with the selection's start time and duration pre-filled. When there is no active selection, an instantaneous annotation is created at the cursor position.

> **Planned features:** Creating spot annotations at the cursor position without a prior selection (instant annotation), and a dedicated context menu for existing annotations and signal selections, are planned for an upcoming release. These will be tracked in the roadmap.

## Saving and exporting

Annotations are not stored inside the EDF file. They are managed separately and can be persisted in several ways:

- **Platform backend (automatic)** — when used with the Epicurrents platform, annotations are automatically saved to the server via the REST API on every change and reloaded when the recording is next opened. No manual action is required.
- **WebDAV** — annotations can be saved to and loaded from a WebDAV source. Each save writes a structured JSON document to the configured WebDAV path; subsequent saves to the same path create versioned copies or overwrite depending on the connection mode set at source registration time.
- **Export** — annotations can be exported manually as a JSON file from the annotations menu, or as part of a structured report.

The exported format is a plain JSON array of annotation objects whose shape matches the `serialize()` output described in the properties table above, making it straightforward to import into any analysis tool.
