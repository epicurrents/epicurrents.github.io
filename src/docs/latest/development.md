[[toc]]

## Repository structure

The viewer lives inside `frontend/viewer/` within the platform repository. It is structured as an npm workspace pseudo-monorepo — each `@epicurrents/*` package is an independent workspace member with its own `package.json` and TypeScript configuration.

```
frontend/viewer/
  epicurrents/        domain packages (one directory per npm package)
    core/
    edf-reader/
    eeg-module/
    emg-module/
    ncs-module/
    doc-module/
    tab-module/
    dicom-reader/
    htm-reader/
    wav-reader/
    pdf-reader/
    api-reader/
    onnx-service/
    pyodide-service/
  interface/          Vue 3 application that assembles all packages
  util/               standalone utility packages
    asymmetric-io-mutex/
    scoped-event-bus/
    scoped-event-log/
  ohif/               OHIF radiology viewer integration
  scripts/            build, install, copy, and update helpers (Node.js)
```

Each package under `epicurrents/` corresponds to an independently maintained git repository. The `frontend/viewer/epicurrents/` directory is a collection of these packages checked out together for integrated development. In a published deployment, they would be installed from npm.

## Building

The root `package.json` in `frontend/viewer/` orchestrates the build:

```bash
# Build utility packages + all epicurrents packages + the interface bundle
npm run build:assets

# Build the final interface application (depends on build:assets being done first)
npm run build:app

# Full build in one command
npm run build
```

The `scripts/` directory contains Node.js helpers for installing, copying type declarations between packages, and updating dependency versions across the workspace.

## Testing

Tests use [Vitest](https://vitest.dev/). Each package with tests has its own `vitest.config.ts`; test files live under `tests/` and are named `*.test.ts`. Only three packages currently have test suites: `core` (48 suites), `eeg-module` (10 suites), and `tab-module` (1 suite).

```bash
# Run tests for a specific package (from the package directory)
cd epicurrents/core && vitest run

# Run with coverage
vitest run --coverage

# From the workspace root
npm run test:core
npm run test:eeg
npm run test:tab
```

### How the test configuration works

The `package.json` `imports` field in `core/` maps `#*` aliases to `src/` files (not `dist/`). This is what makes tests run against TypeScript source rather than the compiled output. The build step (`tsconfig-replace-paths`) rewrites all `#` aliases in emitted JS before they become part of the dist, so this setting has no effect on published packages.

Each package's `vitest.config.ts` configures the same alias resolution for Vite's module graph. The `eeg-module` additionally redirects `@epicurrents/core` to a mock implementation under `tests/mocks/` to keep unit tests isolated from core internals.

### Adding tests to a new package

1. Copy `vitest.config.ts` from `core/` or `eeg-module/` and update the path aliases.
2. Create a `tests/` directory with `*.test.ts` files.
3. Add `"test:unit": "vitest run --coverage"` to the package's `scripts` in `package.json`.
4. If the package uses `#` path aliases, ensure the `package.json` `imports` field points to `src/` rather than `dist/`.

## Type-checking

After any change to `epicurrents/core/` (types, base class signatures, interface definitions), run a type-check sweep across all dependent packages to catch regressions before building:

```bash
cd frontend/viewer/epicurrents
for pkg in core api-reader dicom-reader doc-module edf-reader eeg-module emg-module \
           htm-reader ncs-module onnx-service pdf-reader pyodide-service tab-module wav-reader; do
    result=$(cd "$pkg" && npx tsc --noEmit 2>&1)
    if [ -z "$result" ]; then
        echo "✓ $pkg"
    else
        echo "✗ $pkg"
        echo "$result" | head -5
    fi
done
```

`tsc --noEmit` type-checks each package without emitting files or running any copy/replace steps, so it runs quickly. Two packages have pre-existing type errors that are unrelated to core changes — treat them as baseline noise and do not investigate unless you changed something in their area:

| Package | Error | Cause |
|---|---|---|
| `emg-module` | `TS6196: 'AnnotationLabel' is declared but never used` | Unused import in the EMG module; cosmetic, not a logic error |
| `onnx-service` | `TS2339` on `awaitAction`, `_setPropertyValue`, `dispatchPropertyChangeEvent` | Class hierarchy issue in the ONNX service; does not affect runtime behaviour |

Any error appearing in a package that was previously clean indicates a regression introduced by your change.

## Known issues

### `GenericAsset.configure` skips prototype-defined setters

`configure()` in `epicurrents/core/src/assets/GenericAsset.ts` is intended to apply a plain-object configuration to an asset instance by calling each property's setter. It uses `Object.getOwnPropertyDescriptor(target, key)` to look up the setter, but class `get`/`set` accessors are defined on the **prototype**, not on the instance — so this call always returns `undefined` for them, the setter is never called, and a warning is logged.

The fix is to walk the prototype chain:

```ts
let proto = Object.getPrototypeOf(target)
let descriptor: PropertyDescriptor | undefined
while (proto && !descriptor) {
    descriptor = Object.getOwnPropertyDescriptor(proto, key)
    proto = Object.getPrototypeOf(proto)
}
const propertySetter = descriptor?.set
```

This is a sweeping change that touches `GenericAsset` and every subclass that calls `configure()`. Once the fix is in place, all setter-level guards (such as the `locked` guard in `GenericAnnotation`) will apply correctly, because every affected setter routes through `_setPropertyValue`.

Until the fix lands, do not rely on `configure()` to set properties defined as class accessors — call the setters directly instead.

## Contributing

Individual `@epicurrents/*` packages are maintained in their own repositories. To contribute to a package:

1. Fork the relevant package repository.
2. Make changes and verify with `npx tsc --noEmit` inside the package directory.
3. Copy the package directory into `frontend/viewer/epicurrents/<package>/` to test it against the full interface.
4. Open a pull request to the package repository.
5. Once merged and published, update the version reference in the platform repository.
