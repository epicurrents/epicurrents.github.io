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
