[[toc]]

## Platform tests

The core platform test suite lives in `<app>/tests/` directories (e.g. `recordings/tests/`, `library/tests/`) and is entirely independent of any project plugin. Run it with:

```bash
pytest --ignore=federation/tests/test_fuse_fs.py \
       --ignore=recordings/converters \
       --ignore=projects
```

The `--ignore=projects` flag ensures no project conftest accidentally influences the platform run. The `federation/tests/test_fuse_fs.py` file is excluded because it requires `libfuse2` — it runs in a separate environment where that library is available.

The platform uses `epicurrents.settings.test_platform` (set in `pytest.ini`) which provides:

- In-memory SQLite database — no external database needed.
- MD5 password hasher — fast, not for production.
- Synchronous Celery (`CELERY_TASK_ALWAYS_EAGER=True`) — tasks run inline, side-effects are assertable.
- `locmem` email backend — outgoing emails land in `django.core.mail.outbox`.
- In-process cache — cleared between test sessions.

## Adding tests to a project plugin

Project tests require the project's models to be in `INSTALLED_APPS` before the test database is created — a runtime `settings` fixture override is too late for migrations. The solution is a project-specific settings module that extends `test_platform`.

### 1. Create `settings_test.py`

Add this file to your project directory (alongside `settings.py`, `models.py`, etc.):

```python
# projects/myproject/settings_test.py
from epicurrents.settings.test_platform import *  # noqa: F401, F403

INSTALLED_APPS = INSTALLED_APPS + ['projects.myproject']  # noqa: F405
```

### 2. Create `tests/conftest.py`

The conftest handles three things: URL routing, shared fixtures, and a note for developers on how to invoke the tests.

```python
# projects/myproject/tests/conftest.py
"""
Run with:
    DJANGO_SETTINGS_MODULE=projects.myproject.settings_test pytest projects/myproject/tests/
"""
import pytest
from django.test import Client


@pytest.fixture(autouse=True)
def use_myproject_urlconf(settings):
    settings.ROOT_URLCONF = 'projects.myproject.tests.urls'


# Add shared fixtures here as needed.
```

The `use_myproject_urlconf` fixture mounts your project's API routes for every test in the suite, without touching the global URL configuration. This means tests can call `/project/api/v1/` endpoints normally.

### 3. Create `tests/urls.py`

This is the URL configuration used during tests. It mounts your project's API alongside the base platform routes:

```python
# projects/myproject/tests/urls.py
from django.urls import include, path
from epicurrents.urls import urlpatterns as base_urlpatterns
import projects.myproject.urls as myproject_urls

urlpatterns = [
    path('project/api/v1/', include(myproject_urls)),
] + list(base_urlpatterns)
```

### 4. Write tests

Tests follow standard pytest-django conventions. Use the global `make_user`, `superuser`, `auth_client`, and `superuser_client` fixtures from the platform's root `conftest.py` — they are available in all test files.

```python
# projects/myproject/tests/test_api.py
import json
import pytest

BASE = '/project/api/v1'

@pytest.mark.django_db
def test_my_endpoint_requires_auth(client):
    resp = client.get(f'{BASE}/my-endpoint/')
    assert resp.status_code == 401
```

### 5. Run the project tests

The `DJANGO_SETTINGS_MODULE` environment variable takes precedence over `pytest.ini`, so setting it explicitly switches to the project settings:

```bash
DJANGO_SETTINGS_MODULE=projects.myproject.settings_test pytest projects/myproject/tests/
```

## CI integration

### Platform job

The base `test` CI job ignores the `projects/` directory entirely:

```yaml
test:
  env:
    DJANGO_SETTINGS_MODULE: epicurrents.settings.test_platform
  steps:
    - run: |
        pytest \
          --ignore=federation/tests/test_fuse_fs.py \
          --ignore=recordings/converters \
          --ignore=projects \
          --cov --cov-fail-under=70 -q
```

### Project job

Add a separate job for each project plugin. The explicit `DJANGO_SETTINGS_MODULE` in the job env overrides `pytest.ini`:

```yaml
test-myproject:
  env:
    DJANGO_SETTINGS_MODULE: projects.myproject.settings_test
  steps:
    - uses: actions/checkout@v4
      with:
        submodules: true
    - uses: actions/setup-python@v5
      with:
        python-version: '3.12'
        cache: pip
    - run: pip install -r requirements.txt -r requirements-dev.txt
    - run: pytest projects/myproject/tests/ -q
```

If your project lives in a separate repository (the submodule pattern), its own CI pipeline can run the same test command against the submodule checkout — no changes needed to the project's workflow file.

## Coverage

The platform's 70% coverage threshold applies only to the platform job. Project tests have no enforced threshold by default; add `--cov-fail-under=<n>` to the project CI job when your test suite is mature enough to hold that bar.
