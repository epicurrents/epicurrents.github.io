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
