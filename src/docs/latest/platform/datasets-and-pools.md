[[toc]]

## Datasets

A *dataset* is a flat, named set of recordings (and other objects, such as media files) that is shared as a unit. It is the platform's only sharing container: a grant on a dataset conveys read access to every member, present and future, without touching any member's own access rights. A recording can belong to any number of datasets.

Datasets sit beside two other organising tools that share nothing:

- **Collections** are the author's private folder tree. A recording is in at most one collection, and a collection grants nothing to anyone. To share what a collection organises, export it to a dataset.
- **Tags** are labels for filtering and search. They grant no access.

Datasets are addressed by an opaque 32-character hash, which is what the dataset page, viewer links and the management commands below take. Inside a dataset, folders arrange the members for presentation only; moving or deleting a folder never changes membership or access.

A dataset's *managers* are its author, anyone holding a write grant on it, and superusers. Several of the features below — subject values, curator review — are for managers. A few decisions are reserved for the author or a superuser alone: turning release gating on or off, configuring a submission pool and listing a dataset publicly.

## Sharing a dataset

The dataset page's access panel grants access to a user, a group or a share link; a federation grant gives a peer instance access the same way (see [Federation](docs/platform/configuration#federation)). The author, a superuser or someone holding a share grant may grant, and a grant made by anyone but the author or a superuser may confer only what its giver holds: no write access without write access, no raw access without raw access, and no expiry later than the giver's own.

**De-identified or raw.** Every read grant carries a choice of what the recipient receives, and de-identified is the default:

- A **de-identified** grant serves the recording with its header identification blanked and the annotation text inside the file stripped, and withholds the text of annotation records, events and labels the recipient did not write themselves. Timing, classification codes and findings produced by an analysis run remain readable.
- A **raw** grant serves the stored file as it is. Only someone who holds raw access may give it.

**Inheritance.** A member inherits the terms of the dataset grant that reaches it, so the sharer's choice of de-identified or raw holds for every member. A direct grant on a recording takes precedence over any dataset grant for that recording. Write access is never inherited: a dataset write grant lets its holder manage the dataset, not modify its members.

**Hidden members.** A recording whose ingest failed, or one in the trash, is invisible through a dataset to everyone but its author and superusers. In a [release-gated](#release-gating) dataset, unreleased members are hidden from everyone but its managers.

**What a recipient receives is personal data.** De-identification blanks identifying fields and strips annotation text; it leaves the signal, its geometry and its timing untouched, and the platform keeps the means to reverse the rest. The output is pseudonymised personal data for every recipient, under every grant and every dataset setting on this page, and no setting described here changes that. [Data protection](docs/platform/data-protection) describes the operator's position.

### Recording a contextual assessment on a grant

A deployment may reach its own documented finding about what a particular recipient can do with what they receive, for example where the recordings are taken from a dataset the publisher already releases openly. The platform does not make that finding. It holds the sharer's record of it beside the grant it applies to, so it can be re-checked:

- On the dataset page's access panel, each grant takes an assessment reference — a document identifier or URL, with a kind such as *Contextual assessment*, *DPIA*, *Data-sharing agreement* or *Published dataset* chosen from a selector — and an assessment date. Recording grants take the same pair through the API. Both are set together or not at all, and a future date is refused.
- The record is shown to the grant's giver, the object's author and superusers. A grantee never learns whether an assessment about them exists.
- A recorded assessment changes nothing about what the grant serves.

`grant_assessments` is the sweep that keeps such records current. It lists every active grant other than an author's own, with its recorded assessment and one of four states:

| State | Meaning |
|---|---|
| `none` | No assessment recorded: the grant serves pseudonymised data and claims nothing more |
| `current` | Assessed within the cut-off, and after the de-identification pass last wrote every recording the grant covers |
| `stale` | Assessed longer ago than the cut-off (`--older-than`, default 183 days) |
| `reprocessed` | A recording the grant covers was rewritten by the de-identification pass after the assessment, so the assessment looked at different output than the recipient now receives |

Each grant also counts how many of the recordings it covers name the published dataset they were taken from (`--public-source` on import), which is the author's assertion repeated, not a check of it. Every run opens with the currency of the platform's own data-protection assessment and says when its next review is due.

```bash
docker compose run --rm web python manage.py grant_assessments --due
```

`--due` keeps only `stale` and `reprocessed` grants, the list a sharer re-runs; `--format json` is machine-readable. Targets are named by kind and primary key, never by username. The sweep is also the *Grant assessments* operation in the Maintenance tab.

## Subject fields

A dataset may declare *subject fields*: facts about each member's subject that a reader chooses recordings by, such as an age band, a sex or a diagnostic category. Readers see them as columns, filters and sort keys in the dataset browser.

**The schema** is an ordered list of fields, each with a lower-case `key`, a `label` and a non-empty list of `choices`. There is no free-text field, so a diagnosis is declared as categories: a value names a category rather than describing a person. A field marked `displayed` may be shown to readers of a release-gated dataset; on any other dataset every reader, a share-link holder included, sees every field.

**A number field** (`"type": "number"` instead of choices) holds one number per member, an age as a published table lists it. It exists for republishing a dataset whose publisher already chose how fine its values are, and it is refused wherever the platform sizes classes: on a release-gated dataset, a pool, or a dataset that has had a release. Declare such a field as bands instead.

The schema is replaced as a whole through `PUT /api/v1/library/datasets/{hash}/subject-schema/`, by a manager. A change that would drop a field or choice a member still carries is refused, and so is any change once the dataset's pool has started filling. A manager sets one member's values from the dataset browser, or through the API.

**The platform does not judge a schema's granularity.** Nothing checks whether the declared fields, combined with each other and with the signal, could identify a subject; only the displayed fields of a release-gated dataset are counted into class sizes. Subject fields are meant for republishing metadata that is already public at least as finely elsewhere, and that judgement is made by whoever declares the schema, before the dataset goes on the platform.

Subject values are withheld from the audit trail: a change is recorded, never the value. Rollback cannot restore them.

### Importing a subject table

A published dataset usually ships its subject facts as a table, one row per file or participant — a BIDS `participants.tsv` is the common case. `import_subject_table` writes them onto the declared fields of the dataset its recordings were imported into:

```bash
docker compose run --rm web python manage.py import_subject_table DATASET_HASH participants.tsv \
    --mapping mapping.json --dry-run
```

The table is CSV, or tab-separated when it ends in `.tsv` or `.tab`, in UTF-8, and both files must be readable inside the container. The mapping file says which column pairs a row with a recording and how each field is read:

```json
{
  "match": {"column": "participant_id", "on": "prefix"},
  "fields": {
    "age": {
      "column": "age",
      "bands": [
        {"below": 18, "choice": "0-17"},
        {"from": 18, "below": 65, "choice": "18-64"},
        {"from": 65, "choice": "65+"}
      ],
      "values": {"89+": "65+"}
    },
    "sex": {"column": "sex", "values": {"F": "female", "M": "male"}}
  }
}
```

- **Matching.** `on` is `name` (the default: the cell equals the recording's original file name), `stem` (the same, ignoring the extension, for a converted file), `prefix` (the file name starts with the cell followed by a separator, so `sub-1` does not match `sub-10_task-rest_eeg.edf`) or `content`. Only recordings the dataset's author wrote are matched, and a recording two rows match takes neither.
- **Content matching.** A deployment running with `RECORDINGS_DISCARD_ORIGINAL_NAME` kept no file name to match. With `"on": "content"` and `--files FOLDER`, the cell names a file under that folder and the row is paired with the recording whose uploaded bytes have the same SHA-256. This works for native EDF and BDF files only, since a converted recording's digest is of the EDF the converter wrote.
- **Values.** A cell becomes a choice through `values`, consulted first, or half-open numeric `bands` (`from` inclusive, `below` exclusive). A number field names its column alone. Columns the mapping does not name are dropped, and a cell it does not cover is counted and never stored; an empty or `n/a` cell is missing.

The output is counts, with the table's line numbers for unmatched and ambiguous rows; nothing it reports names a recording, a file or a value. `--dry-run` writes nothing. Imported values merge into what a member already has, a released member of a release-gated dataset is left alone, and a submission pool is refused, since its values arrive with its submissions.

## Linked recordings

A dataset too large to duplicate can be registered in place: `import_recordings --link` writes the same database rows an import does and leaves the file where it is. The operator keeps the file. The platform reads it and never writes, copies, renames, re-dates or deletes it.

Linking is a superuser-level operation, for a deployment whose users are all entitled to the source data:

- The owner given with `--username` must be a superuser.
- `--source-deidentified` is required. It records the operator's assertion that the files are already de-identified, and that assertion is what the files rest on: the platform's de-identification pass does not run on a linked file, which keeps its own header, annotation text and channel order.
- A deployment with `RECORDINGS_ALLOW_PRESERVE_ANNOTATIONS=False` cannot link, since a linked file keeps its annotation text. A channel map cannot be used either, because the file is never rewritten.

To configure a source, set the host directory and enable the container path in `.env`, then restart the stack:

```dotenv
RECORDINGS_LINKED_HOST_PATH=/srv/archive/eeg
RECORDINGS_LINKED_ROOTS=/data/linked
```

The stack mounts the host directory read-only at `/data/linked` in the web and worker containers. Then register a subtree:

```bash
docker compose run --rm web python manage.py import_recordings /data/linked/study-a \
    --username admin --link --source-deidentified
```

What follows from leaving the file alone:

- Readers still get canonical channel labels, because the channel block is cleaned in the database. The channels keep the file's order.
- Only EDF and BDF files are linked; a file needing conversion is passed over. A file reached through a symlink out of the root, a file whose modification time is in the future and a file already linked are refused.
- A linked file is served only while it is the file that was linked. Once it moves out of the root, changes size or is modified after linking, every reader is refused until it is linked again.
- Deleting a linked recording — from the trash, by account erasure, by withdrawal or by a curator's veto — removes its database rows only. Removing the file is the operator's job, at the source.
- `deidentification_report` lists linked recordings as linked, rather than as written by an older pass.

The same command without `--link` copies files in from the source directory (mounted at `RECORDINGS_IMPORT_PATH`, see [File storage](docs/platform/configuration#file-storage)) and runs the full ingest, including de-identification. `--public-source DOI_OR_URL` records that the recordings were taken from a published dataset, and `--channel-map KEY` names the channels of every imported file with one of the deployment's channel maps.

## Submission pools

A *submission pool* is a release-gated dataset fed only by contributors who prepared their recordings elsewhere, against a published profile, and submit them through a validating submission path rather than the ordinary upload. It exists for a multi-centre dataset whose members must not reveal which centre sent them or when.

Terms used below:

- An **ingest profile** is what a submitted file must conform to: channels and their order, sampling rate, units and ranges, recording lengths, the sidecar keys required and forbidden. Profiles are registered by the active project; the platform owns the checks and the project owns the values. A profile also sets `m`, the number of distinct contributors the pool must have before anything is ingested, and `k`, the class size the release side applies.
- A contributor's **ledger** is the server's record of their submissions to one pool. It is created with their first accepted file, never shown to them, and nothing on a pooled recording names it.

### Setting up a pool

The dataset's author or a superuser configures a pool from the dataset page, so a deployment with no shell can run one:

1. **Configure** on an empty dataset, choosing one of the project's profiles. This creates the pool's dedicated contributor group, turns release gating on and leaves intake closed. A dataset with members cannot become a pool, because every member must have passed the same gate.
2. **Add contributors** to the group through account administration. The group grants nothing else: it cannot receive an access grant or a project role, and it cannot be deleted while the pool exists.
3. **Open intake.** Opening is refused while the group has fewer active members than the profile's `m`. Closing is always allowed, refuses new files and lets accepted ones be ingested.

Until the first file is accepted, the profile can be changed and the pool dissolved. Once the pool is *filling*, the profile, the group and the gate are fixed, since every member was checked against them. A pool's membership is never edited by hand: members arrive through submissions and leave through withdrawal or a curator's veto. The dataset page shows the pool's state — the pending, failed and ingested file counts over all ledgers together, never per contributor, and the contributor count against the profile's `m`.

### What a contributor experiences

- Only members of the pool's group may submit, and only while intake is open. Managers and superusers are not contributors by virtue of their role. A pool the caller may not submit to is indistinguishable from one that does not exist.
- Each file and its sidecar are checked in memory against the profile before anything is written. A file that fails is refused with a list of reasons, and **nothing is kept**: no database row, no file on disk. The platform never repairs a failing file, because a repair would preserve the fingerprint the profile exists to remove; the contributor fixes the file and submits again.
- Each submission declares the SHA-256 of its file, which the check verifies against the bytes received. That digest is the contributor's receipt and their only handle on the file: it is what a withdrawal names.
- After that the contributor sees nothing of the pool until a release publishes it, and nothing of their ledger at all.

### From acceptance to membership

1. Accepted files wait in the spool for `RECORDINGS_SUBMISSION_POOLING_DELAY_HOURS` (default 24).
2. An hourly run takes waiting files only once the pool has files from `m` contributors. A file from a pool that never reaches `m` is removed after `RECORDINGS_SUBMISSION_WAITING_RETENTION_DAYS` (default 180).
3. The run ingests eligible files from every ledger in a random order, under the platform's system user rather than the contributor, and slightly re-dithers each file's samples so its stored digest no longer equals the contributor's receipt. Each becomes an unreleased member of the pool, hidden from everyone but its managers, and the platform's de-identification pass then runs on it as usual.
4. A file that fails ingest is kept for the operator for `RECORDINGS_SUBMISSION_FAILED_RETENTION_DAYS` (default 30), then removed; it is not retried.

The spool is excluded from backups and update snapshots, so a restore or rollback discards files still waiting in it, without telling their contributors. Contributors keep their originals.

### Withdrawal

A contributor withdraws a recording by handing the operator its receipt. The operator runs:

```bash
docker compose run --rm web python manage.py purge_dataset_recordings SHA256_OF_SUBMITTED_FILE --dry-run
```

and then again without `--dry-run`. For each digest the command deletes every matching member of a release-gated dataset — trashed or not, released or not, still in the spool or already ingested — and reports `purged` or `not found`; `--hashes-file FILE` reads one digest per line and `--dataset HASH` narrows the search. The report, passed back to the contributor, is the only confirmation of withdrawal and the platform's only answer to whether a digest exists. Only pooled recordings are in scope, so a platform user's own upload that shares the bytes is reported `not found` and kept.

## Release gating

A *release-gated* dataset keeps its members from surfacing one by one as they arrive, since arrival time and order could reveal where a member came from. The author or a superuser turns the gate on from the dataset page; a submission pool has it on from the start. Gating applies only to members the dataset controls — members its author wrote, or pooled recordings in its pool — so turning it on is refused while any member belongs to another user, and adding another user's recording to a gated dataset is refused.

What the gate does:

- **Unreleased members are hidden** from everyone but the dataset's managers, the member's own author and superusers, whatever other grant or dataset reaches them. To everyone else an unreleased member does not exist.
- **Share links convey nothing.** No member resolves for a request carrying a share token, released or not, and a share-link grant on a gated dataset is refused. A gated dataset is read through individual accounts only.
- **A released member is dated by its release month.** Readers who are not its author or a superuser see the month of the release that published it in place of its upload time, and listings order members by name or by that month, never by arrival.
- **The stored digest is withheld** from readers who do not manage the member, since a digest could match a contributor's receipt.

A deployment whose datasets are release-gated sets `LIBRARY_RELEASE_GATED_DEPLOYMENT` in its project settings. With it on, `manage.py check` refuses to boot while `RECORDINGS_ORIGINALS_PATH` is configured, because a pool keeps no copy its contributors do not hold and withdrawal never reaches the originals volume, and refuses to boot without `RECORDINGS_DISCARD_EMBEDDED_ANNOTATIONS`.

### Release runs

Members are published by release runs, which the operator starts; nothing schedules them. The cadence is fixed: a member uploaded in month M becomes eligible at the run at the start of month M+2, so each waits between one and two months and a month's arrivals from every contributor surface together. Trashed and failed recordings are never eligible.

```bash
docker compose run --rm web python manage.py release_dataset DATASET_HASH --dry-run
```

`--dry-run` reports the eligible and selected members and writes nothing. Which eligible members a run publishes is the active project's decision, typically the members whose class holds at least `k` recordings and that have enough curator approvals; without a project rule a run publishes everything eligible. `--as-of YYYY-MM-DD` sets the run date and so the release month, and is refused for a future date or a date before the dataset's latest release.

Every run, even one that publishes nothing, leaves a release record: the run date and month, who ran it, the profile version, the de-identification pass versions of what was released, the `k` and `m` in force, who signed it off and a reference to the written assessment. The project's rule fills what it knows, and the command fills the rest with `--profile-version`, `--k`, `--m`, `--sign-off USER_ID` (repeatable), `--actor USERNAME` and `--assessment-reference`. A superuser with no shell runs a release as the *Release dataset members* operation in the Maintenance tab; that form takes no assessment reference, because job arguments are shown to every staff user and kept past every erasure path, so a run that needs one is run with the command.

### Curator review

A count of class sizes cannot catch content that identifies a patient on its own: a rare condition, a skull defect, an implanted device, an unusual protocol. The managers of a release-gated dataset review its unreleased members for that from the dataset page.

- **Approving** records one approval per curator per member, and can be withdrawn, both only while the member is unreleased. The page shows each member's approval count, whether the viewer gave one, and how many the pool's profile asks for (one when unset). It never names who approved. An approval counts only while its curator still manages the dataset.
- **Vetoing** removes a member at once and cannot be undone. A pooled recording vetoed in its pool is deleted entirely; anything else only leaves the dataset, because managing a dataset confers no right to delete another user's recording.
- A veto takes a **reason code**, never free text, since a typed reason tends to describe what identifies the patient and the audit trail is permanent: rare condition or syndrome, skull defect or breach rhythm, implanted or external device, unusual protocol, or other identifying content.
- The contributor is not told of a veto; a later withdrawal of the same digest reports it not found.

Nothing links a recording to its contributor, so the platform cannot keep a curator from reviewing a recording their own centre sent.

## Dataset reports

Two read-only reports document a release-gated dataset for the deployment's own records and its periodic review. Both are also operations in the Maintenance tab, and both runs are audited with counts only.

### Access report

```bash
docker compose run --rm web python manage.py dataset_access_report DATASET_HASH --days 183
```

Shows, over a window (183 days by default; `--since YYYY-MM-DD` instead of `--days`), who has been reading the dataset in counts: per member, the requests, the byte-serving requests, the distinct readers with an account, the requests that carried no account and the month of the last read; per dataset, the distinct readers, the refused requests and the largest and median request count per reader. It names no reader. It reads archived request logs as well as live ones, so the window can be longer than the request log's archive window.

### Release conditions report

```bash
docker compose run --rm web python manage.py dataset_anonymity_report DATASET_HASH
```

`dataset_anonymity_report` (the *Dataset anonymity report* operation) restates each release's record and measures how well the pool as released still meets the conditions it was released under. It measures; it does not certify, and nothing it prints changes the pseudonymised status of the data. Per release (`--release ID` for one), it shows:

- the record the run stored, with its `k` and `m`;
- the members still present and the number withdrawn since, with any member now trashed or failed;
- the de-identification pass version now stamped on each member, flagging one rewritten since the run;
- the equivalence-class sizes over the pool as released up to that run, and from them the smallest class, the fraction of members in classes below the recorded `k`, the prosecutor risk and the entropy in bits;
- the same sizes over the displayed subject fields alone, the partition any reader of the dataset browser can make.

What a class is comes from the active project, joined with the members' displayed subject fields; without a project rule the report prints the record and says so. Two figures are repeated rather than recomputed, and the report says which: `m`, because the pooled ingest keeps no contributor per recording, and journalist risk, which needs population frequencies the platform does not hold. Re-run it after every release run and every profile change.

## Settings

| Variable | Default | Description |
|---|---|---|
| `LIBRARY_RELEASE_GATED_DEPLOYMENT` | `False` | Declares a release-gated deployment and turns on its boot checks. Set by the project's settings |
| `RECORDINGS_SUBMISSION_MAX_SIZE` | 64 MiB | Largest submitted file or sidecar; both are held in memory for the checks |
| `RECORDINGS_SUBMISSION_POOLING_DELAY_HOURS` | `24` | How long an accepted file waits before the hourly run may take it |
| `RECORDINGS_SUBMISSION_SPOOL_PATH` | `<staging>/submissions` | Where accepted files wait |
| `RECORDINGS_SUBMISSION_FAILED_RETENTION_DAYS` | `30` | How long a file that failed ingest is kept for the operator |
| `RECORDINGS_SUBMISSION_WAITING_RETENTION_DAYS` | `180` | How long a file of a pool short of `m` contributors waits before it is removed |
| `RECORDINGS_SUBMISSION_SPOOL_SWEEP_GRACE_HOURS` | `24` | Age past which a spool file no row accounts for is removed |
| `RECORDINGS_LINKED_HOST_PATH` | `./linked` | Host directory mounted read-only at `/data/linked` |
| `RECORDINGS_LINKED_ROOTS` | *(empty)* | Container paths files may be linked from; empty disables linking |

The public dataset listing and its conditions are under [Library and media](docs/platform/configuration#library-and-media).
