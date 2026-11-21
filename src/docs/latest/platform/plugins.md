[[toc]]

## What a plugin is

A *plugin* is a Django app under `plugins/<name>/` that adds a capability to a deployment without defining what the deployment is for. It sits beside the [project](docs/platform/project-development) rather than replacing it: exactly one project is active per deployment, and zero or more plugins may be enabled alongside it.

A plugin can do what a project can — models, migrations, API endpoints, settings, Celery tasks, management commands, frontend routes and viewer hooks. What it must not do is claim the landing page or the primary navigation, because the project owns those and a plugin has to compose with whichever project is active.

## Plugin or project?

Ask whether the same deployment would plausibly want a different one alongside it. If it would, the thing is a plugin. If it defines what the deployment is for — a teaching workflow, a clinical annotation study — it is a project.

DICOM support is the canonical plugin: a deployment running an EEG project may also want to hold imaging studies for the same patients, and that does not change what the deployment is for.

## Shipped plugins

### dicom

DICOM study management and an embedded [OHIF viewer](https://ohif.org). Users upload studies (CT, MRI, PET, ultrasound and other modalities); each file is de-identified at upload and indexed as study, series and instance rows owned by the uploader. The study list is at `/dicom/studies` in the platform interface, and opening a study launches OHIF in a new tab at `/plugin/dicom/ohif/`. OHIF's own study list at that address shows the same studies, through a DICOMweb search (QIDO-RS) the plugin answers. Studies take part in the platform's access rights: an author shares a study with a user from the Share button on the study list, under the same rules as dataset sharing (group grants are not available for studies yet), and a study attached to a recording is readable by anyone who can read that recording. Trashed studies are purged after `DICOM_TRASH_RETENTION_DAYS` (default 30), and `manage.py index_dicom` imports an existing DICOM tree through the same path as the upload (`--confirm-burned-in` gives the confirmation for an archive).

Two operator requirements follow from the viewer:

- **Cross-origin isolation.** OHIF decodes compressed images with WebAssembly codecs that need `SharedArrayBuffer`, which browsers only provide on a cross-origin-isolated page. Set `ENABLE_CROSS_ORIGIN_ISOLATION=True` in `.env`; the plugin does not set it for you, since a deployment may have turned isolation off deliberately. A reverse proxy in front of the stack must pass the three headers through. Without them, uncompressed studies render and compressed ones show a blank canvas.
- **Content Security Policy.** The codec worker compiles code at run time, which the platform's default policy refuses. The plugin sends the same policy with `'unsafe-eval'` added to `script-src` on the viewer's own responses only, so the rest of the platform keeps the strict one. A reverse proxy that sets its own `Content-Security-Policy` replaces this and breaks compressed studies.
- **The OHIF build.** The OHIF source is a separate submodule fetched only when the plugin is enabled (see [plugin-specific submodules](#plugin-specific-submodules)), and `scripts/build_ohif.sh` builds it into `plugins/dicom/ohif-dist/`. The build needs Node.js 24 or later and about 8 GB of memory; pnpm is taken from corepack when it is not installed. Rebuild whenever the submodule is updated. A distribution package made with the plugin carries the built viewer, so the deployment host does not build it.

**DICOM files are de-identified at upload, their images are not.** Every file is rewritten through the DICOM standard's basic de-identification profile (PS3.15 Annex E) before it is stored: patient name, ID and birth date, accession number, institution and every other identifying header attribute are removed or replaced, dates are replaced with a fixed dummy, UIDs are replaced with values keyed on `DICOM_UID_KEY`, and private attributes are removed. Study and series descriptions are kept as typed, with a warning at upload when one looks like an identifier. Text rendered into the image itself is not removed: for ultrasound, secondary capture and images flagged as carrying burned-in annotation, the uploader confirms the images show no identifying text before they are accepted, and the platform checks nothing itself. The result is pseudonymised personal data, not anonymous data. With `RECORDINGS_PRESERVE_MODE=all`, the file as uploaded goes to the write-only originals volume. Setting `DICOM_DEIDENTIFY_ON_INGEST=False` stores files as uploaded, for data already de-identified at the source.

Settings:

| Variable | Default | Description |
|---|---|---|
| `DICOM_UPLOAD_PATH` | `<MEDIA_UPLOAD_PATH>/../dicom` (on the media volume) | Where indexed DICOM files are stored |
| `DICOM_STAGING_PATH` | `<MEDIA_UPLOAD_PATH>/../dicom-staging` | Temporary landing area during upload |
| `DICOM_DEIDENTIFY_ON_INGEST` | `True` | De-identify every file at upload and import |
| `DICOM_RETAIN_PATIENT_CHARACTERISTICS` | `False` | Keep patient sex, age, size and weight |
| `DICOM_UID_KEY` | empty | Key for UID replacement, generated by `manage.py init_env` and `scripts/enable_plugin.sh dicom`. Upload is refused while it is empty and de-identification is on. Changing it makes a later upload of a study already held a separate study |
| `DICOM_OHIF_DIST_PATH` | `plugins/dicom/ohif-dist` | The built OHIF viewer served by the plugin |
| `DICOM_OHIF_DEMO_DATA` | `False` | Development only, ignored unless `DEBUG` is on: adds OHIF's public demo server and its study list to the viewer, for trying it without radiology data of your own |
| `DICOM_MAX_UPLOAD_FILES` | `500` | Most files in one upload request |
| `DICOM_MAX_UPLOAD_FILE_SIZE` | `2147483648` (2 GiB) | Largest single file accepted, in bytes |
| `DICOM_TRASH_RETENTION_DAYS` | `30` | Days a trashed study stays recoverable before it is purged |

### hedscore

Registers HED with the SCORE library as the `hed` annotation-code vocabulary, so readers can code their findings in it. What happened during a recording stays in the platform's own vocabularies; HED-SCORE is for what a reader concludes from the signal. The plugin requires the core `annotations` app and has no models.

The schema (SCORE 2.1.0 merged with HED 8.4.0) is vendored with the plugin and pinned by version and SHA-256 digest. It is checked and parsed when the platform starts, so a missing or altered file stops the boot rather than failing the first reader who codes a finding, and it is never fetched at runtime.

The validator is narrower than HED itself, because a code's value is served to readers under a de-identifying grant and must not carry typed text: tags in short form only, a number only where the plugin declares a unit and range for the placeholder, no free-text placeholders, and a canonical spelling for every stored string. Because a writer still chooses a reading within those domains, `hed` is registered as a *confined* vocabulary rather than a closed one: it is accepted on the annotations API, and recording ingest, which takes codes from files, takes none.

| Variable | Default | Description |
|---|---|---|
| `HEDSCORE_ALLOWED_BRANCHES` | `[]` | Top-level schema branches a code may use. Empty accepts every branch. A project narrows it in its own settings; `manage.py check` reports a name the schema lacks |

The plugin serves one endpoint, `GET /plugin/hedscore/api/v1/policy`, naming the schema release, its digest and the allowed branches. Its frontend half hands that policy to the viewer, whose EEG module carries the term picker; the picker hides itself when the deployment has no `hed` vocabulary registered and disables itself when its index was generated from a different schema release.

## Enabling a plugin

```bash
scripts/enable_plugin.sh dicom
```

The script, in order:

1. Fetches any plugin-specific submodule (for `dicom`, the OHIF source).
2. Starts the database and Redis if needed and applies migrations inside the `web` container with the new plugin list, so a failed migration leaves `.env` untouched.
3. Adds the plugin to `EPICURRENTS_PLUGINS` in `.env` and to `VITE_PLUGINS` in `frontend/.env`. Both lists are comma-separated, and the script is idempotent.
4. Rebuilds the frontend with `scripts/rebuild-frontend.sh`.

Then restart the stack to serve it:

```bash
docker compose up -d
```

Run the script once per plugin to enable several. To edit the lists by hand instead, keep the two in step and rebuild the frontend afterwards:

```dotenv
EPICURRENTS_PLUGINS=dicom,hedscore
```

```dotenv
VITE_PLUGINS=dicom,hedscore
```

`EPICURRENTS_PLUGINS` goes in `.env` and decides which backend apps load. `VITE_PLUGINS` goes in `frontend/.env` and is read at build time: each plugin's frontend code is compiled in behind a build-time flag, so a plugin missing from `VITE_PLUGINS` is absent from the bundle altogether, and changing the list has no effect until the frontend is rebuilt. A development build warns in the browser console about a `VITE_PLUGINS` entry that matches no known plugin.

Never run `migrate` for a plugin on the host. The host uses a local SQLite development database and the stack uses PostgreSQL, so a host-side migration applies to the wrong database.

A fresh deployment that already lists `dicom` in `EPICURRENTS_PLUGINS` when `scripts/bootstrap.sh` runs gets the OHIF submodule fetched by the bootstrap itself.

## Disabling a plugin

```bash
scripts/disable_plugin.sh dicom
```

This removes the plugin from both lists and rebuilds the frontend; restart the stack afterwards. It does not drop the plugin's database tables, so disabling is reversible and a later re-enable finds its data intact. Removing a plugin's data permanently is a separate, deliberate step outside the script.

## What happens at startup

1. **Settings merge.** Each enabled plugin's `settings.py` is merged, in `EPICURRENTS_PLUGINS` order, between the platform's base settings and the active project's. Precedence is `common < plugins < project < .env`, so a project always has the last word over a plugin it composes with, and an environment variable over both. The merge rules for lists, dicts and scalars are the project loader's; see [settings merge rules](docs/platform/project-development#settings-merge-rules).
2. **URL mounting.** A plugin's `urls.py` mounts at `/plugin/<namespace>/api/v1/` and its `public_urls.py` at `/plugin/<namespace>/`. The namespace is the plugin's directory name unless its config overrides it.
3. **Validation.** Before the first request, the platform checks that every plugin loaded as its own config class, that every declared dependency is a core app or another enabled plugin, and that no two plugins claim the same URL namespace. `manage.py check`, which runs before `runserver` and `migrate`, also verifies each plugin's platform version pin.

Each problem stops the boot with a message naming the plugin and the fix:

| Message | Cause | Fix |
|---|---|---|
| `EPICURRENTS_PLUGINS lists 'x' but plugins/x/ does not exist` | A typo, or a plugin not present in this checkout | Correct the name in `.env` |
| `plugins/x/apps.py is missing` | The directory is not a plugin | Add the app config, or remove the name |
| `Plugin 'x' loaded as 'AppConfig' instead of its PluginConfig subclass` | The config class lacks `default = True` | Set `default = True` on the config |
| `Plugin 'b' requires 'a', which is neither a loaded core app nor an enabled plugin` | A dependency is not enabled | Add it to `EPICURRENTS_PLUGINS` |
| `Plugins 'x' and 'y' both claim the URL namespace '/plugin/z/'` | Two plugins resolve to the same mount | Give one an explicit `plugin_url_namespace` |

## Writing a plugin

A plugin shares most of its mechanics with a project — `AppConfig.ready()` registrations, EDF middleware, settings merging, test settings — and the [project development guide](docs/platform/project-development) covers those. This section covers what differs.

### Layout

```
plugins/
  <name>/
    __init__.py
    apps.py           required: a PluginConfig subclass
    settings.py       optional: merged between common and the project
    models.py         optional, with migrations/
    urls.py           optional: Ninja API at /plugin/<name>/api/v1/
    public_urls.py    optional: plain Django views at /plugin/<name>/
    signals.py, tasks.py, management/commands/
    settings_test.py  test settings
    tests/
```

The frontend half lives in the platform's frontend tree, at `frontend/src/plugins/<name>/`.

### The app config

```python
from epicurrents.plugins import PluginConfig


class MyPluginConfig(PluginConfig):
    default = True
    name = "plugins.myplugin"
    label = "myplugin"
    requires_platform = ">=0.2,<0.3"
    requires: list[str] = ["annotations"]

    def ready(self):
        ...
```

- **`default = True` is required.** Importing `PluginConfig` puts a second config class in `apps.py`, which makes Django's config auto-detection ambiguous; without an explicit default Django silently instantiates the bare `AppConfig` and `ready()` never runs. The startup validation turns that into a boot error.
- **`name` and `label`** are `plugins.<name>` and `<name>`. The label keys the plugin's tables and its migration history.
- **`requires_platform`** is the semver range of platform versions the plugin was tested against, exactly as for a project: an unsatisfied pin blocks the boot, an absent one warns. While the platform is on `0.x` the minor is the breaking bump, so the cap is the next minor, never `<1`. See [project development](docs/platform/project-development#processing-a-recording-after-upload) for the pin rules.
- **`requires`** lists core apps and other plugins this plugin depends on, short (`"dicom"`) or qualified (`"plugins.dicom"`). A required plugin must itself be in `EPICURRENTS_PLUGINS`.
- **`plugin_url_namespace`** overrides the mount segment, which otherwise is the short name. Overriding it changes the public paths without renaming the directory.

### URL slots

- **`urls.py`** is a Django Ninja API, mounted at `/plugin/<namespace>/api/v1/`. It exposes `urlpatterns = [path("", api.urls)]`. This mount is recognised by the audit-trail middleware, so each request creates an activity row and model writes reach the change log as they would for a core app.
- **`public_urls.py`** is plain Django URL patterns, mounted at `/plugin/<namespace>/`, for content that is not an API: a bundled viewer, an SPA, responses with custom headers.

Paths under `public_urls.py` are not audited. A view there gets no activity row, and its database writes do not reach the change log. A public view that must write records each change itself with the explicit recorders in `activity/audit.py`; the cleaner pattern is to keep writes on a Ninja endpoint and have the public view only read.

### Platform obligations

Plugin endpoints carry the same rules as core ones:

- Session-authenticated writes obtain the user through a `_require_auth` helper that calls `enforce_session_csrf`, the platform's only CSRF check on its API.
- Every endpoint annotates its activity row with a `<plugin>.<resource>.<action>` verb through `log_activity`, and Celery tasks and management commands that write open a `with_system_activity` scope.
- A model with a foreign key to the user model is registered for subject erasure and classified for the subject access export from `ready()`, and credential fields are registered for masking. `manage.py check` reports an unclassified relation.
- A plugin that serves recording data honours the de-identification rules a grant carries.

### Frontend half

A plugin's frontend exports a `ViewerPlugin` object, the same contract a project's frontend uses (`frontend/src/projects/types.ts`): routes, navigation links, icons and icon libraries, a viewer panel, extra viewer setup, annotation-code metadata providers, and the `onAppReady` / `onStudiesReady` hooks. Registering a new plugin takes three edits: an import and a guarded entry in `frontend/src/plugins/active.ts`, a `__PLUGIN_<NAME>__` define in `frontend/vite.config.ts` derived from `VITE_PLUGINS`, and its declaration in `frontend/src/vite-plugins.d.ts`. The guard folds to a constant at build time, which is what drops a disabled plugin from the bundle.

The enabled plugins are combined by `mergePlugins` in `frontend/src/plugins/base.ts`, in `VITE_PLUGINS` order:

| Field | Merge |
|---|---|
| `routes`, `navLinks` | Concatenated |
| `icons`, `iconLibraries` | The first plugin to declare a name keeps it |
| `viewerPanel` | The first plugin that defines one |
| `codeMeta` | The first plugin to provide a standard keeps it |
| `extraSetup` | Deep-merged; a later plugin wins on a conflicting value |
| `onAppReady`, `onStudiesReady` | Every plugin's hook runs, in order, each awaited |

The merged result then meets the active project's, and the project wins wherever both set the same thing: the base interface's icons come first, then the project's, then the plugins'; the project's viewer panel and code-metadata providers win over a plugin's; the project's `extraSetup` is merged after the plugins'. Navigation links and routes from both are kept. Register plugin icons through the plugin, not the global icon map.

### Plugin-specific submodules

A plugin that needs a heavy dependency only it uses — an embedded viewer's source tree, say — registers it in `.gitmodules` with `update = none`, so a default `git submodule update --init --recursive` skips it and a deployment without the plugin never downloads it. The plugin's activation then fetches it explicitly:

```bash
git submodule update --init --checkout plugins/dicom/ohif-viewer
```

`--checkout` overrides `update = none` for that one invocation. Both `scripts/enable_plugin.sh` and the bootstrap run this for the `dicom` plugin, the bootstrap only when the plugin is enabled; a new plugin with a submodule adds its own branch to both.

## Further reading

- [Project development](docs/platform/project-development) — the shared extension mechanics: `ready()` registrations, EDF middleware, post-ingest processing, the version pin.
- [Testing](docs/platform/project-development/testing) — test settings and CI; a plugin's suite runs with its own `settings_test.py`, as a project's does.
- [Extending annotations](docs/platform/project-development/annotations) — registering a code vocabulary, as `hedscore` does.
