[[toc]]

## Overview

Epicurrents is a set of independently versioned packages: the core runtime, file readers, study modules, optional services, and the Vue interface. A working viewer is assembled from a selection of them, and the [builder repository](https://github.com/epicurrents/builder) does the assembling.

The builder holds no signal-processing or UI code. It is a set of Node.js scripts and an npm workspace that clone the packages, build them in dependency order, and bundle a chosen *edition* — a named selection of modalities and readers — into an embeddable library and a standalone viewer. Releases are cut per edition.

This page covers building editions from source. For installing a prebuilt viewer, see [Installation](docs/getting-started/installation); for embedding the library in your own page, see [Implementation](docs/implementation); for working on the packages themselves, see [Development](docs/development).

## Prerequisites

- Node.js 22.12 or newer and npm 11 or newer, as declared in the `engines` field of the builder's `package.json`. Node 22 ships with npm 10, so either upgrade npm or use Node 24, which the repository's `.nvmrc` names.
- git, with access to the package repositories you build. The default selection needs only public repositories.
- yarn, only for the optional [OHIF integration](#optional-ohif-radiology-integration).
- A Chromium-based browser to run the viewer.

## Setting up the workspace

```bash
git clone https://github.com/epicurrents/builder.git && cd builder
npm run setup
```

`npm run setup` runs in three phases. It clones every selected package (or fetches it if already present) and checks out its branch, then runs one `npm install` at the workspace root, then builds each package in registry order: the utility packages, `core`, the packages that depend on core, and the interface. Installing once, after every package is present, is what lets the committed root `package-lock.json` describe the whole tree.

Without arguments, setup selects every package published from a public source. Options go after `--`; placed before it, npm takes them as its own configuration and they never reach the script.

| Argument | Effect |
|---|---|
| `util`, `epicurrents`, `interface` | Restrict the run to one group. |
| `epicurrents/<package>` | Restrict the run to one package. |
| `--profile <name>` | Restrict the run to the packages of one [edition](#editions). |
| `--include-private` | Also select packages without a public repository, for a maintainer with access to them. |
| `--include-external` | Also clone `external` packages (OHIF). They are cloned only, never installed or built. |
| `--manifest <file>` | Check out the exact commits a [manifest](#manifests-and-reproducibility) pins instead of branch heads. |
| `--frozen-lockfile` | Install with `npm ci`, resolving nothing the committed lock does not already pin. |

```bash
npm run setup -- --profile eeg
npm run setup -- epicurrents/edf-reader
npm run setup -- --manifest eeg-1.2.3.manifest.json
```

Both `--option value` and `--option=value` are accepted. A scope that matches no package is an error rather than an empty success.

`--frozen-lockfile` requires the lock to describe exactly the workspace on disk. The committed lock covers every public package, so the flag works on a default setup and fails on a tree that also carries packages without a public repository.

To pull later changes, run `npm run update` (accepts the same scopes and `--profile`) and rebuild with `npm run build:asset`. If any install runs afterwards, follow it with `npm run clean`; see [Development](docs/development#nested-copies-of-shared-packages) for why.

## The package registry

Every package the builder knows about is listed in `scripts/env.mjs`, in the exported `packages` map. Each key is a group and the directory the group is cloned into: `util`, `epicurrents`, `interface` and `ohif`.

```js
export const packages = new Map([
    ['util', {
        packages: [
            { name: 'scoped-event-log' },
            { name: 'scoped-event-bus' },
            { name: 'asymmetric-io-mutex' },
        ],
        repository: 'https://github.com/sam-19',
    }],
    ['epicurrents', {
        packages: [
            { name: 'core' },
            { name: 'eeg-module' },
            { name: 'edf-reader' },
            // ...
        ],
        repository: 'https://github.com/epicurrents',
    }],
    // interface and ohif follow
])
```

A package descriptor accepts these fields:

| Field | Type | Meaning |
|---|---|---|
| `name` | string (required) | Folder and repository name to clone. |
| `branch` | string | Branch to check out. Defaults to `main`. |
| `repository` | string | Overrides the group's repository URL for this package. |
| `build` | string | Build command. Defaults to `npm run build`. |
| `prebuild` | string[] | Commands run before the package is built. |
| `rename` | boolean | Clone into a folder named after the map key, for a repository whose name differs. |
| `external` | boolean | Not a workspace member. Cloned into the builder root only with `--include-external`, and installed and built by hand. |
| `public` | boolean | Whether the package is published from a public source. Defaults to `true`. |

Order is significant: `util` builds before `epicurrents`, and `core` is the first entry of `epicurrents` because every other package depends on it.

The `public` flag is what keeps a fresh clone buildable without credentials. The default setup skips `public: false` packages, and a public profile may not name one. It is only as accurate as the data, so it has to match each repository's actual visibility.

## Editions

An edition is defined by three things:

1. The registry in `scripts/env.mjs`, listing every package available.
2. A profile in `profiles/<name>.mjs`, choosing which of those packages the edition includes and how its viewer is set up.
3. The registrars in `setup/`, which register each modality's module, readers and interface UI on the application at runtime.

### Profiles

A profile default-exports an object:

```js
export default {
    label: 'EEG',
    packages: [
        'eeg-module',
        'edf-reader',
        'dicom-reader',
        'pyodide-service',
    ],
    setup: {
        activeModules: ['eeg'],
    },
}
```

- `packages` names registry entries. `core`, the `util` group and the interface are always included, so a profile lists only what its edition adds.
- Every profile includes `pyodide-service`. The setup entry imports its registrar statically, so the package must be installed for the edition to build, even though a session only starts the service on request (`?services=pyodide` or `?advanced`).
- `setup` is the viewer configuration injected into the bundle. Its `activeModules` lists the modality keys whose registrars run, which are the keys in `setup/registry.ts` (`eeg`, `emg`, `audio`, `video`, `image`, `pdf`, `htm`, and others).

The builder ships two public profiles: `eeg` (EEG with EDF/BDF and DICOM sources) and `full` (every modality buildable from public packages).

### Public and local profiles

Profiles in `profiles/` are committed and public. A public profile that names a package marked `public: false` fails to load, which keeps every committed edition buildable from public sources.

Profiles in `profiles/local/` are git-ignored. Use them for an edition that needs packages without a public repository, or one you do not want to publish. The loader looks in `profiles/` first and `profiles/local/` second, so a local profile cannot shadow a public one of the same name; give local profiles their own names.

### Trimming

`setup/registry.ts` statically imports every registrar. When a profile lists `activeModules`, the library build replaces that file with a registry importing only the listed registrars, and the bundler drops the rest together with their modules, readers and workers. An edition contains only what it names.

List `activeModules` explicitly. An empty list means every registrar, and some registrars compose packages without a public repository. The bundler has to resolve a static import before it can drop it, so an untrimmed build only succeeds in a tree that has every package installed.

## Building an edition

```bash
npm run build:edition -- --profile eeg
EPI_PROFILE=eeg npm run build:edition
```

The two forms are equivalent. The build writes to `dist/<edition>/`:

- `epicurrents-lib.*` and its stylesheet: the trimmed, embeddable library for mounting the viewer in a host page, as described in [Implementation](docs/implementation#standalone-viewer).
- `index.html`: a page that loads the library and boots it, which makes the directory servable as a standalone viewer.

Workers are inlined into the library and started from `blob:` URLs, so the directory is the whole deployment. A host whose content security policy forbids `blob:` workers has to serve each package's standalone worker bundle and register it instead; the packages' own notes describe how.

Before bundling, the build runs `npm run check:deps`, which fails if `@epicurrents/core` or a shared utility resolves to more than one installed copy. With no profile, the build registers every modality into `dist/default/`, which needs every package installed. The `ASSET_PATH` environment variable sets the base path the library is served from, defaulting to `/`.

`npm run build:edition:lib` runs the library step alone, without writing `index.html`.

## Manifests and reproducibility

`npm run build:release` is `build:edition` plus a manifest: `dist/<edition>/manifest.json` records the edition, its version (from `EPI_VERSION`), the builder's own repository and commit, and the repository, branch and exact commit of every package the edition used.

```bash
npm run setup -- --manifest dist/eeg/manifest.json
```

checks those commits back out, detached, and builds from them.

A manifest pins sources. The dependency graph is pinned by the committed root `package-lock.json`, and the lock that built an edition is the one in the builder commit the manifest records. A build is reproducible from the two together: check out the recorded builder commit, then set up from the manifest. A manifest on its own reproduces the first-party code but not necessarily the third-party versions, and leaves any selected package the manifest does not name at its branch head.

## Releases

Pushing a tag of the form `<edition>-v<major>.<minor>.<patch>` (for example `eeg-v1.2.3`) to the builder repository runs `.github/workflows/release.yml`. The workflow:

1. Refuses a tag that does not point at a commit on `main`.
2. Runs `npm run setup -- --frozen-lockfile`, cloning every public package from its `main` branch with no credentials.
3. Runs `npm run build:release` with `EPI_PROFILE` and `EPI_VERSION` taken from the tag.
4. Attaches `<edition>-<version>.zip` (the contents of `dist/<edition>/`) and `<edition>-<version>.manifest.json` to a GitHub release.

Only public editions can be released. A profile in `profiles/local/` is not in the CI checkout, a public profile cannot name a non-public package, and packages marked `public: false` are skipped rather than cloned.

If a public package changes its dependencies after the lock was written, the release fails at `npm ci`. Regenerate the lock in a checkout holding exactly the public packages (a fresh clone followed by `npm run setup`) and commit it.

## Source localisation lead fields

The EEG edition's source-localisation tool needs a pre-computed lead field, which editions do not include. Without one the tool reports every montage as unavailable. To enable it, take a `leadfields-*.zip` asset from the lead-field release and unpack it beside `index.html`:

```bash
unzip leadfields-standard_1020-free-7.5mm.zip -d dist/eeg/
```

This produces `dist/eeg/leadfields/`, holding a `manifest.json` and a content-hashed `.bin`, which the tool finds on its own. A page embedding the library can supply its own `leadFieldProvider` in the `eeg` module configuration instead, and the bundled files are then not consulted.

## Interface development builds

The edition build is the release path. A second set of commands serves development of the interface itself, through its Vite dev server:

| Command | What it does |
|---|---|
| `npm run build:asset` | Build already-cloned packages. Accepts scopes and `--profile`. |
| `npm run build:assets` | Build the `util`, `interface` and `epicurrents` groups. |
| `npm run copy:workers` | Copy the packages' standalone worker bundles from their `umd/` directories into `interface/dist/workers/`, where the dev server loads them. |
| `npm run start` | `copy:workers`, then start the interface dev server. |
| `npm run build:app` | Build the interface's own standalone app, which registers every module through the interface's example setup rather than a profile. |
| `npm run build:dev` | `build:assets`, the OHIF build, every copy step and `build:app` in one. |

Running your own setup on the dev server is described in [Development](docs/development#running-a-setup-on-the-dev-server).

## Optional OHIF radiology integration

OHIF is an `external` package with its own yarn toolchain. Clone it with `npm run setup -- ohif --include-external`, then build it into the interface with:

```bash
npm run build:ohif:dev
```

## Adding a modality

A new modality needs changes in the builder and, usually, in one or more package repositories.

1. Add each package to the registry in `scripts/env.mjs`, with `public: false` if its repository is not published.
2. For each package that ships a worker and does not inline it itself, add `setup/workers/<package>.ts`, importing only that package. One module per package is what lets trimming drop a reader: a shared module importing every worker would make every edition require every reader. A package that inlines its own workers, as `core` does, needs no factory and no `workerPaths` entry.
3. Add `setup/modules/<key>.ts`, a registrar that composes the core module, its study importers and the interface UI module. Import only what this modality needs.
4. Register the key in `setup/registry.ts`.
5. Add the packages and the `activeModules` key to the profiles that should ship the modality, together. A package in a profile without a registrar is cloned and built but registers nothing.

A reader without a public repository may not be named in `setup/modules/`, since any public profile activating that modality would then have to resolve it. Register such a reader from a local setup instead.

## Command reference

| Command | What it does |
|---|---|
| `npm run setup` | Clone or fetch, check out, install once at the root, and build the selected packages. |
| `npm run update` | `git pull` each cloned package and re-check out its configured branch. |
| `npm run instl` | Run `npm install` in each cloned package. |
| `npm run clean` | Delete nested copies of the shared packages inside each package's `node_modules`. |
| `npm run check:deps` | Fail if a shared package resolves to more than one installed copy. |
| `npm run build:edition` | Build an edition into `dist/<edition>/`. |
| `npm run build:edition:lib` | Build only the edition's library. |
| `npm run build:release` | `build:edition` plus the manifest. |
| `npm run typecheck` | Type-check the library packages. |
| `npm run test` | Run every workspace package's test script. |
| `npm run test:e2e` | Run the browser tests against a built edition. |

The scripts accept scopes and `--profile` as described in [Setting up the workspace](#setting-up-the-workspace).

## Where to go next

- [Development](docs/development): working on packages, type checking, tests and contributing.
- [Library structure](docs/library-structure): the package catalogue.
- [Implementation](docs/implementation): embedding the built library.
