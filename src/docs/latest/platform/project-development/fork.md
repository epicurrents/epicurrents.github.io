[[toc]]

## When to use this pattern

Forking is the right choice when:

- You want the simplest possible git workflow — one repository, one history.
- You are not planning to track platform updates closely, or you are comfortable rebasing.
- Your project is tightly coupled to the platform version in use (e.g. you rely on internal APIs that may change).
- You prefer to review every upstream change before incorporating it.

If you expect to stay in close sync with platform development or your project code is maintained by a different team, keep the project in a [separate repository](docs/platform/project-development/separate-repository) instead.

## Setup

### 1. Fork the platform repository

Go to the [epicurrents/platform](https://github.com/epicurrents/platform) repository on GitHub and click **Fork**. This creates a copy under your account or organisation that you own entirely.

Clone your fork:

```bash
git clone https://github.com/your-org/platform my-epicurrents
cd my-epicurrents
```

If you want to be able to pull upstream changes later, add the original as a remote:

```bash
git remote add upstream https://github.com/epicurrents/platform
```

### 2. Initialise submodules

The platform carries the viewer and the documentation site as submodules. Initialise them after cloning:

```bash
git submodule update --init --recursive
```

Submodules belonging to a single plugin are registered with `update = none` and skipped here; the scripts that enable such a plugin fetch its submodule themselves.

### 3. Create your project

Create the project directory and the required files:

```bash
mkdir -p projects/myproject/migrations
touch projects/myproject/__init__.py
```

At minimum you need an `apps.py`:

```python
# projects/myproject/apps.py
from django.apps import AppConfig


class MyProjectConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "projects.myproject"
    label = "myproject"

    def ready(self):
        pass
```

And an initial (empty) migration:

```bash
EPICURRENTS_PROJECT=myproject python manage.py makemigrations myproject
```

### 4. Configure the environment

Set `EPICURRENTS_PROJECT=myproject` in `.env` and `VITE_PROJECT=myproject` in `frontend/.env`.

Activate the project against the Docker PostgreSQL database (start `db` first if it isn't running):

```bash
docker compose up -d db redis
docker compose run --rm --no-deps web python manage.py activate_project myproject
```

### 5. Start developing

Start the stack:

```bash
docker compose up -d
```

Your project's models, endpoints, and settings are now active. Edit files in `projects/myproject/` as you would any Django app — the bind-mounted volume means changes are picked up on the next request without restarting.

## Receiving platform updates

Add a remote for the upstream platform repository if you haven't already:

```bash
git remote add upstream https://github.com/epicurrents/platform
```

To incorporate upstream changes, fetch and rebase (or merge):

```bash
git fetch upstream
git rebase upstream/main
# resolve any conflicts, then:
git push origin main
```

A rebase keeps your project commits on top of the platform history and makes it easy to see exactly what you have changed relative to upstream. If you prefer a merge commit:

```bash
git merge upstream/main
```

Either approach works. The key is to review the upstream changelog before merging — platform releases may include breaking changes to internal APIs your project depends on.

## Committing your project

One thing does need doing first. The platform ignores everything under `projects/` except the package marker and the scaffolded template, because a project is normally its own repository — so in a fork, `git add projects/myproject/` is refused until you re-include the directory in the fork's `.gitignore`:

```
!/projects/myproject/
```

After that your project files are committed like anything else in the repository:

```bash
git add projects/myproject/
git commit -m "Add myproject: initial models and endpoints"
git push
```

If you want to keep the platform history separate from your project history for clarity, use a long-lived branch (e.g. `myproject/main`) and merge platform updates into it periodically.
