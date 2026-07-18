[[toc]]

## Overview

Epicurrents is not a single application but a set of independently versioned packages published under the `@epicurrents` namespace. A working application is *assembled* from the packages you choose: the core runtime, one or more file readers, one or more study modules, and optionally analysis services and the default interface.

The [app workspace repository](https://github.com/epicurrents/app) is the tool for that assembly. It is a thin orchestration layer — a small set of Node.js scripts plus an npm workspace configuration — that clones the chosen packages, builds them in the correct dependency order, and bundles them into the interface application. You do not edit signal-processing or UI code in the workspace repository; that code lives in each package's own repository. The workspace only decides *which* packages are combined and *how* they are built together.

This page describes building a modular application from source. For installing a prebuilt viewer, see [Installation](docs/getting-started/installation). For the internal architecture of the workspace, see [Development](docs/development).

## The dependency model

Every package depends on `@epicurrents/core`, and several also depend on the shared utility packages (`asymmetric-io-mutex`, `scoped-event-bus`, `scoped-event-log`). Because each package is built independently, npm places a private copy of those shared packages inside each package's `node_modules`.

If those private copies are left in place, different parts of the application can be built against **different versions of the same shared code**. This type-checks locally but corrupts data at runtime, because the worker bundle and the main-thread bundle disagree on data layouts or API shapes. The workspace therefore *cleans* the nested copies after installing, forcing every package to resolve the single workspace-level version.

The practical consequence: whenever you install or remove a package inside a submodule, you must clean again before rebuilding. The setup script does this automatically; a manual install does not.

## Prerequisites

- Node.js 22.12+ (Active LTS) and npm 10+. The interface builds with Vite 7, which requires Node `^20.19.0 || >=22.12.0`, and the build scripts use `import.meta.dirname` (Node 20.11+); pinning to Node 22 avoids the awkward sub-20.19 gap. The root `package.json` enforces this through its `engines` field.
- git with access to the package repositories.
- yarn — only for the optional OHIF radiology integration.
- A Chromium-based browser to run the viewer.

## Building from scratch

```bash
git clone <app-workspace-url> app && cd app
npm run setup        # clone + install + clean + build every configured package
npm run start        # copy worker bundles and launch the dev server
```

`npm run setup` reads the package list, clones each repository, checks out any pinned branch, installs dependencies, removes the duplicated shared packages, and builds each package in dependency order (utilities first, then `core`, then the rest).

To produce a deployable build instead of running the dev server, first build the packages, then bundle the interface in one of two ways:

```bash
npm run build:assets   # build util + interface + all epicurrents packages
npm run build:lib      # bundle the interface as an embeddable library (the modular use case)
npm run build:app      # bundle a self-contained standalone application
```

`build:lib` is the primary output for a modular Epicurrents frontend: it builds the interface as a consumable library that a host application imports and mounts, so you embed the viewer — with only the modules selected in `scripts/env.mjs` — into your own page or product. `build:app` instead produces a self-contained viewer for deploying on its own.

## Selecting the packages

The package list is defined in `scripts/env.mjs` as the exported `packages` map. Each top-level key is both a logical group and the directory the group is cloned into. Edit this map to add, remove, or pin the packages your application needs.

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
            { name: 'core' },                          // must be built first
            { name: 'eeg-module' },
            { name: 'edf-reader', branch: 'feat/dev' }, // pin a specific branch
            // add or remove packages here
        ],
        repository: 'https://github.com/epicurrents',
    }],
    // interface and ohif groups follow
])
```

Each package descriptor accepts:

| Field | Type | Meaning |
|---|---|---|
| `name` | string (required) | Folder / package name to clone. |
| `branch` | string | Git branch to check out (defaults to `main`). |
| `repository` | string | Override the group's base repository URL for this package. |
| `prebuild` | string[] | Shell commands run inside the package folder before building. |
| `rename` | boolean | Rename the cloned folder to the map key. |
| `external` | boolean | Skip automatic install/build (managed manually, e.g. OHIF). |

Two ordering rules are load-bearing: the `util` group must build before `epicurrents`, and `core` must be the first entry in the `epicurrents` group because every other package depends on it.

## Scoping commands

The workflow commands accept an optional scope after `--`, so you can operate on a single group or a single package:

```bash
npm run setup -- util                    # only the utility packages
npm run setup -- epicurrents             # only the epicurrents group
npm run setup -- epicurrents/edf-reader  # a single package
npm run update -- epicurrents            # pull the latest for one group
```

## Command reference

| Command | Purpose |
|---|---|
| `npm run setup` | Clone (or fetch), check out, install, clean, and build each package. |
| `npm run instl` | Run `npm install` in each already-cloned package. |
| `npm run clean` | Remove duplicated shared packages nested in each package's `node_modules`. |
| `npm run build:asset` | Build already-cloned packages (accepts a scope). |
| `npm run build:assets` | Build util, interface, and all epicurrents packages. |
| `npm run update` | `git pull` each package and re-check out its pinned branch. |
| `npm run copy:workers` | Copy compiled worker bundles into the interface. |
| `npm run typecheck` | Run `tsc --noEmit` over every library package. |
| `npm run start` | Copy workers, then launch the interface dev server. |
| `npm run build:app` | Build the standalone interface application. |
| `npm run build:lib` | Build the interface as a consumable library. |

## Keeping packages up to date

```bash
npm run update           # pull every package and re-check out its pinned branch
npm run clean            # remove any freshly reintroduced duplicate copies
npm run build:assets     # rebuild
```

Always run `clean` after an update or a manual install, then rebuild, so the whole application resolves one consistent version of each shared package.

## Optional OHIF radiology integration

OHIF is configured as an `external` package: the setup script clones it but does not build it automatically, because it uses yarn and its own toolchain. Build it into the interface with:

```bash
npm run build:ohif:dev
```

## Where to go next

- [Development](docs/development) — the workspace internals, testing, and type-checking.
- [Library structure](docs/library-structure) — the full package catalogue.
- [Memory management](docs/memory-management) — how signal data moves between workers.
