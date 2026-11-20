[[toc]]

## Overview

A dataset is a set of recordings you share. Where a [collection](docs/platform/using-the-platform/library#collections) arranges your own recordings and is seen by nobody else, a dataset is flat (folders inside it are optional), a recording can be in any number of datasets, and whoever can read a dataset can read every recording in it, including recordings added later.

The `Datasets` page lists the datasets you created and those shared with you. Each row's menu offers `Open in viewer` and `Move to trash`.

This page describes the web interface. The operator's side, such as declaring subject fields, importing a subject table, running releases and withdrawing submissions, is in [Datasets and pools](docs/platform/datasets-and-pools).

## Creating a dataset

Select `New dataset`, give it a `Name` and an optional `Description`, and pick recordings or whole collections from your library tree. A collection page also offers `Create dataset`, with that collection preselected, and `Export as dataset`, which copies the collection's tree into a new dataset (see [Collections](docs/platform/using-the-platform/library#collections)).

The dataset's name, description and the display names of its recordings are seen by everyone you share it with. Keep patient identifiers out of them.

## The dataset page

The menu at the top of a dataset page has `Open in viewer`, `Edit`, `Grant access` and `Move to trash`. `Edit` changes the name and description and holds two switches:

- **`Load all members when opened`** makes the viewer load every recording as the dataset opens, for work that spans all of them. Otherwise the viewer lists the recordings and loads each one when you open it, which is what makes large datasets workable. The deployment refuses the switch above a size limit.
- **`Release-gated`** turns on [release gating](#release-gated-datasets). Only the dataset's author and superusers see it.

Under `Items` are two tabs:

- **`All items`** lists every member, recordings and media files, in folders where the dataset has them. `Add new` adds a `Recording`, a `Media file` or a `Folder`. An item's menu has `Move to folder` and `Remove from dataset`. Removing an item from a dataset does not delete the recording.
- **`Browse recordings`** is the [dataset browser](#browsing-recordings).

The author and superusers also see the [public listing](#public-listing) and [submission pool](#submission-pools) sections and `Viewer settings`, which override the deployment's viewer defaults whenever this dataset is opened. Folders are managed by the author and superusers.

## Browsing recordings

The browser lists a dataset's recordings with their modality, duration, channel count, sampling rate, date, the dataset's subject fields and up to three tags per recording. Select a column header to sort; the list is paged.

### Filters

- **`Modality`**, each with the number of recordings it matches.
- **Subject fields** the dataset declares. A choice field matches any of the values you tick; a number field takes a `From` and `To` range, either end optional.
- **`Tags`**: a recording must carry every tag you select.

`Clear filters` resets them. `Open all in viewer` opens the dataset's recordings; once a filter is set the button reads `Open matching in viewer` and opens only what matches, in the browser's order.

### The details drawer

Select a row to open its drawer: the recording's details, its subject values, all its tags and the classification codes on its annotations. `Open in viewer` opens that one recording.

The dataset's author, a superuser and, on a release-gated dataset, its other managers can change things here:

- **Subject values**: set or clear the member's value for each field, then `Save` (or `Revert`). A released member of a release-gated dataset keeps its values.
- **Tags**: `Add a tag` from those you can reach, or remove one. Staff can create new tags from the picker.
- **`Tag recordings…`** above the list adds a tag to, or removes it from, every recording the current filters match, up to 5,000 at once. Recordings you may not change are skipped and counted.

Tags label recordings for filtering and grant no access. You can reach curated tags, tags you created and the tags already on recordings you can read.

Which subject fields a dataset has is set by its author outside this page; the browser shows and edits the values.

## Sharing a dataset

The `Shared access` section lists who can read the dataset. Select `Grant access` to add someone:

| Target | How to choose | Permissions offered |
|---|---|---|
| `User` | `Search users` by username or name (at least two characters) | `Read`, `Write`, `Share (can grant further access)` |
| `Group` | Pick from the deployment's groups | The same three |
| `Token` | Type a share token, such as `study-2026` | Read only |

`Read` gives access to every recording in the dataset. `Write` lets the recipient add and remove items and edit the dataset. `Share` lets them grant access onwards, but never more than they hold themselves. `Revoke` removes a grant.

### What a recipient receives

Everyone you share with receives de-identified data: the file header without its identification fields, and annotations without the text other people wrote, though with their timing, authors and classification codes. You always read your own annotations in full. The signal itself is unchanged, so what the recipient receives is pseudonymised personal data; see [Data protection](docs/platform/data-protection#where-data-leaves-the-deployment).

A share-token grant has an `Original data` option. With it the token holder reads the data exactly as it is stored, without the de-identification pass. Use it only when the recipient is entitled to the original data.

### Share links

A token row offers `Copy browse link` and `Copy viewer link`. Anyone who has the link can open the dataset without an account: the browse link opens the [dataset browser](#browsing-recordings) read-only, the viewer link opens the recordings in the viewer. A reader without an account sees no tags, no annotation codes, no author and dates only to the month. Treat a share link like a password: whoever it is forwarded to can use it. Revoking the token ends every link built on it.

A release-gated dataset cannot be shared by token.

### Recording an assessment

Where you have documented, for a particular recipient, that they cannot identify anyone from what they receive, you can point at that document from the grant with the `Contextual assessment` button on its row. Choose the `Kind of document`, give a `Reference` (an identifier in your records or a link) and the `Date made or last re-run`. `What to record here` explains what the document should contain. The platform keeps the pointer beside the grant and reports when it is due for re-checking; it does not make the finding itself, and the recipient never sees it.

## Catalogue

The `Catalogue` page lists, under `Released datasets`, the release-gated datasets you can read that have released recordings, with their recording count, modalities and latest release month. Under `Public datasets` it lists the deployment's public listing, where it has one.

## Public listing

A deployment can publish a listing of datasets that anyone can browse and open without an account, at `/public-datasets`. It is off unless the deployment turns it on. Each entry links to `Browse recordings` and `Open in viewer`.

The listing is meant for republishing data that is already public elsewhere. On the dataset page, the author or a superuser lists a dataset in the `Public listing` section by choosing one of its share tokens and selecting `List publicly`. The listing publishes that token. A dataset can be listed only when:

- it is not release-gated;
- the chosen token is de-identifying (not `Original data`) and has not expired;
- it holds only recordings, at least one, and every recording names its [published source](docs/platform/using-the-platform/library#published-source);
- no recording has media attached.

The conditions are checked again whenever the listing is read, so a dataset that stops meeting them is shown as `Not shown` with the reasons, and drops off the listing until it is fixed. `Take off the listing` removes it and keeps the token.

## Release-gated datasets

A release-gated dataset hides its members from readers until a release publishes them. Releases run monthly. For a reader this means:

- recordings appear only once they are released, and never one by one as they arrive;
- each recording is dated by its release month, not its upload time, and lists are ordered by name;
- the dataset cannot be reached through a share token or link, only with an account.

The dataset's managers (its author, holders of write access and superusers) also see unreleased members, marked `Unreleased`. A recording can be added to a gated dataset only by the dataset's author, from their own recordings. Turning the gate off publishes every unreleased member.

### Curator review

On a release-gated dataset each recording row shows its managers a review control: `<count> of <required> approvals`, `Approve for release` or `Withdraw approval`, and `Veto…`. Approvals can be changed only while the member is unreleased. Which approvals a release requires is set by the project running the deployment.

A veto is for content that identifies the patient whatever else is done: a rare condition or syndrome, a skull defect or breach rhythm, an implanted or external device, an unusual protocol, or other identifying content. Choose the `Reason` and select `Veto and remove`. A veto takes effect at once and cannot be undone: a recording submitted to a pool is deleted from the platform, and any other recording leaves the dataset.

## Submission pools

A submission pool is a release-gated dataset that receives recordings only through checked submissions from a group of contributors. Submissions from all contributors are ingested together and released together, so that a recording's arrival time and order do not reveal who sent it.

### Setting up a pool

The author or a superuser configures a pool from the `Submission pool` section of an empty dataset:

1. Under `Make this a submission pool`, choose the `Ingest profile` and select `Make pool`. Profiles are registered by the project running the deployment and say what a submitted file must look like. The dataset becomes release-gated and gets a new contributor group, and intake starts closed.
2. Add the contributors to that group from their account pages (see [Groups](docs/platform/using-the-platform/administration#groups)). The group grants nothing except submitting to this pool.
3. Turn on `Accept submissions`. Intake opens only once the group has as many active members as the profile requires.

The section then shows the contributor count and how many files are waiting for ingest, ingested and failed. Until the first file is accepted the profile can be changed and `Dissolve pool` turns the dataset back into an ordinary one. After that, the profile, the group and the gate are fixed.

### Contributing to a pool

Contributors send prepared recordings to the pool from the viewer. Each file is checked against the pool's profile when it arrives, and a file that fails a check is refused without anything being stored. Accepted files are ingested in batches from all contributors together and stay hidden until a release publishes them. Keep the receipt the viewer gives for each accepted file: asking the deployment's operator to withdraw a submission requires it.
