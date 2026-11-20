[[toc]]

## What is a project plugin?

A *project plugin* is a self-contained Django app that layers deployment-specific functionality on top of the core platform. A project might add custom models, new API endpoints, EDF middleware classes, settings overrides, or any combination of those — without modifying a single line of the platform itself.

Only one project can be active at a time. Switching projects archives the current project's database tables rather than dropping them, so historical data is preserved until explicitly removed.

Projects live under `projects/<name>/` in the repository root and are activated via the `EPICURRENTS_PROJECT` environment variable.

## Project structure

```
projects/
  <name>/
    __init__.py
    .gitignore      # the project's own; the platform's ignore rules do not cross into it
    .gitattributes
    apps.py         # required — AppConfig (name="projects.<name>", label="<name>", requires_platform)
    models.py       # custom models with FKs/GenericFKs to platform models
    migrations/     # Django migrations for your models
    settings.py     # optional — settings overrides merged on top of base settings
    middleware.py   # optional — EDFHeaderMiddleware / EDFSignalMiddleware subclasses
    urls.py         # optional — extra Ninja endpoints, mounted at /project/api/v1/
    public_urls.py  # optional — plain Django views, mounted at /project/<name>/
    requirements.txt  # optional — Python dependencies the platform does not have
    requirements.lock # required with requirements.txt — scripts/lock-requirements.sh --project <name>
    env-additions   # optional — .env values a release introduces, appended on update
    frontend/       # optional — the project's frontend plugin (views, icons, nav links)
    settings_test.py  # test settings extending test_platform
    tests/
      __init__.py
      conftest.py   # pytest_configure hook, URL override, shared fixtures
      urls.py       # test URL conf that mounts the project API
      test_*.py
```

## Settings merge rules

When a project's `settings.py` is present, its values are merged onto the base settings according to these rules:

| Setting type | Behaviour |
|---|---|
| `INSTALLED_APPS`, `MIDDLEWARE`, `AUTH_PASSWORD_VALIDATORS`, `AUTHENTICATION_BACKENDS`, `PASSWORD_HASHERS` | Project list **appended** (duplicates skipped) |
| `CELERY_BEAT_SCHEDULE`, `TEXT_HYGIENE_PATTERNS` | Project dict **merged** (project wins on key conflicts) |
| Everything else | Project value **replaces** the base value |

Precedence is `common < plugins < project < .env`: enabled plugins' settings are merged first, the project's on top of them, and an environment variable still wins over both.

The project app (`projects.<name>`) is always added to `INSTALLED_APPS` automatically by the loader, regardless of whether `settings.py` exists.

## Lifecycle management

Project database tables can be *archived* (renamed with an `_archived_<name>_` prefix) rather than dropped when switching projects, allowing historical data to be restored or removed later. The server must be stopped before running any lifecycle command.

| Command | `EPICURRENTS_PROJECT` required | Effect |
|---|---|---|
| `activate_project <name>` | Yes — must equal `<name>` | Rename archived tables back, run `migrate` |
| `activate_project <name> --fresh` | Yes | Clear migration history, run `migrate` (archived tables kept) |
| `deactivate_project` | Yes — currently active project | Rename live tables to `_archived_<name>_*` |
| `remove_project_data <name>` | No | **Irreversibly** drop `_archived_<name>_*` tables (prompts for confirmation) |

> **Always run lifecycle commands via `docker compose run --rm --no-deps web python manage.py <command>`, never directly on the host.** The host Python environment uses a local SQLite database; the Docker stack uses PostgreSQL. Running commands outside the container applies migrations to the wrong database and leaves the stack in a broken state.

Use `scripts/switch_project.sh <new-project-name>` for the full switch sequence — it handles deactivation, env edits, activation, frontend rebuild, and restart automatically.

## Extending platform behaviour

### AppConfig.ready()

Register EDF middleware classes and read-permission extensions in your app's `ready()` method. This is the correct hook — it runs after all models are loaded and the settings are fully applied.

```python
# projects/myproject/apps.py
from django.apps import AppConfig


class MyProjectConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "projects.myproject"
    label = "myproject"
    requires_platform = ">=0.2,<0.3"

    def ready(self):
        from epicurrents.permissions import register_read_permission_extension
        from projects.myproject.permissions import can_read_via_my_rule

        register_read_permission_extension(can_read_via_my_rule)
```

### EDF middleware

Subclass `EDFHeaderMiddleware` (isometric, header-only transforms) or `EDFSignalMiddleware` (per-record transforms, may change channel layout) from `federation.middleware`. Register instances in the ingest pipeline via `RECORDING_PIPELINES` in your `settings.py`, or in the FUSE pipeline by passing a `MiddlewarePipeline` to `mount_federation_fs`.

### Processing a recording after upload

A project that corrects or analyses every recording registers that work from `ready()` rather than reacting to saves:

- **Reconstruction stages** (`recordings.pipeline.register_reconstruction_stage`) change the signal — an artefact correction, a repair. They run one after another once ingest has finished, each on the previous one's output, and the result becomes the recording's *default version*, which the viewer opens. The uploaded recording itself is never rewritten.
- **Derive jobs** (`compute.derive.register_derive_job`) read the default version and write the project's own rows — a quality mask, a table of indices. They run in parallel after the stages.

While stages run, the recording is `processing`; while only jobs run it is `available` and can already be opened; once everything has finished it is `ready`. A failed stage or job is shown on the recording's jobs and does not fail the recording. The recording's author can disable, re-enable or reorder its stages, which reruns them.

> **Important:** platform 0.2 changed what `ready` means. A project that filters on `status="ready"` to mean *the file can be read* should accept `available` too; one that means *everything has finished* keeps `ready`. Pin `requires_platform = ">=0.2,<0.3"` once the project has been checked against that.

`requires_platform` is verified by a system check at `manage.py check`, which runs before `runserver` and `migrate`: an unsatisfied pin blocks the boot and an absent one warns. While the platform is on `0.x` the minor is the breaking bump, so a cap is the next minor (`<0.3`), never `<1`.

### API endpoints

Add a `urls.py` to your project — its `api` object is mounted at `/project/api/v1/` automatically. Use standard Django Ninja patterns; the scaffolded template at `projects/example/` carries a working one, including the staff and superuser guards.

## Integration patterns

There are two ways to work with a project plugin:

- **[Fork](docs/platform/project-development/fork)** — copy the whole platform repository and develop your project inside it. Straightforward git workflow; platform updates require a manual rebase or cherry-pick.
- **[Separate repository](docs/platform/project-development/separate-repository)** — keep your project in its own repository, checked out at `projects/<name>/`, which the platform ignores rather than tracks. Platform updates are a `git pull` on the platform side; your project code stays in its own history, and no pinned commit ties the two together.

Both patterns produce identical runtime behaviour — the platform cannot tell the difference.

## Further reading

- **[Extending annotations](docs/platform/project-development/annotations)** — how to attach project-specific semantic labels and scores to annotations using the `Code` model, including the `epicurrents.<project>.<concept>` naming convention and the API-wrapping pattern.
- **[Testing](docs/platform/project-development/testing)** — conventions for writing and running tests inside a project plugin.
