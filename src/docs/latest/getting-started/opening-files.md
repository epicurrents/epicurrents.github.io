[[toc]]

## Direct file sources

Epicurrents is capable of opening files both from the local file system and from remote sources.

Files from the local file system can be opened either individually or in sets. When opening files in sets the application expects all files to be of same `modality` and `format`.

To open files from the file system, click `File` on the top menu bar and select the correct modality and file type to open. This should present you with additional options:
- `Open <format> file`: Opens a single file from the local file system.
- `Open <format> files from folder`: Opens all files of this type from the selected folder.
- `Open <format> from URL`: Opens a single file from the given URL. Note that the file must be directly available at the given URL; e.g. in case of EDF files the url should end in `.edf`.

Epicurrents utilizes the FileSystemAPI to open multiple files from the file system. This API avaible by default on chromium based browsers. Availability in other browsers may vary.

## WebDAV file sources

To open files from a password-protected remote source, Epicurrents can connect to these sources using the WebDAV protocol. These connections can be used to import datasets from the remote source.

### Source modes

Each source can be added with read and/or write permissions. The permissions cannot exceed what the user has been granted on the WebDAV server.

Below is a basic breakdown of the modes.

#### Read only

Read only permission gives the user the right to list and open files on the remote source. It does not allow modifying the file contents, renaming, moving or deleting files, or creating new files. This is the default mode and should be used to access immutable data sources, such as signal data recordings. It can also be used to "side-load" annotations for recordings opened via some other way.

#### Read-write

Read-write gives the user full access to the data on the resource. This mode should be used in cases where the user is expected to write new data on the source (such as annotations) and should also have access to previously written data on the source. It should not be used to access original signal data.

#### Write only

Write only is a "pseudo mode" in the sense that the user should have both read and write permissions on the server, but the connection is only used to write new data. This mode can be used for creating unique annotation sets on the source. If the user creates multiple sets of annotations for the same resource, each set can be saved as a separate version or newer sets can overwrite the previous ones. Default behaviour is to save each set as a separate version.
