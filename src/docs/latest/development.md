[[toc]]

## Workspace layout

Development happens in a checkout of the [builder](https://github.com/epicurrents/builder), set up as described in [Building the application](docs/building-the-application#setting-up-the-workspace). The builder tracks only its own tooling; every package is a separate git checkout in a git-ignored directory.

```
builder/
  scripts/            setup, build, clean, copy, update, profile, manifest and typecheck scripts
  setup/              the edition build entry
    index.ts          creates the app and runs the active edition's registrars
    registry.ts       modality key → registrar
    modules/          one registrar per modality
    workers/          one worker factory module per package that does not inline its own workers
    services/         service registrars
  profiles/           edition definitions; profiles/local/ is git-ignored
  e2e/                Playwright tests of built editions (a separate npm package)
  vite.config.lib.ts  the edition library build, including registry trimming
  .github/workflows/  the release workflow
  util/               the shared utility packages (cloned)
  epicurrents/        the @epicurrents/* packages: core, readers, modules, services (cloned)
  interface/          the Vue 3 interface (cloned)
  ohif/               the OHIF viewer, only with --include-external (cloned)
  dist/               built editions
```

The workspace members are `util/*`, `epicurrents/*` and `interface`. The [library structure](docs/library-structure) page describes what each package does.

## Working on a package

Each directory under `util/`, `epicurrents/` and `interface/` is a clone of that package's repository, on its configured branch. Edit, commit and push there as in any repository.

Setup installs the workspace once at the root, which links every member into the root `node_modules`. A package that depends on `@epicurrents/core` therefore resolves the checkout in `epicurrents/core/`, and sees changes to it once core is rebuilt. Rebuilding a package does not rebuild the packages that embed it, so after a core change rebuild the dependents too:

```bash
npm run build:asset -- epicurrents/core
npm run build:asset -- epicurrents
```

A package with a worker emits two artifacts, the standalone bundle in `umd/` and the `dist/` build carrying the same worker inlined. `npm run build` inside the package produces both; rebuilding only one leaves a mismatch the type system cannot see.

### Nested copies of shared packages

Every package declares `@epicurrents/core` and the shared utilities (`asymmetric-io-mutex`, `scoped-event-bus`, `scoped-event-log`) as dependencies. An install that does not resolve them to the workspace members puts a private copy inside the package's own `node_modules`, and the package is then built against that copy. A worker and the main thread built against different copies can disagree on buffer layouts or API shapes while every type check passes, and the result is corrupted data at runtime.

Setup deletes these copies as it builds each package. Anything that installs afterwards can bring them back: `npm install` inside a package, `npm run instl`, or a root `npm install` while some package declares a version range the workspace checkout does not satisfy. Remove them with:

```bash
npm run clean
npm run clean -- --include-private
```

The second form also reaches packages without a public repository, which the default selection leaves alone. To confirm nothing is left:

```bash
find epicurrents interface -type d \
    \( -path "*/node_modules/@epicurrents" \
    -o -path "*/node_modules/scoped-event-*" \
    -o -path "*/node_modules/asymmetric-io-mutex" \)
```

Two symptoms point at a nested copy. `TS2339` on a method that exists on a core base class is a stale nested core shadowing the workspace link. `TS2307` reporting that types exist under `epicurrents/<package>/node_modules/@epicurrents/core/` but cannot be resolved under the current `moduleResolution` is a registry copy installed because a declared range has gone stale. The fix for both is the clean, after correcting the range in the second case; `moduleResolution` is not the problem.

Releasing a shared package below 1.0 makes consumers' ranges stale on a minor bump, since `^0.3.0` does not admit `0.4.0`. Raise the consumers' ranges once the release is on the registry, then clean, or the copies return with the next install.

`npm run check:deps` asserts that each shared package resolves to a single copy, and the edition build runs it before bundling.

### Running a setup on the dev server

`npm run start` copies the worker bundles into the interface and starts its Vite dev server. The dev server's entry is `interface/src/setups/standalone.ts`, which launches `setups/full.example.ts`, the reference setup registering every bundled module, importer and service. If a `*.local.ts` file sits beside it, that is launched instead.

Everything under `src/setups/` is git-ignored except the framework entry, the standalone entry and the examples, so a local setup stays out of the repository. That makes it the place to register something the example cannot import: the example is built by everyone who checks out the interface, so it names only published packages, while a local setup can name a reader without a public repository, or your own.

A local setup does not have to restate the example's registrations. `registerAllModules` is exported, so a setup can run it and add to the same context:

```ts
import { createEpicurrentsApp as createFrameworkApp, type SetupContext } from '#setups/index'
import { registerAllModules } from '#setups/full.example'

export const createEpicurrentsApp = (config?: ApplicationInterfaceConfig) =>
    createFrameworkApp(config, async (ctx: SetupContext) => {
        await registerAllModules(ctx)
        ctx.app.registerStudyImporter('eeg/my-file', 'Open my format', 'file', myLoader)
    })
```

## Type checking

```bash
npm run typecheck
npm run typecheck epicurrents
npm run typecheck epicurrents/core
```

`scripts/typecheck.mjs` runs `tsc --noEmit` in every `util/*` and `epicurrents/*` package that is present and has a `tsconfig.json`, prints a pass or fail line per package with the first lines of any errors, and exits non-zero if any package failed. A scope restricts it to one group or one package. The interface is a Vue package and is checked by `vue-tsc` in its own build.

Run the full sweep after any change to core types, base classes or method signatures. Every package type-checks clean, so any error is a regression. A dependent type-checks against core's emitted declarations, so rebuild core first or the sweep checks against stale ones.

## Tests

Each package has its own [Vitest](https://vitest.dev/) suite, configured by its `vitest.config.ts`, with test files named `*.test.ts` under `tests/`. A package's `test` script runs `test:unit` (`vitest run --coverage`), and in most packages a `test:types` step before it.

```bash
cd epicurrents/core && npm test
npm run test
npm run test:core
```

`npm run test` at the builder root runs the `test` script of every workspace member that has one. `test:core`, `test:eeg` and `test:tab` run single packages. Vitest prints the number of test files and tests at the end of each run; that summary is the count to read, since suites change with every package release.

Vitest exits non-zero when a package has a `test` script but no test files, which reads the same as a failing suite.

### How the test configuration works

A package's `#*` import aliases are declared in two places that must agree: the `paths` in its `tsconfig.json`, which the editor and `tsc` read, and the `ALIASES` table in its `vite.shared.mjs`, which the library build, the worker build and `vitest.config.ts` all import. The aliases point at `src/`, so tests run against TypeScript source rather than compiled output.

The Vite build resolves every alias while bundling, so `dist/` carries only relative specifiers. Declarations are the exception, since `tsc` emits them with the alias intact; `epicurrents-build-types`, a tool core publishes, rewrites them to relative paths.

The alias entries are regular expressions. A string alias matches only the exact specifier or the specifier followed by a slash, so a bare `#` prefix would never match `#wav/WavReader`. The packages declare no `imports` field, so an alias missing from the table fails to resolve rather than falling through to another mapping.

Some packages, `eeg-module` among them, replace `@epicurrents/core` with a mock under `tests/mocks/` so unit tests do not depend on core internals. Their `test:types` step type-checks the suite against the real core, which catches an assertion that only ever verified the mock.

### Adding tests to a package

1. Copy `vitest.config.ts` from `core/` or `eeg-module/`.
2. Create a `tests/` directory with `*.test.ts` files.
3. Add `"test:unit": "vitest run --coverage"` to the package's scripts, and a `test` script that runs it.
4. If the package uses `#` aliases, add them to both the `tsconfig.json` `paths` and the `ALIASES` table in `vite.shared.mjs`, pointing at `src/`.
5. Add a `tsconfig.test.json` extending the package's own, with `rootDir: "."` and the suite in its `include`, and run it as `"test:types": "tsc --noEmit -p tsconfig.test.json"` ahead of the unit run.

### Browser tests

`e2e/` holds Playwright tests that drive a built edition through its standalone page, menus and file input. It is its own npm package rather than a workspace member, so installing Playwright leaves the root lock alone.

```bash
npm run build:edition -- --profile full
cd e2e
npm install
npm run install:browsers
E2E_EDITION=full npm test
```

`npm run install:browsers` installs Playwright's Chromium and is needed once. `E2E_EDITION` selects the edition under `dist/` to test, and `E2E_PORT` moves the test server off port 4173. `npm run test:e2e` at the builder root runs the same suite. `npx playwright show-report` opens the last run's report.

The server serves the edition with cross-origin isolation headers, so the page runs the SharedArrayBuffer cache an isolated deployment runs. Fixtures are synthetic EDF+ files written at test time, in which every sample is a known function of time; never add a real recording. Tests that need modalities an edition does not register skip themselves.

## Toolchain versions

All `@epicurrents/*` packages and the interface share one toolchain:

| Tool | Version |
|---|---|
| TypeScript | `^5.7.0` |
| Vite | `^7.3.1` |
| tsconfig base | `epicurrents/core/tsconfig.base.json` |

Core extends the base config locally; other packages extend `@epicurrents/core/tsconfig.base.json`, so it also resolves when a package is checked out on its own. Every package builds with Vite and emits declarations with `epicurrents-build-types`.

The versions are shared because drift corrupts data silently. A package compiled with a different TypeScript version can emit declarations that type-check against the rest of the workspace while describing different structures, and the worker and main-thread code then disagree at runtime. Do not pin a package-specific TypeScript version, and do not override `tsconfig.base.json` options in a package without a comment explaining why. After a toolchain bump, rebuild everything and run `npm run typecheck`. The utility packages under `util/` are standalone and do not depend on core, so they are outside this rule.

A dependency floor is set by the API a package uses. After a core release, a package whose imports include something newer than its declared floor raises the floor, once the release is on the registry; a package whose imports all predate its floor keeps it.

## Comment conventions

- Comments and docstrings describe the current contract: what the code does and the invariants it upholds. Change history belongs in commit messages.
- Describe a layer's own guarantee rather than naming a particular caller.
- Every package source file keeps its `@package`, `@copyright` and `@license` header.
- TypeScript source wraps at a 120-column soft cap. `@param` docstrings stay on one line regardless of length, because wrapped ones render poorly in editor hovers.
- Markdown is not hard-wrapped: one line per paragraph.

## Contributing

Each package is its own repository under [github.com/epicurrents](https://github.com/epicurrents), and the builder is another. A change is made in the clone inside the builder workspace and opened as a pull request against that package's repository. A change spanning the builder and a package, such as a new modality, needs a commit and a pull request in each.

1. Fork the repositories you will change, and point the clones in your workspace at your forks, or change the `repository` field for those packages in `scripts/env.mjs` before running setup.
2. Make the change and rebuild the package and its dependents.
3. Run `npm run typecheck` and the package's tests, and build and exercise an edition that includes the package.
4. Commit with `git commit -s`. The repositories follow the Developer Certificate of Origin convention, and every commit carries a `Signed-off-by:` trailer.
5. Open a pull request against each repository you changed.

Package internals are documented in each repository's `AGENTS.md`: core's covers the runtime and worker infrastructure, `edf-reader`'s the reader pattern, `eeg-module`'s the study-module pattern, `pyodide-service`'s the service pattern, and the interface's the Vue application.
