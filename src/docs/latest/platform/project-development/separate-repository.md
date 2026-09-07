[[toc]]

## When to use this pattern

Keeping your project in its own repository is the ordinary way to develop one. It is the right choice when:

- Your project is developed and versioned independently of the platform — by a different team, or in a different organisation.
- Your project carries deployment-specific content, or a history whose access you control.
- You want to track platform updates by pulling from upstream, with no rebase or merge work on your project code.
- You want to hand your project to another deployment as a repository it can check out.

The [fork](docs/platform/project-development/fork) pattern keeps everything in one repository and one history, which is simpler to start with but ties your project's history to the platform's.

## How it works

Your project is a git repository checked out at `projects/<name>/` inside the platform, and the platform does not track it. Everything under `projects/` is ignored except the package marker and the scaffolded template, so your checkout appears in no `git status` of the platform and cannot be committed to it.

This is deliberately not a git submodule. The platform records no URL, no path and no pinned commit for your project, and there is no second commit to make after you push. Which version of the project a deployment runs is decided by what that deployment has checked out.

Two consequences are worth knowing before you start. Ignore and attribute rules do not cross a repository boundary, so your project needs its own `.gitignore` and `.gitattributes` rather than inheriting the platform's. And the platform's CI does not see your project, so its tests run from its own repository.

## Setup

### 1. Create your project repository

Name the repository `project-<name>`: project repositories in the epicurrents org carry that prefix, so they group together in the listing rather than scattering by subject name among the viewer packages.

The repository name and the project name are separate things. `EPICURRENTS_PROJECT` is the Django app label, which keys the project's migration history and every one of its table names, so keep it short and treat it as fixed once the tables exist. A repository named `project-sleep-scoring` holding a project labelled `sleep` is normal.

Scaffold from the template rather than from an empty directory — it ships the two files that do not cross the repository boundary:

```bash
cp -r platform/projects/example myproject
cd myproject
git init && git add . && git commit -m "initial commit"
```

The template's `apps.py` is where the label is set:

```python
# apps.py
from django.apps import AppConfig


class MyProjectConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "projects.myproject"
    label = "myproject"
    requires_platform = ">=0.1,<0.2"

    def ready(self):
        pass
```

`requires_platform` is the range of platform versions your project supports. A system check verifies it before `runserver` and `migrate`, so an unsatisfied pin stops the boot rather than failing somewhere later.

### 2. Put it where the platform looks

Clone it into place yourself:

```bash
git clone https://github.com/your-org/project-myproject projects/myproject
```

Or set `EPICURRENTS_PROJECT_REPO` in `.env` and let `bootstrap.sh` do it on the next run. A bare name resolves to the epicurrents org over HTTPS; `org/name`, a full `https://` or `git@host:` URL, and a local path are all accepted, so a private project can be reached however the deployment already authenticates. Bootstrap clones only when `projects/<name>/` is missing, and never touches a directory that is already there.

### 3. Configure and activate

Set `EPICURRENTS_PROJECT=myproject` in `.env` and `VITE_PROJECT=myproject` in `frontend/.env`. A first-time deployment needs nothing further — the stack applies the project's migrations when it first comes up. On a deployment that is already running, activate the project explicitly:

```bash
docker compose up -d db redis
docker compose run --rm --no-deps web python manage.py activate_project myproject
docker compose up -d
```

## Day-to-day workflow

`projects/myproject/` is an ordinary git repository. Work in it as you would anywhere:

```bash
cd projects/myproject
# make changes, run tests, commit
git add .
git commit -m "Add new endpoint"
git push
```

There is nothing to do on the platform side afterwards. This is the practical difference from a submodule: no pinned commit to advance, no second commit, and no chance of a deployment running project code the platform's history disagrees with.

## Updating the platform

Because the platform does not track your project, updating it touches nothing of yours:

```bash
git pull origin main
docker compose run --rm --no-deps web python manage.py migrate
docker compose restart web celery
```

Read the platform changelog before pulling. When a release changes something inside the compatibility surface it bumps the platform version, and your project's `requires_platform` range is what decides whether the new version is one you have tested against. Widening the range to make a failing pin pass asserts a compatibility nobody checked; test first, then widen.

## Pinning a project version

The deployment decides which version of the project it runs, by checking it out:

```bash
cd projects/myproject
git checkout v1.2.0
```

Nothing is committed in the platform, and nothing in the platform records the choice.

## CI

The platform's CI does not see your project — it is not in the platform's repository, so no checkout step brings it in. Run your project's tests from its own repository, against its own `settings_test.py`. See [Testing](docs/platform/project-development/testing) for the setup.

## Moving a project out of a fork

If you started with the fork pattern and now want your project in its own repository, extract it with its history rather than copying the files:

```bash
# In the fork, split the project directory into a branch of its own:
git subtree split --prefix=projects/myproject -b myproject-history

# Push that branch to the new repository as its main:
git push git@github.com:your-org/project-myproject.git myproject-history:main
```

Then remove the directory from the fork. The platform's ignore rules take over from there, and the checkout at `projects/myproject/` becomes the new repository's working copy — add the `.gitignore` and `.gitattributes` the template carries, since the platform's stop at the boundary.
