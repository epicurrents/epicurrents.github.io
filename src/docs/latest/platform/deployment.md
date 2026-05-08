[[toc]]

## Prerequisites

- **Docker Engine ≥ 25** and **Docker Compose** — the stack uses volume subpath mounts that require this version. Run `scripts/bootstrap.sh` on a fresh Ubuntu VM to install Docker automatically.
- A domain name with HTTPS is required for production deployments (VAPID push notifications and federation both require HTTPS).

## Quick start

### 1. Clone and initialise

```bash
git clone https://github.com/epicurrents/platform epicurrents
cd epicurrents
```

If you are using a project plugin from a separate repository, add it as a submodule before continuing — see [Submodule](docs/platform/project-development/submodule).

### 2. Copy environment templates

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

### 3. Initialise Docker volume directories

Volume subpath mounts require the target directories to exist before the first `docker compose up`. The `init-volumes` helper service creates them:

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

### 6. Activate a project plugin (optional)

If `EPICURRENTS_PROJECT` is set, run the activation command before starting the stack for the first time. This creates the project's database tables:

```bash
docker compose run --rm --no-deps web python manage.py activate_project <name>
```

> **Important:** always run lifecycle commands via `docker compose run`, never directly on the host. The host Python environment uses a local SQLite database; the Docker stack uses PostgreSQL. Running commands outside the container applies migrations to the wrong database.

### 7. Start the stack

```bash
docker compose up -d
```

On first start, `entrypoint.sh` runs pending migrations, collects static files, and creates the admin user from `ADMIN_*` env vars if no superuser exists yet.

The application is now available at `http://localhost` (or your configured domain).

## Updating

```bash
scripts/deploy.sh
```

`deploy.sh` pulls the latest code, rebuilds images, applies any pending migrations, and restarts the stack with zero-downtime rolling restarts where possible.

## Scripts

All host-side scripts live in `scripts/`.

| Script | Purpose |
|---|---|
| `bootstrap.sh` | Install Docker Engine on a fresh Ubuntu VM, build images, generate `.env` |
| `deploy.sh` | Pull latest code, rebuild images, migrate, restart |
| `manage.sh` | Run a Django management command inside the running `web` container |
| `backup.sh` | Trigger an on-demand Borg backup and prune old archives |
| `restore.sh` | Interactively restore the database and optionally file data from a Borg archive |
| `logs.sh` | Tail logs for one service or the whole stack |
| `reset.sh` | **Development only** — destroy all containers and volumes (requires explicit confirmation) |
| `apply-changes.sh` | Rebuild the frontend and restart `web` + `celery` — use after any code change |
| `switch_project.sh` | Deactivate the current project plugin, activate a new one, rebuild the frontend |

## Admin user

On startup, `entrypoint.sh` calls `python manage.py createadmin`, which creates a superuser from `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_EMAIL` if no superuser exists yet. If a superuser already exists the command is a no-op.

You can also run it manually at any time:

```bash
scripts/manage.sh createadmin
```

## Docker services

| Service | Image | Role |
|---|---|---|
| `web` | Custom (Django) | Serves the API and the built Vue SPA |
| `celery` | Custom (Django) | Processes background tasks |
| `celery-beat` | Custom (Django) | Schedules periodic tasks |
| `db` | `postgres:16` | Primary database |
| `redis` | `redis:7` | Celery broker and Django cache |
| `borg` | `borgmatic` | Automated backup |
