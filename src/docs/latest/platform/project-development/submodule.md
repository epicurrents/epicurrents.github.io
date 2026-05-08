[[toc]]

## When to use this pattern

The submodule pattern is the right choice when:

- Your project is developed and versioned independently of the platform — for example, by a different team or in a separate organisation.
- You want to track platform updates easily by pulling from upstream without any rebase or merge conflict work on your project code.
- You want to distribute your project as a standalone repository that others can drop into any compatible platform installation.
- You plan to eventually contribute your project back as a first-party plugin.

If you want a simpler git workflow and don't need independent versioning, the [fork](docs/platform/project-development/fork) pattern is easier to start with.

## How it works

Your project lives in its own git repository. The platform repository references it as a git submodule at `projects/<name>/`. When the platform is cloned (or updated), `git submodule update` brings in the pinned version of your project. You update the pinned commit explicitly, giving you full control over which version of your project is deployed alongside which version of the platform.

## Setup

### 1. Create your project repository

Create a new repository on GitHub (or any git host) for your project. Clone it locally:

```bash
git clone https://github.com/your-org/myproject
cd myproject
```

Add the required project files — at minimum `__init__.py`, `apps.py`, and an initial migrations directory. See [Project development overview](docs/platform/project-development) for the full structure.

```python
# apps.py
from django.apps import AppConfig

class MyProjectConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'projects.myproject'
    label = 'myproject'

    def ready(self):
        pass
```

Commit and push:

```bash
git add .
git commit -m "Initial project structure"
git push
```

### 2. Add the project as a submodule in the platform

Clone the platform (or use an existing clone):

```bash
git clone https://github.com/epicurrents/platform
cd platform
git submodule update --init --recursive   # initialise the e2edfconverter submodule
```

Add your project as a submodule at `projects/myproject/`:

```bash
git submodule add https://github.com/your-org/myproject projects/myproject
git commit -m "Add myproject as submodule"
```

The `.gitmodules` file now tracks the URL and path. When anyone clones the platform and runs `git submodule update --init`, they get your project at the committed revision.

### 3. Configure and activate

Set `EPICURRENTS_PROJECT=myproject` in `.env` and `VITE_PROJECT=myproject` in `frontend/.env`. Then activate:

```bash
docker compose up -d db redis
docker compose run --rm --no-deps web python manage.py activate_project myproject
docker compose up -d
```

## Day-to-day workflow

### Working on the project

The submodule directory `projects/myproject/` is a full git repository. Navigate into it and work normally:

```bash
cd projects/myproject
# make changes, run tests, commit
git add .
git commit -m "Add new endpoint"
git push
```

After pushing your project changes, update the pinned commit in the platform repository:

```bash
cd ../..            # back to the platform root
git add projects/myproject
git commit -m "Update myproject to latest"
git push
```

This two-step commit is the key characteristic of submodules: the platform records a specific commit SHA of your project, not a branch tip. Deployment is always reproducible because the exact version of every submodule is pinned.

### Updating the platform

Because your project code lives in a separate repository, updating the platform is straightforward — no rebasing of project commits required:

```bash
git pull origin main                    # update the platform
git submodule update --init             # bring submodules to their pinned commits
docker compose run --rm --no-deps web python manage.py migrate
docker compose restart web celery
```

Review the platform changelog before pulling — if there are breaking API changes your project code may need updating.

### Pinning to a specific project version

To pin the platform's reference to a specific tag or commit of your project:

```bash
cd projects/myproject
git checkout v1.2.0       # or any commit SHA
cd ../..
git add projects/myproject
git commit -m "Pin myproject to v1.2.0"
```

## CI considerations

When the platform's CI pipeline runs, it must initialise submodules to pick up your project code. The workflow step is:

```yaml
- uses: actions/checkout@v4
  with:
    submodules: true
```

Your project's own CI (in its separate repository) can run tests independently using the project's `settings_test.py`. See [Testing](docs/platform/project-development/testing) for the full setup.

## Migrating an in-tree project to a submodule

If you started with the fork pattern and now want to split your project into its own repository:

```bash
# 1. Create the new project repository and push your project files there.

# 2. Remove the directory from the platform (git rm, not rm -rf):
git rm -r projects/myproject
git commit -m "Remove myproject from tree (moving to submodule)"

# 3. Add it back as a submodule:
git submodule add https://github.com/your-org/myproject projects/myproject
git commit -m "Re-add myproject as submodule"
```

The platform's git history retains the full file history from the in-tree phase, and the new submodule history starts from the point of extraction.
