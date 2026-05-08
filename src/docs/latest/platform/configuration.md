[[toc]]

## Django modes

The platform selects its settings module based on `DJANGO_MODE`:

| `DJANGO_MODE` | Module | `DEBUG` | Database |
|---|---|---|---|
| `development` | `epicurrents.settings.development` | From `.env` | SQLite (default) or Postgres via `DB_DEV_*` |
| `production` | `epicurrents.settings.production` | Always `False` | Postgres via `DB_*` |

Docker Compose always sets `DJANGO_MODE=production` for the `web` and `celery` services. The development mode is intended for running the Django server directly on the host outside Docker.

## Database

### Production (Postgres)

| Variable | Default | Description |
|---|---|---|
| `DB_NAME` | — | Database name |
| `DB_USERNAME` | — | Database user |
| `DB_PASSWORD` | — | Database password |
| `DB_HOSTNAME` | `db` | Database host (the Docker service name) |
| `DB_PORT` | `5432` | Database port |

### Development (SQLite or Postgres)

Set `DB_DEV_ENGINE=sqlite` (default) or `DB_DEV_ENGINE=postgres`. For SQLite only `DB_DEV_NAME` is needed. For Postgres, supply `DB_DEV_NAME`, `DB_DEV_USERNAME`, `DB_DEV_PASSWORD`, `DB_DEV_HOSTNAME`, and `DB_DEV_PORT`.

## Security

### HTTPS headers (production)

| Variable | Default | Description |
|---|---|---|
| `SECURE_SSL_REDIRECT` | `True` | Redirect all HTTP requests to HTTPS |
| `SECURE_HSTS_SECONDS` | `31536000` | HSTS max-age (1 year, with subdomains) |

`SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, and `SECURE_CONTENT_TYPE_NOSNIFF` are always enabled in production.

### Login rate limiting

Failed login attempts are counted per username in the Django cache. After 10 consecutive failures within a 5-minute window the account is locked and subsequent attempts return **429 Too Many Requests**, even with the correct password. The counter resets on a successful login. Constants are in `user/api/v1/ninja.py`.

### Upload size

| Variable | Default | Description |
|---|---|---|
| `RECORDINGS_MAX_UPLOAD_SIZE` | `2147483648` | Maximum upload size in bytes (2 GiB) |

Uploads exceeding this limit are rejected mid-stream and the partial staging file is cleaned up.

## Email

| Variable | Default | Description |
|---|---|---|
| `EMAIL_HOST` | `localhost` | SMTP server hostname |
| `EMAIL_PORT` | `587` | SMTP port |
| `EMAIL_USE_TLS` | `True` | Enable STARTTLS |
| `EMAIL_USE_SSL` | `False` | Enable implicit SSL (mutually exclusive with TLS) |
| `EMAIL_HOST_USER` | — | SMTP username |
| `EMAIL_HOST_PASSWORD` | — | SMTP password |
| `EMAIL_FROM` | `noreply@epicurrents.local` | `From:` address for transactional email |

## File storage

| Variable | Default | Description |
|---|---|---|
| `RECORDINGS_UPLOAD_PATH` | `recordings_uploads/` | Permanent storage for processed recordings |
| `RECORDINGS_STAGING_PATH` | `recordings_staging/` | Temporary staging area for files being processed |
| `RECORDINGS_IMPORT_PATH` | `recordings_import/` | Source directory for the `import_recordings` bulk import command |
| `RECORDINGS_TRASH_RETENTION_DAYS` | `30` | Days before soft-deleted recordings are permanently purged |

## Cache and task queue

| Variable | Default | Description |
|---|---|---|
| `REDIS_CACHE_URL` | `redis://redis:6379/2` | Redis URL for the Django cache backend |

The Celery broker uses `redis://redis:6379/0` (hardcoded). Keeping the cache on database `/2` avoids any cross-contamination with task queue state.

## Web push (VAPID)

| Variable | Description |
|---|---|
| `WEBPUSH_VAPID_PUBLIC_KEY` | VAPID public key (base64url, 43 chars) |
| `WEBPUSH_VAPID_PRIVATE_KEY` | VAPID private key (base64url, 43 chars) |
| `WEBPUSH_VAPID_SUBJECT` | Contact URI shown to push services, e.g. `mailto:admin@example.com` |

Generate a new keypair at any time:

```bash
scripts/manage.sh generate_vapid_keys
```

## Federation

| Variable | Description |
|---|---|
| `FEDERATION_PUBLIC_KEY` | Ed25519 public key (base64url, 43 chars) |
| `FEDERATION_PRIVATE_KEY` | Ed25519 private key (base64url, 43 chars) — never expose |
| `FEDERATION_INSTANCE_URL` | Canonical HTTPS base URL of this instance, e.g. `https://eeg.example.com` |
| `FEDERATION_JWT_TTL` | Outbound JWT lifetime in seconds (default `60`) |

Both keypairs are generated automatically by `init_env`. To rotate the federation keypair after a suspected compromise:

```bash
scripts/manage.sh rotate_federation_keys --apply
docker compose restart web celery
```

After rotating, remote instance administrators must re-fetch your public key before inbound requests will succeed again.

## Logging

| Variable | Default | Description |
|---|---|---|
| `LOG_LEVEL` | `INFO` | Root logger level; output is JSON-formatted to stdout |
