[[toc]]

## Prerequisites

- **Docker Engine ≥ 25** and **Docker Compose** — the install script refuses older engines. Run `scripts/bootstrap.sh` on a fresh Ubuntu VM to install Docker automatically.
- A domain name with HTTPS is required for production deployments (VAPID push notifications and federation both require HTTPS).

## Quick start

### 1. Clone and initialise

```bash
git clone https://github.com/epicurrents/platform epicurrents
cd epicurrents
```

If you are using a project plugin from a separate repository, check it out at `projects/<name>/` before continuing, or set `EPICURRENTS_PROJECT_REPO` in `.env` and let bootstrap clone it — see [Separate repository](docs/platform/project-development/separate-repository).

### 2. Copy environment templates

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

### 3. Initialise Docker volume directories

The `init-volumes` helper service creates the upload and staging directories and gives the data volumes to the deployment account (`EPICURRENTS_UID` / `EPICURRENTS_GID`, default 1000). The `migrate` service depends on it, so it also runs on the first `up`; running it by hand is harmless:

```bash
docker compose run --rm init-volumes
```

### 4. Generate secrets

`init_env` fills any empty variables in `.env` with securely generated values — `SECRET_KEY`, `BORG_PASSPHRASE`, `ADMIN_PASSWORD`, VAPID keys, and the federation Ed25519 keypair. It never overwrites values you have already set.

```bash
docker compose run --rm --no-deps --entrypoint "" web python manage.py init_env
```

### 5. Edit .env

Open `.env` and fill in the deployment-specific values:

| Variable | What to set |
|---|---|
| `ALLOWED_HOSTS` | Your domain name(s), comma-separated |
| `DB_*` | PostgreSQL credentials |
| `ADMIN_*` | Initial superuser credentials |
| `EMAIL_*` | SMTP server details |
| `EPICURRENTS_PROJECT` | Project plugin name, if using one |

Also set `VITE_PROJECT` in `frontend/.env` to match `EPICURRENTS_PROJECT`.

### 6. Project plugin (optional)

A first deployment needs no activation step: with `EPICURRENTS_PROJECT` set in `.env`, the `migrate` service creates the project's database tables on the first start. `activate_project` exists for switching projects on a running deployment (see `scripts/switch_project.sh`).

> **Important:** always run lifecycle commands via `docker compose run`, never directly on the host. The host Python environment uses a local SQLite database; the Docker stack uses PostgreSQL. Running commands outside the container applies migrations to the wrong database.

### 7. Start the stack

A production stack layers the `docker-compose.prod.yml` overlay on the base file, which switches the Django services to `DJANGO_MODE=production`, runs gunicorn and binds the port on all interfaces:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

A bare `docker compose up -d` starts the development stack (`DJANGO_MODE=development`, `runserver`, bound to `127.0.0.1` only). `scripts/bootstrap.sh` and `scripts/update.sh` add the production overlay themselves.

On every start, the one-shot `migrate` service applies pending migrations, collects static files, and creates the admin user from `ADMIN_*` env vars if no superuser exists yet; the other Django services wait for it to finish.

The application is now available at `http://localhost:8000` (the port is `HOST_PORT`), or at your configured domain once a TLS-terminating proxy is in front of it.

## Updating

```bash
scripts/update.sh --from repo
```

`update.sh` takes a pre-update snapshot (code, database and `.env`), builds the images, applies migrations and recreates the stack on the production overlay. `--from repo` pulls from git and rebuilds the frontend on the host; the default mode, `--from archive`, applies a distribution tarball from `./update/` instead. While it runs, a maintenance lock suspends writes to the platform. `scripts/update.sh --rollback` restores the most recent snapshot.

## Scripts

All host-side scripts live in `scripts/`.

| Script | Purpose |
|---|---|
| `bootstrap.sh` | Go from a fresh machine to a running platform: install git and Docker Engine on Ubuntu/Debian, generate `.env`, build images, start the stack |
| `bootstrap-podman.sh` | The Podman counterpart of `bootstrap.sh` for RHEL-family hosts |
| `update.sh` | Update a running deployment from a distribution tarball or from git, with a pre-update snapshot and `--rollback` |
| `manage.sh` | Run a Django management command inside the `web` container |
| `backup.sh` | Trigger an on-demand Borg backup and prune old archives |
| `restore.sh` | Restore the database and optionally file data from a Borg archive |
| `restore-drill.sh` | Prove a backup restores, against a scratch stack |
| `logs.sh` | Tail logs for one service or the whole stack |
| `reset.sh` | **Development only** — destroy all containers and volumes (refuses unless `DJANGO_MODE=development` in `.env`) |
| `apply-changes.sh` | Rebuild the frontend and restart the app containers — use after any code change |
| `rebuild-frontend.sh` | Build the frontend and restart the `web` container |
| `switch_project.sh` | Deactivate the current project plugin, activate a new one, rebuild the frontend |
| `enable_plugin.sh` / `disable_plugin.sh` | Add or remove a plugin in `EPICURRENTS_PLUGINS` and `VITE_PLUGINS` and rebuild the frontend |
| `lock-requirements.sh` | Regenerate the hash-pinned requirements lock, or a project's lock with `--project <name>` |
| `tailscale-serve.sh` / `tailscale-join.sh` | Publish the web UI on a tailnet, or make the host a tailnet node |

## Admin user

On every start, the `migrate` service calls `python manage.py createadmin`, which creates a superuser from `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_EMAIL` if no superuser exists yet. If a superuser already exists the command is a no-op.

That no-op covers the password as well, which matters when the password is the thing you are trying to change: an existing account keeps the one it was created with, so editing `ADMIN_PASSWORD` in `.env` and restarting changes nothing, while the file and a clean restart both suggest otherwise. Use `scripts/manage.sh changepassword <username>` instead.

You can also run it manually at any time:

```bash
scripts/manage.sh createadmin
```

This is only for the first account, since `createadmin` makes a superuser and does nothing once one exists. Every account after it is created in the application: sign in, open the user menu in the navigation bar and pick *Administration*. That surface also covers group membership, project roles, password resets and clearing a second factor for someone who has lost their authenticator. Staff can read it, superusers can change it.

Accounts are added by invitation: give the new account a username and an email address, and it is created with no password while a link goes out for the holder to choose one. Nobody else ever knows it, which removes the step where an operator has to convey a password out of band. The link lasts three days and the account page can send it again. Setting a password yourself is still offered on the form for the case where there is no address to send to.

That makes [outgoing mail](docs/platform/configuration#email) a prerequisite for adding accounts rather than a convenience: without a relay the invitation goes to the container log and the account cannot be signed in to. The *Send a test email* operation in the Maintenance tab checks that before the first invitation rather than after it.

Accounts are deliberately not deleted from there. Removing someone is `scripts/manage.sh erase_user`, which also unlinks the recording and media files they own and scrubs their personal data from the audit trail — none of which a plain account delete does.

## Docker services

| Service | Image | Role |
|---|---|---|
| `web` | Custom (Django) | Serves the API and the built Vue SPA |
| `celery` | Custom (Django) | Processes background tasks |
| `celery-beat` | Custom (Django) | Schedules periodic tasks |
| `migrate` | Custom (Django) | One-shot: applies migrations, collects static files, creates the first admin |
| `init-volumes` | `busybox` | One-shot: creates volume directories and sets their ownership |
| `db` | `postgres:17` | Primary database |
| `redis` | `redis:7.4` | Celery broker and Django cache |
| `borg` | `borgmatic` | Automated backup |
| `borg-restore` | `borgmatic` | On demand (`restore` profile): file restores, started by `scripts/restore.sh` |
| `vendor` | Custom (Django) | On demand (`vendor` profile): writes the vendored assets (Pyodide runtime, viewer edition, lead fields) |
| `frontend-build` | `node:20` | On demand (`build` profile): compiles the frontend bundles on the host |
| `tailscale` | `tailscale/tailscale` | Optional (`tailnet` profile): publishes the web UI on a tailnet |
| `caddy` | `caddy:2` | Optional (`docker-compose.proxy.yml`): TLS termination and static asset serving, added when `PROXY_DOMAIN` is set |
