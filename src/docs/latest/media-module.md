[[toc]]

## Overview

The native media module shows video, audio and image files with the browser's own `<video>`, `<audio>` and `<img>` elements. The viewer reads and decodes nothing itself: it hands the file's address to the element, so there is no reader package, worker or memory management involved.

The module is part of the interface (`@epicurrents/interface/modules/native`) rather than a package of its own. It registers three modalities, `audio`, `image` and `video`, each with its own section in the `File` menu. The `full` edition includes all three; the `eeg` edition includes none.

## Supported formats

The module has no format list of its own: a file plays or displays if the browser's media element can decode it, so the supported containers and codecs are those of the browser in use. The file picker does not filter by type.

A file the browser cannot open shows `The file could not be opened.` with a `[[icon:triangle-exclamation]]` warning instead of the media.

A WAV file opened from the `Audio` section is played as sound. To display a WAV file as a signal trace, open it from the `Electromyography` section instead (see [EMG module](docs/emg-module)).

## Opening files

Each modality adds a section named after it (`Audio`, `Image`, `Video`) to the `File` menu, with a submenu (`Open audio`, `Open image`, `Open video`) holding `From file` and `From URL` (see [Opening files](docs/getting-started/opening-files)). There is no folder option. A URL is handed to the media element as it is, so it must point at the file itself.

## Viewing

The media is centred in the viewer and scaled to fit it, keeping its aspect ratio.

- **Video and audio** use the browser's built-in playback controls. Only the file's metadata is loaded until playback starts. Switching to another resource stops playback.
- **Images** are shown as they are, scaled down to fit.

The module adds no controls to the controls bar, no hotkeys and no settings tab.

## Platform media

On the platform, media files are uploaded to the library and opened in the viewer by address. Video, audio and image files open in this module; which extensions a deployment accepts is set by `MEDIA_ALLOWED_UPLOAD_EXTENSIONS` (see [Library and media](docs/platform/configuration#library-and-media)).

## Registering the module

The builder has one registrar per modality (`setup/modules/audio.ts`, `image.ts` and `video.ts`), each a single call, and an edition activates them by listing `audio`, `image` and `video` in its `activeModules`:

```ts
import { registerNativeMedia } from '@epicurrents/interface/modules/native'

export const registerVideo = (ctx: SetupContext) => registerNativeMedia(ctx, 'video')
```

`registerNativeMedia` registers the modality's core and interface modules and two importers, `media/<modality>-file` and `media/<modality>-url`, around a `NativeMediaLoader`. A host that holds a file's address loads it through the URL importer. A local file is given an object URL, which is revoked when the resource is destroyed.
