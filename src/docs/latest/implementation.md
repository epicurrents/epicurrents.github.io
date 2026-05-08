[[toc]]

## Overview

Epicurrents is distributed as a set of npm packages under the `@epicurrents` namespace. The core package provides the runtime, state management, and base types. Modality support (EEG, EMG, etc.), file readers (EDF, DICOM, etc.), and optional services (Python, ONNX) are separate packages that you register at startup — none of them are required, and you include only what your application needs.

All packages are written in TypeScript and publish type declarations. They can be used in any modern bundler (Vite, Webpack, esbuild).

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
npm install @epicurrents/pyodide-service   # Python-in-browser (spectral analysis, topomaps)
npm install @epicurrents/onnx-service      # ONNX machine learning inference
```

The default viewer interface is a separate package that wraps all the modules into a ready-to-use Vue 3 application:

```bash
npm install @epicurrents/interface
```

## App lifecycle

Initialising an Epicurrents application always follows the same sequence regardless of which modules you use.

### 1. Instantiate

```ts
import { Epicurrents } from '@epicurrents/core'

const app = new Epicurrents({
    containerId: 'viewer',   // id of the DOM element to mount the interface into
    useSAB: true,            // use SharedArrayBuffer for zero-copy inter-thread signal transfer
})
```

The constructor sets three globals on `window`:

```ts
window.__EPICURRENTS__ = {
    APP:       app,             // the Epicurrents instance
    EVENT_BUS: app.eventBus,   // the typed application event bus
    RUNTIME:   app.runtime,    // the RuntimeStateManager
}
```

These globals are used by external components (e.g. project-specific panels embedded alongside the viewer) to subscribe to viewer events without being inside the viewer's own module graph. See [Platform integration](docs/getting-started/platform-integration) for patterns.

### 2. Register modules

Register a study module for each modality you want to support. Each module knows how to display recordings of one type and contributes its own Vuex actions, Vue components, and settings to the application.

```ts
import { runtime as eegRuntime } from '@epicurrents/eeg-module'

app.registerModule('eeg', eegRuntime)
```

Modules can receive a configuration object to customise their behaviour:

```ts
app.registerModule('eeg', eegRuntime, {
    extraMontages: { 'standard-1020': ['/montages/my-custom.json'] },
    hotkeys: { fft: 'F', examine: 'E' },
})
```

### 3. Register study importers

A study importer ties a file format to a modality. The importer parses the file header and produces a `StudyContext` that the module's study loader then converts into a `DataResource`.

```ts
import { EdfImporter } from '@epicurrents/edf-reader'

app.registerStudyImporter('edf', 'EDF/BDF recording', 'eeg', new EdfImporter())
```

You can register multiple importers for different formats, all pointing to the same module, or to different modules.

### 4. Register services (optional)

Services provide optional capabilities that run in a separate web worker — Python evaluation via Pyodide, ONNX inference, etc. They are loaded on demand and the application works without them if they are not registered.

```ts
import { PyodideService } from '@epicurrents/pyodide-service'

app.registerService('PYODIDE', new PyodideService())
```

### 5. Register the interface

Pass the interface constructor to the application. The interface is not instantiated until `launch()` is called.

```ts
import { DefaultInterface } from '@epicurrents/interface'

app.registerInterface(DefaultInterface)
```

### 6. Launch

```ts
await app.launch()
```

`launch()` creates the interface instance, mounts the Vue application into the container element, sets up the memory manager (if `useSAB` was enabled and cross-origin isolation is available), and resolves once all modules and WebAwesome components are registered and the UI is ready.

### 7. Load a study

```ts
await app.loadStudy('edf', {
    files: [{ url: 'https://example.com/recording.edf', role: 'data', modality: 'eeg' }],
    name: 'Patient 001',
})
```

The first argument is the importer name registered in step 3. The second is a `StudySource` object describing the files. The returned promise resolves once the recording header has been parsed and the resource is in `'ready'` state.

## Embedding with a `ViewerPlugin`

When the viewer is embedded inside a larger application (such as the Epicurrents platform), project-specific behaviour is injected through a `ViewerPlugin` object that hooks into the viewer lifecycle without modifying core code.

```ts
interface ViewerPlugin {
    // Merged into the Epicurrents setup object before launch
    extraSetup?: Record<string, unknown>

    // Called once after app.launch() resolves — use to register extra event listeners,
    // inject settings, or set up panels that live outside the viewer iframe
    onAppReady?(app: EpicurrentsApp, bus: EventBus): void | Promise<void>

    // Called once studies are loaded and ready — use to pre-select a recording
    // or navigate to a specific time position
    onStudiesReady?(app: EpicurrentsApp, studies: StudyContext[]): void | Promise<void>
}
```

The plugin is passed to the viewer mount call:

```ts
mountViewer(containerEl, {
    plugin: {
        onAppReady(app, bus) {
            bus.addEventListener('property-change:activeResources', onResourceChanged)
        },
    },
})
```

## Standalone HTML file

The interface can also be built as a single self-contained HTML file for offline use. Load it directly in a browser — no server required. Some features (federation, push notifications, remote API sources) are unavailable without network access, but local file opening and all analysis tools work.

## Cross-origin isolation and SharedArrayBuffer

`useSAB: true` enables zero-copy signal transfer between the format worker, the montage worker, and the main thread via `SharedArrayBuffer`. This requires the page to be served with the following HTTP headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Without these headers, or on browsers that do not support `SharedArrayBuffer`, the application falls back transparently to copying signal data through the JS heap. The fallback is slightly slower for large montages but otherwise fully functional.
