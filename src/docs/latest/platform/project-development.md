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
    apps.py         # required — AppConfig (name="projects.<name>", label="<name>")
    models.py       # custom models with FKs/GenericFKs to platform models
    migrations/     # Django migrations for your models
    settings.py     # optional — settings overrides merged on top of base settings
    middleware.py   # optional — EDFHeaderMiddleware / EDFSignalMiddleware subclasses
    urls.py         # optional — extra Ninja endpoints, mounted at /project/api/v1/
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
| `CELERY_BEAT_SCHEDULE` | Project dict **merged** (project wins on key conflicts) |
| Everything else | Project value **replaces** the base value |

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

    def ready(self):
        from epicurrents.permissions import register_read_permission_extension
        from projects.myproject.permissions import can_read_via_my_rule

        register_read_permission_extension(can_read_via_my_rule)
```

### EDF middleware

Subclass `EDFHeaderMiddleware` (isometric, header-only transforms) or `EDFSignalMiddleware` (per-record transforms, may change channel layout) from `federation.middleware`. Register instances in the ingest pipeline via `RECORDING_PIPELINES` in your `settings.py`, or in the FUSE pipeline by passing a `MiddlewarePipeline` to `mount_federation_fs`.

### API endpoints

Add a `urls.py` to your project — its `api` object is mounted at `/project/api/v1/` automatically. Use standard Django Ninja patterns; see `projects/edu/urls.py` for a complete example.

## Integration patterns

There are two ways to work with a project plugin:

- **[Fork](docs/platform/project-development/fork)** — copy the whole platform repository and develop your project inside it. Straightforward git workflow; platform updates require a manual rebase or cherry-pick.
- **[Submodule](docs/platform/project-development/submodule)** — keep your project in its own repository and add it as a git submodule inside the platform's `projects/` directory. Platform updates are a `git pull` on the platform side; your project code stays in its own history.

Both patterns produce identical runtime behaviour — the platform cannot tell the difference.

## Further reading

- **[Extending annotations](docs/platform/project-development/annotations)** — how to attach project-specific semantic labels and scores to annotations using the `Code` model, including the `epicurrents.<project>.<concept>` naming convention and the API-wrapping pattern.
- **[Testing](docs/platform/project-development/testing)** — conventions for writing and running tests inside a project plugin.
