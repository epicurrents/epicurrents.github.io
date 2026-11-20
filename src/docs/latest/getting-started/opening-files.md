[[toc]]

## Direct file sources

Epicurrents is capable of opening files both from the local file system and from remote sources.

Files from the local file system can be opened either individually or in sets. When opening files in sets the application expects all files to be of same `modality` and `format`.

To open files, click `File` on the top menu bar. The menu has a section for each modality, headed by the modality's name. Within a section, the ways of opening one format are grouped into a submenu named after the format (for example `Open EDF`), which holds the options:
- `From file`: Opens a single file from the local file system.
- `From folder`: Opens all files of this type from the selected folder.
- `From URL`: Opens a single file from the given URL. The URL must point directly at the file itself, not at a web page that links to it.

A format that can be opened only one way is listed as a single item with its full label. Exporters (`To file`) come last in each section. Below the modality sections, `Send recording to` lists the export targets the host application has registered, if any, and `Connectors` → `Add a connector` opens the dialog for adding a [WebDAV file source](docs/getting-started/opening-files#webdav-file-sources).

A single file is opened with the browser's file picker (`showOpenFilePicker`) where the browser provides it, and with a standard file input otherwise. A folder is opened with a directory file input (`webkitdirectory`).

## WebDAV file sources

To open files from a password-protected remote source, Epicurrents can connect to these sources using the WebDAV protocol. These connections can be used to import datasets from the remote source.

The connector dialog asks for a name and the source URL. Its source type is either `Filesystem` (a WebDAV file tree) or `Database`; for a filesystem source the `Index` switch indexes the contents of all contained folders. If the server requires basic authentication, a username and password can be given; this is available only when both the application and the source are served over HTTPS, unless the deployment's setup allows insecure authentication.

### Source modes

Each source can be added with read and/or write permissions. The permissions cannot exceed what the user has been granted on the WebDAV server.

Below is a basic breakdown of the modes.

#### Read only

Read only permission gives the user the right to list and open files on the remote source. It does not allow modifying the file contents, renaming, moving or deleting files, or creating new files. This is the default mode and should be used to access immutable data sources, such as signal data recordings. It can also be used to "side-load" annotations for recordings opened via some other way.

#### Read-write

Read-write gives the user full access to the data on the resource. This mode should be used in cases where the user is expected to write new data on the source (such as annotations) and should also have access to previously written data on the source. It should not be used to access original signal data.

#### Write only

Write only is a "pseudo mode" in the sense that the user should have both read and write permissions on the server, but the connection is only used to write new data. This mode can be used for creating unique annotation sets on the source. If the user creates multiple sets of annotations for the same resource, each set can be saved as a separate version or newer sets can overwrite the previous ones. Default behaviour is to overwrite the previous file with the newer set.

## Exporting a recording

A signal recording can be saved as a new file, or sent to a destination the host application offers. Both start from the `File` menu: an exporter is the last item in its modality's section, under the label the host application gave it, and the destinations are listed under `Send recording to`. Both open the same dialog, titled `Export recording` for a file and `Send to <destination>` for a destination. The dialog exports the recording that is active in the viewer.

### Range

`Start (s)` follows the position of the view until a start is typed in. After that it stays where it was set, also when the dialog is opened again, for as long as the same recording is active. `Length (s)` takes the length in seconds; clearing it takes the rest of the recording from the start. The recording's total length is shown below the fields.

### Channels

The channel table lists the recording's signal channels in the recording's own order. For each one:
- The checkbox includes the channel in the export or leaves it out.
- `Output label` is the name the channel is written under. Clearing it goes back to the source channel's label.
- `Source channel` names the channel the samples come from.
- `[[icon:chevron-up]]` and `[[icon:chevron-down]]` move the channel up and down; the file is written in the order of the table.

### Sampling rate

`Common sampling rate (Hz)` resamples every channel to one rate. Left empty, each channel keeps its source rate. The rate must be a whole number of hertz, and it cannot exceed the rate of the slowest channel included, since an export only ever downsamples.

### Saving the file

The `Summary` at the bottom of the dialog says what the file will be, and lists anything that stops the export, such as a channel without a source; `Export` stays disabled until it is fixed.

The exported file is de-identified: the subject identifiers in the header are blanked and the text of the annotations is removed. The file is downloaded as `<name>.edf`. The viewer then asks whether to also download the sidecar file with the original metadata, `<name>.edf.json`. The sidecar is not de-identified: it carries the original subject details and annotation text, so it is offered as a separate download that can be declined and kept apart from the file. What the exporter writes is described on the [EDF reader](docs/edf-reader#exporting) page.

### Sending to a destination

A host application can offer destinations for a recording, such as a repository it runs (see [exporters and export targets](docs/implementation#exporters-and-export-targets-(optional)) for how one is registered). A destination is enabled in the menu only for a recording opened from a local file, since a recording loaded from a URL or through a connector already exists elsewhere.

A destination can fix parts of the export, and the dialog then holds to them:
- A fixed list of channels becomes one row per required label, with `Source channel` suggested from the recording's channel labels. Each suggestion needs to be checked, and a label without a source must be given one before sending.
- A list of permitted lengths becomes a choice of length; a length that does not fit from the chosen start is disabled.
- A required rate replaces the rate field with a note that the signals are resampled to that rate, and a required amplitude range is stated in the summary.
- A destination that takes a recording in two ways has a switch at the top of the dialog. Changing it resets the length, rate and channels to what the other way allows.

The file sent is de-identified unless the destination says otherwise, and the summary warns when metadata sent with the file carries the original subject details. `Send` encodes the recording and hands it to the destination, and a notification reports the destination's answer.

A destination may hand back a receipt, such as a record of what it received. The receipt is shown in a `Receipt` dialog with `Download receipt` and `Copy`, and the dialog stays open until it is closed, so that a missed download can be repeated. Save the receipt before closing it: the viewer keeps no copy, and the destination may not be able to issue it again.
