[[toc]]

## Overview

Your recordings live in your library. The `Home` page shows what needs attention, what is still processing and your most recent recordings; the `Library` page organises them into collections. Collections are private to you. To share recordings with anyone, put them in a [dataset](docs/platform/using-the-platform/datasets).

## Uploading recordings

Select `Upload` on the `Home` page to open `Upload recordings`.

1. Drop files or folders onto the page, or use `Select files` or `Select folders`. Supported formats are EDF, EDF+, BDF, BDF+ and CSV; other files in the selection are skipped and counted.
2. Choose the `Recording modality`: `EEG`, `Polysomnography` or `Accelerometry`.
3. For a single file, you can give a `Display name`. It is shown to everyone you share the recording with. Leave it blank to use a random identifier instead of the file name. Do not enter patient identifiers.
4. Set where the upload goes under `Upload to:` with `Change`. The default is the `Library root`, outside any collection.
5. Select `Start upload`.

Keep the page open while `Uploading and processing — do not close this page.` is shown. When every file is done, `Go to library` or `Upload more`.

### Upload options

- **`Channel map`** appears when the deployment has channel maps. Choose one for files whose channel labels the platform does not recognise by itself.
- **`Preserve original annotations in file`** keeps the annotation text inside the stored file. By default it is removed during processing, because it can contain patient details. If you keep it, anyone you later give access to the original data can read it.
- **`Preserve folder hierarchy as subcollections`** appears for a folder upload. By default the files of a folder upload are placed flat in the chosen location. With the option on, each folder becomes a collection named after it. Folder names on your disk then become collection names, so make sure they contain no patient identifiers.
- **Hypnograms.** With `Polysomnography` selected, hypnogram files in the same selection are matched to their studies by subject and start time and uploaded with them. A hypnogram that matches no single study is not uploaded. For a single study you can also choose its hypnogram with `Hypnogram:` and `Choose`.

The platform's own converter handles CSV. Other vendor formats are accepted only where the deployment has installed a converter for them.

## Processing status

After upload every recording is processed: it is converted where needed, de-identified and indexed. See [Data protection](docs/platform/data-protection#erasure-and-retention) for what de-identification removes.

| State | Where you see it | Meaning |
|---|---|---|
| Waiting or processing | `In progress` on `Home` | Not openable yet |
| Available | A `<done>/<total> done` badge on the recording row | Openable; background jobs a project runs on it are still going |
| Ready | No badge | Everything has finished |
| Failed | `Needs attention` on `Home` and in the `Library` | Processing failed |

A failed background job does not make a recording fail; the badge shows how many failed. Where push notifications are on, you are notified when a recording finishes processing (see [Profile](docs/platform/using-the-platform/profile#push-notifications)).

### Failed recordings

A recording that failed processing shows its error under `Needs attention`. Use `Re-upload` to try again or `Delete` to move it to the trash. A failed recording is visible only to you and to superusers; nobody you share with sees it, and it is left out of datasets and every listing others read.

## Recording actions

Each recording row has a menu with:

- **`Details`** opens a drawer with the file and recording details: modality, format, duration, channels, file size, when it was added and its published source.
- **`Edit`** changes the `Display name`, the `Modality` and the `Published source`.
- **`Attach media`** attaches documents, video, audio or images to the recording (see [Media files](#media-files)).
- **`Delete`** moves the recording to the [trash](#trash).

Select rows with their checkboxes to act on several at once; the selection bar offers `Open recording` or `Open <count> recordings`.

### Display name and file name

Every reader except you sees a recording by its display name, never the file name you uploaded. Download file names are built from the display name too. A recording without a display name is shown under a short identifier. Set display names that carry no patient identifiers; the platform warns when a name looks like a personal name, a date or a long number, but it does not refuse it.

### Published source

`Published source` is the DOI or URL of the published dataset a recording was taken from, if any. It is shown to every reader, and a dataset can be listed publicly only when each of its recordings has one (see [Public listing](docs/platform/using-the-platform/datasets#public-listing)).

## Collections

Collections are personal folders. They can be nested, a recording is in at most one collection, and nobody but you and the deployment's superusers can see them.

On the `Library` page:

- **`New collection`** creates a top-level collection with a name and an optional description.
- **`Unassigned recordings`** lists recordings that are in no collection. Select some and use `Move to a collection`.
- **`Needs attention`** lists recordings that failed processing.

Inside a collection, `Add new` adds a sub-collection (`Collection`), existing recordings (`Recording`) or media (`Media file`). Select items and use `Move to...` to move them to another collection or the library root. When the target already holds an item with the same name you are asked whether to `Move anyway`.

The menu at the top of a collection page has:

- **`Edit`** to rename the collection or change its description.
- **`Create dataset`** to start a new dataset with this collection preselected.
- **`Export as dataset`** to copy the collection and its sub-collections into a new dataset you can share. With `Recreate sub-collections as dataset folders` the tree is kept as folders. The collection itself is not changed.
- **`Number recordings`** to rename every recording in the collection as `<prefix> 1`, `<prefix> 2` and so on, in the order they were added. This replaces display names you have set before.
- **`Move to trash`** to trash the collection with its sub-collections. The recordings in it are not deleted; they return to the library root.

## Media files

Media files are documents, video, audio and images. Which file types a deployment accepts is its own setting.

- **In a collection or dataset**, `Add new` → `Media file` opens `Add media`: pick existing files, or `Upload new file`. The `Label` you give is shown to anyone you share the file with, so avoid names and identifiers.
- **On a recording**, `Attach media` lists what is attached and lets you upload a file or choose an existing one. A `Timeline offset (seconds)` places it on the recording's timeline, for example a video synchronised to the signal; leave it empty to leave it unplaced. Attached media can be detached or have their offset edited later.

Anyone who can read a recording can read the media attached to it. The platform cannot remove identifying content from inside a video, image or document, so check what you attach.

## Opening recordings in the viewer

Open a recording with `Open in viewer` on its row, by double-clicking the row, or by selecting several and using `Open <count> recordings`. A dataset opens from its page or from the `Datasets` list with `Open in viewer`. Video, audio and images open in the viewer too.

The viewer takes the whole window. Leaving it closes what is open, and anything not saved goes with it, so the viewer asks first (`Leave the viewer?`). How to work in the viewer is described under [User interface](docs/user-interface) and [Annotations](docs/annotations).

## Trash

`Delete` and `Move to trash` move recordings, media files, collections and datasets to the trash rather than deleting them. A trashed item disappears from your lists and from everyone you shared it with. After the deployment's retention period, 30 days by default, trashed recordings, media files, collections and datasets are permanently deleted, recordings and media together with their files.

The interface has no trash view. A trashed item can be restored until it is purged through the activity log's rollback, which is an API operation; ask your administrator if you trashed something by mistake. The retention settings are listed in [Data protection](docs/platform/data-protection#erasure-and-retention).
