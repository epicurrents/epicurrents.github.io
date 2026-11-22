[[toc]]

## Overview

Epicurrents is distributed as a set of npm packages under the `@epicurrents` namespace. The core package provides the runtime, state management, and base types. Modality support (EEG, EMG, etc.), file readers (EDF, DICOM, etc.), and optional services (Python, ONNX) are separate packages that you register at startup — none of them are required, and you include only what your application needs.

All packages are written in TypeScript and ship ES-module builds with type declarations, exposed through each package's `exports` map, plus their web workers as standalone bundles. The packages and the viewer editions are built with Vite, which is the bundler the reference setup is written for.

## Installation

Install the core package and whichever readers, modules, and services your application requires:

```bash
# Mandatory
npm install @epicurrents/core

# Add the file readers you need
npm install @epicurrents/edf-reader
npm install @epicurrents/dicom-reader

# Add the study modules for the modalities you want to display
npm install @epicurrents/eeg-module
npm install @epicurrents/emg-module

# Add optional services
npm install @epicurrents/pyodide-service   # Python-in-browser (source localisation)
npm install @epicurrents/onnx-service      # ONNX machine learning inference
```

The default viewer interface (`@epicurrents/interface`) wraps the modules into a ready-to-use Vue 3 application. It is not published to npm: it is built in the Epicurrents builder workspace, which clones and links every package and bundles a chosen edition into an embeddable library and a standalone viewer (see [Building the application](docs/building-the-application) and [Standalone viewer](docs/implementation#standalone-viewer)).

## App lifecycle

Initialising an Epicurrents application always follows the same sequence regardless of which modules you use. The interface's `createEpicurrentsApp(config, register)` runs steps 1, 5 and 6 for you and calls `register` with the application in between, where a setup registers its modules, importers and services; `setups/full.example.ts` in the interface is the worked reference. The steps below show what happens underneath.

### 1. Instantiate

```ts
import { Epicurrents } from '@epicurrents/core'

const app = new Epicurrents()
```

The constructor takes no arguments; configuration is applied with `app.configure()` before launch and with the configuration passed to `launch()`. It sets these globals on `window`:

```ts
window.__EPICURRENTS__ = {
    APP:       app,             // the Epicurrents instance
    EVENT_BUS: app.eventBus,    // the typed application event bus
    RUNTIME:   app.runtime,     // the RuntimeStateManager
    SETUP:     {},              // the interface setup, written by the host or the interface
}
```

These globals are used by external components (e.g. project-specific panels embedded alongside the viewer) to subscribe to viewer events without being inside the viewer's own module graph. See [Platform integration](docs/getting-started/platform-integration) for patterns.

### 2. Register modules

Register a study module for each modality you want to support. `registerModule(name, module)` takes the module's `runtime` and `settings`, which every module package exports, so the package namespace can be passed as it is. Each module contributes its runtime state and settings to the application; the matching Vue components and store actions come from the interface's own module for that modality, which a setup registers with the `registerInterfaceModule(name, module)` function `createEpicurrentsApp` passes to its `register` callback.

```ts
import * as eegModule from '@epicurrents/eeg-module'

app.registerModule('eeg', eegModule)
```

A module's settings fields are addressed as `<module>.<field>` once it is registered, and their defaults can be changed with `app.configure()` before launch:

```ts
app.configure({ 'eeg.useMemoryManager': true })
```

Interface-level options for a module, such as extra montages or hotkeys, go in the `modules` field of the setup passed to `createEpicurrentsApp`:

```ts
await createEpicurrentsApp({
    modules: {
        eeg: {
            extraMontages: { 'default:10-20': ['/montages/my-custom.json'] },
            hotkeys: { fft: { code: 'KeyF', key: 'f' } },
        },
    },
}, register)
```

### 3. Register study importers

A study importer ties a file format to a modality. A reader package supplies the importer, which parses the file, and the module wraps it in a study loader, which turns the parsed study into a `DataResource`. `registerStudyImporter(name, label, mode, loader)` registers the loader under a name; `mode` is one of `'file'`, `'folder'`, `'study'` or `'url'`, and the label is what the file menu shows.

```ts
import * as eegModule from '@epicurrents/eeg-module'
import { EdfImporter } from '@epicurrents/edf-reader'

const eegLoader = new eegModule.EegStudyLoader('EegEdfLoader', ['eeg'], new EdfImporter())
app.registerStudyImporter('eeg/edf-file', 'Open EDF file', 'file', eegLoader)
app.registerStudyImporter('eeg/edf-url', 'Open EDF from URL', 'url', eegLoader)
```

One loader can be registered under several names, one per mode, and you can register loaders for different formats pointing to the same module or to different modules. A reader that runs in a worker is given its worker with `setWorkerOverride`; see the reference setup for the pattern.

### Exporters and export targets (optional)

An exporter is registered like an importer, with `registerStudyExporter`; the EDF exporter is described on the [EDF reader](docs/edf-reader) page. The file menu offers each one through an export dialog where the user picks a range, the channels with their output labels and order, and an output rate.

A host application can also offer destinations for a recording, such as a repository it runs, as *export targets*. A target states the file format it takes, optional constraints on the export, options for the exporter, and a function that receives the finished file:

```ts
app.registerSignalExportTarget('repository', {
    format: 'edf',
    label: 'My repository',
    constraints: {
        channels: ['Fp1', 'Fp2', 'C3', 'C4'],
        durations: [60, 120],
        samplingRate: 256,
    },
    options: { deidentify: true, embedFooter: true },
    submit: async ({ data }) => {
        const response = await fetch('/upload', { method: 'POST', body: new Blob([data]) })
        return { success: response.ok, message: response.ok ? 'Sent.' : 'The upload failed.' }
    },
})
```

The file menu lists the targets under "Send recording to". Constraints pre-fill and lock the export dialog: a channel list becomes one row per required label, with the source channel suggested from the recording's labels for the user to confirm, and a list of durations becomes the choice of length. The selection is checked against the constraints before anything is encoded. The file and, if the target asks for it with `sidecar: true`, the metadata sidecar are de-identified unless the target's options say otherwise. Keys listed in the constraints' `forbiddenMetadataKeys` are removed from the metadata wherever they occur, which the dialog asks of the exporter on every export to that target.

A target can offer a switch in the export dialog with `toggle`, for a destination that takes a recording in two ways that need different files. The target's own constraints, options, sidecar and `submit` apply while the switch is on, and those of `toggle.off` while it is off; `toggle.initial` sets the state the dialog opens in, on by default. The switch sits at the top of the dialog because it decides what the rest of it is held to, and changing it resets the length, rate and channels to what the constraints in effect allow. `exportTargetMode(target, on)` from `@epicurrents/core/util` resolves the mode a state puts in effect, for a host that renders its own dialog:

```ts
app.registerSignalExportTarget('repository-review', {
    format: 'edf',
    label: 'For review',
    constraints: { durations: [600], samplingRate: 200 },
    options: { deidentify: true, dither: true },
    submit: sendForReviewAndCollection,
    toggle: {
        label: 'Add to the collection after review',
        off: { options: { deidentify: true }, submit: sendForReviewOnly },
    },
})
```

A target's result may carry a `receipt`, a file for the sender to keep: `{ data, fileName, mimeType }`. The viewer shows its text in a dialog that offers the download and a copy and stays open until the user closes it, so a declined or missed download can be repeated. A destination that names what it received by something the sender cannot reproduce later, such as the hash of a dithered export, returns it this way, since the viewer keeps no copy.

A target is offered only for a recording opened from a local file. A recording loaded from a URL or through a connector already exists somewhere, and sending it on would copy it. `app.getSignalExportTargets(resource)` answers which targets a resource may go to, and `unregisterSignalExportTarget(name)` removes one. Targets may be registered at any time, for example from a `ViewerPlugin`'s `onAppReady` after the host has fetched what its destinations accept; the menu follows the `signal-export-targets-changed` event.

### Context menu actions (optional)

A host can add entries to the menu that opens when the user right-clicks a plot or an annotation in it. An action names the menus it appears in, a label the host has already translated, and a function run with what the menu was opened on:

```javascript
app.registerContextMenuAction('discuss', {
    icon: 'message-dots',
    label: 'Open the conversation',
    targets: ['annotation'],
    isAvailable: (context) => threads.has(context.annotation.id),
    run: (context) => openThread(context.annotation.id),
})
```

The context carries the resource, the annotation for the `annotation` target, the channel name where the menu was opened on one, and the recording time in seconds. The menu closes before `run` is called. The interface reads the registered actions each time it opens a menu, so an action may be registered or removed with `unregisterContextMenuAction(name)` at any time.

### 4. Register services (optional)

Services provide optional capabilities that run in a separate web worker — Python evaluation via Pyodide, ONNX inference, etc. They are loaded on demand and the application works without them if they are not registered.

```ts
import { PyodideService } from '@epicurrents/pyodide-service'

const pyodide = new PyodideService()
app.registerService('pyodide', pyodide)
pyodide.setupWorker({ packages: ['matplotlib', 'mne'] })
```

The service takes its worker from the application's `pyodide` worker override when it is constructed, so set that with `app.setWorkerOverride('pyodide', factory)` first; see [Pyodide service](docs/pyodide-service).

### 5. Register the interface

`registerInterface(constructor)` gives the application the interface class to use. The interface is not instantiated until `launch()` is called. `createEpicurrentsApp` registers the interface's `DefaultInterface`, which is not exported separately.

### 6. Launch

```ts
await app.launch({ containerId: 'viewer' })
```

`launch(config)` sets up the memory manager when the `app.useMemoryManager` setting is on and the page is cross-origin isolated, creates the interface instance with the configuration, and resolves with `true` once the interface reports ready, or `false` if it could not be created. The default interface mounts into the element with the id `epicurrents`, or `epicurrents-<containerId>` when `containerId` is given. `createEpicurrentsApp` passes its whole setup as the configuration, and sets `app.useMemoryManager` from its `useSAB` option beforehand.

### 7. Load a study

```ts
const resource = await app.loadStudy('eeg/edf-url', 'https://example.com/recording.edf', { name: 'Recording 1' })
```

`loadStudy(loader, source, options?)` takes the importer name registered in step 3 and the source: a URL, a list of URLs, or a `FileSystemItem` for files and folders the user opened. The options are the study loader's, among them `name` and `dataset`, which adds the resource to a dataset other than the active one. The returned promise resolves with the resource once the study has been loaded and added to the dataset, or with `null` if loading failed; preparing the resource starts at that point and continues in the background.

### 8. Preparing a recording before it is shown (optional)

A recording reaches `'ready'` with its header parsed and its worker acquired, but with no signal data behind it — the buffer allocation, montage construction and cache fill all run when the resource is *activated*. For an application that already knows which recording comes next, that cost can be moved to a moment where the user is looking at something else:

```ts
const next = await app.loadStudy('eeg/edf-url', nextUrl)
await next.preload()          // allocate, build montages, fill the cache — without activating
// …later, when the user is ready:
runtime.setActiveResource(next)   // now costs a redraw rather than a load
```

`preload()` is idempotent and does not make the resource visible; activating it afterwards finds the work done and skips it. A recording that is never preloaded behaves exactly as before, so this is an optimisation to reach for in queued-review workflows (one recording after another, in a known order), not something a general viewer needs.

> **Note:** `preload()` holds a second recording's buffer and worker for as long as it is queued. Release a queued recording you decide not to show — `dataset.removeResource(resource)` followed by `resource.destroy()` — rather than letting it accumulate.

### 9. Listing a study without loading it (optional)

A loaded study holds its reader, and with shared memory a worker, so an application that opens a few hundred recordings at once runs out of threads before the user has looked at any of them. A host that already knows what a set contains can list each study instead and let the viewer load it when it is opened (core 2.4.0 and later):

```ts
const resource = app.listStudy({
    loader: 'edf',
    name: 'Recording 12',
    source: 'https://example.com/recording-12.edf',
    properties: [['duration', 1200], ['signals', 21]],
    onLoad: async (resource) => {
        // Runs beside the read of the study; the setup waits for it.
    },
})
```

Nothing is fetched and no worker is started. The returned resource is created in its module's own resource class and appears in the navigator under `name` with the `properties` given; its state is `added` and `isListed` is true. `properties` are only displayed and never read for loading, so the host decides whether its values are reliable enough to show. `listStudy` returns `null` when no importer or module matches the study, or its loader cannot list one, and takes the dataset to list in as `{ dataset }`, by default the active one.

Activating the resource, in the interface or with `setActiveResource`, loads it, and so does calling its `load`:

```ts
const loaded = await resource.load()
```

The study is read as `loadStudy` would read it and the setup finishes on the same object, so a reference to the resource stays valid: its `state` goes from `added` through `loading` to `ready`, or to `error` with an `errorReason`, and `retryLoad` loads a failed one again. Calls made while a load is running share it, and reads through one importer run one at a time. A listing's `onLoad` is called with the resource as the load reads the study and runs beside the read, and the setup waits for it, so what it gives the resource, such as a trusted interruption table, is there when the setup looks for it.

Given `{ parent }` instead of a dataset, `listStudy` lists the study as one of that resource's `childResources`, such as a study attached to a recording, and the child is destroyed with its parent.

A dataset built from a data source that only names its files lists every study and starts loading up to `app.eagerStudyLoadLimit` of them (default 50); the rest load when they are opened.

## Embedding with a `ViewerPlugin`

The Epicurrents platform embeds the viewer in its own frontend, and a platform project or plugin injects its behaviour through a `ViewerPlugin` object that hooks into the viewer lifecycle without modifying core code. `ViewerPlugin` is a platform type (`frontend/src/projects/types.ts`), not part of the viewer packages. Its viewer hooks are:

```ts
interface ViewerPlugin {
    // Merged into the setup passed to createEpicurrentsApp(), over the base setup the platform builds
    extraSetup?: Record<string, unknown>

    // Called once createEpicurrentsApp() has resolved and the event bus is available, before any
    // study loads — use to register event listeners, export targets or context menu actions
    onAppReady?: (epic: EpicurrentsApp, bus: EventTarget) => void | Promise<void>

    // Called once the studies loaded up front are ready, in the order they were passed to the
    // viewer. Studies that are only listed are not included
    onStudiesReady?: (epic: EpicurrentsApp, studies: DataResource[]) => void | Promise<void>
}
```

The interface also carries the platform-side extensions — routes, navigation links, icons, a `viewerPanel` overlay component, annotation code metadata and session resolution. A project supplies its plugin as the `plugin` export of its frontend entry (`projects/<name>/frontend/index.ts`), which the build selects from `VITE_PROJECT`. A platform plugin exports one the same way, and the enabled plugins named in `VITE_PLUGINS` are combined by `mergePlugins` (`frontend/src/plugins/base.ts`): setups are merged in order, hooks are chained and each awaited in turn. The viewer view runs the plugins' hooks before the project's, and merges the project's `extraSetup` last, so the project has the last word.

```ts
import type { ViewerPlugin } from '#projects/types'

export const plugin: ViewerPlugin = {
    onAppReady (epic, bus) {
        bus.addEventListener('property-change:activeResources', onResourceChanged)
    },
}
```

## Storing user settings on a backend

User-definable settings are kept on the device by default: session storage always, and local storage as well once the user has enabled the settings cookie. That copy belongs to one browser on one machine, which is the wrong granularity when the same person works from whichever workstation is free.

Setting `app.userSettingsBackend` to an address turns on a second, account-level copy. The host normally passes it in the setup object rather than writing the setting directly, because the interface reads it while loading modules — before the host regains control:

```ts
await createEpicurrentsApp({
    assetPath: '/viewer',
    userSettingsBackend: '/api/v1/user/preferences?scope=viewer',
})
```

The address must answer `GET` with `{ "settings": { "<module>.<field>": value } }` and accept the same shape on `PUT`. Requests carry same-origin credentials, and a `csrftoken` cookie — if one is present — is echoed in an `X-CSRFToken` header, which covers the common session-authenticated backend without the viewer needing to know anything else about it.

Behaviour once it is set:

- **At startup** the stored settings are applied *after* the device copy, so the account wins. A setting changed on another machine is found that way here rather than being overridden by whatever this browser had stored from an earlier session.
- **On every change** the full settings map is written back, debounced by a second so a burst of adjustments costs one request.
- **Only user-definable fields** cross the wire in either direction; the same `_userDefinable` check that guards local storage guards this, so a misconfigured backend cannot reach a setting the user could not set anyway.
- **Failures are quiet.** A backend that cannot be reached is logged and ignored, and the device copy carries on as before — a settings mirror must never be what stops the viewer from opening. Both requests carry a five-second timeout, because a hanging connection would stall startup in a way a failing one does not.
- **Nothing is written before a read succeeds.** A write replaces the stored map wholesale, so writing from a local picture that was never populated would delete everything the user has stored from another machine. Until the startup read succeeds, changes stay on the device only.
- **Values are checked before they are sent.** The write is all-or-nothing, so one value the backend rejects would take every other setting with it and keep doing so for the rest of the session. A value outside the contract — anything that is not a primitive or a short flat list of them — is dropped client-side with a warning instead.

Leaving the setting empty (its default) keeps everything on the device and makes no network requests.

## Standalone viewer

An edition build writes, under `dist/<edition>/`, the embeddable library (`epicurrents-lib.*`, for mounting into a host page) together with an `index.html` that makes the same directory servable as a standalone viewer. The workers are inlined into the library, so the directory is everything the viewer needs and can be served from any static web server; serve it with the headers below to enable shared memory. See [Building the application](docs/building-the-application).

## Cross-origin isolation and SharedArrayBuffer

The `useSAB` setup option (on by default), which sets the `app.useMemoryManager` setting, enables zero-copy signal transfer between the format worker, the montage worker, and the main thread via `SharedArrayBuffer`. This requires the page to be served with the following HTTP headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Without these headers, or on browsers that do not support `SharedArrayBuffer`, the application falls back transparently to copying signal data through the JS heap. The fallback is slightly slower for large montages but otherwise fully functional.
