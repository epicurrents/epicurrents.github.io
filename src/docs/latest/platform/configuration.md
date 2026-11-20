[[toc]]

## Django modes

The platform selects its settings module based on `DJANGO_MODE`:

| `DJANGO_MODE` | Module | `DEBUG` | Database |
|---|---|---|---|
| `development` | `epicurrents.settings.development` | From `.env` | SQLite (default) or Postgres via `DB_DEV_*` |
| `production` | `epicurrents.settings.production` | Always `False` | Postgres via `DB_*` |

The base `docker-compose.yml` runs the Django services with `DJANGO_MODE=development` against the stack's Postgres (`DB_DEV_ENGINE=postgres`). The `docker-compose.prod.yml` overlay sets `DJANGO_MODE=production`; `scripts/bootstrap.sh` and `scripts/update.sh` always apply it. Development mode also serves for running the Django server directly on the host.

## Database

### Production (Postgres)

| Variable | Default | Description |
|---|---|---|
| `DB_NAME` | `epicurrents` | Database name |
| `DB_USERNAME` | `epicurrents` | Database user |
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
| `SECURE_HSTS_SECONDS` | `300` | HSTS max-age. Deliberately short while a deployment is being proven; once the certificate has renewed at least once on the real domain, raise it in steps: `3600`, `604800`, `31536000` |
| `SECURE_HSTS_INCLUDE_SUBDOMAINS` | `True` | Add `includeSubDomains` to the HSTS header |
| `SECURE_HSTS_PRELOAD` | `False` | Add `preload` to the HSTS header. Turn it on only after the year-long max-age has served without incident and every subdomain is HTTPS-only; preload-list submission is effectively irreversible |
| `SESSION_COOKIE_SECURE` | `True` | Send the session cookie over HTTPS only |
| `CSRF_COOKIE_SECURE` | `True` | Send the CSRF cookie over HTTPS only |

The two cookie flags can be turned off for a staging deployment served over plain HTTP; production logs a warning at boot while either is off. `SECURE_CONTENT_TYPE_NOSNIFF` is always enabled in production.

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
| `EMAIL_BACKEND` | `django.core.mail.backends.console.EmailBackend` | Mail backend. The default writes every message to the container log; set `django.core.mail.backends.smtp.EmailBackend` for delivery through the relay below |
| `EMAIL_DISABLED` | `False` | Acknowledge a deployment that sends no mail, which silences the boot warning production logs while the console backend is in use |
| `EMAIL_HOST` | `localhost` | SMTP server hostname |
| `EMAIL_PORT` | `587` | SMTP port |
| `EMAIL_USE_TLS` | `True` | Enable STARTTLS |
| `EMAIL_USE_SSL` | `False` | Enable implicit SSL (mutually exclusive with TLS) |
| `EMAIL_HOST_USER` | — | SMTP username |
| `EMAIL_HOST_PASSWORD` | — | SMTP password |
| `EMAIL_FROM` | `EMAIL_HOST_USER`, else `noreply@epicurrents.local` | `From:` address for transactional email |
| `EMAIL_TIMEOUT` | `20` | Seconds to wait on the relay. Django's default is no deadline; mail is sent inside the workers, so a stalled relay would hold a worker child indefinitely |

Three kinds of message go out: the invitation a new account is created with, the password reset a user asks for, and maintenance job notices to superusers. Without a relay configured they all go to the container log, where an account created by invitation cannot be signed in to at all — so a deployment that adds accounts through the administration pages needs this section filled in before it adds the first one.

`FRONTEND_URL` (default `http://localhost:5173`) is the base URL the links in these messages are built from. Production refuses to start while it is still that default; set it to the address users reach the platform at, such as `https://eeg.example.com`.

To check a relay without a shell on the host, run the **Send a test email** operation from the Maintenance tab. It mails every active superuser and reports what the relay said, naming no address; if delivery fails it shows the SMTP error class, which distinguishes bad credentials from a rejected sender domain. It refuses to report success while mail is still going to the container log.

## File storage

| Variable | Default | Description |
|---|---|---|
| `RECORDINGS_UPLOAD_PATH` | `recordings_uploads/` | Permanent storage for processed recordings |
| `RECORDINGS_STAGING_PATH` | `recordings_staging/` | Temporary staging area for files being processed |
| `COMPUTE_ARTIFACT_CACHE_PATH` | `artifact_cache/` | Where the versions a project's reconstruction stages build from each recording are kept (`/data/artifacts`, the `artifact-data` volume, in the stack). Rebuildable, so no backup includes it; removed with the recording |
| `COMPUTE_ARTIFACT_CACHE_SWEEP_GRACE_HOURS` | `24` | Age past which a file in the artifact cache that no recording version names is removed |
| `COMPUTE_STAGE_STALE_HOURS` | `6` | A correction stage left running longer than this is taken as stopped and failed, so the recording can be retried |
| `RECORDINGS_IMPORT_PATH` | `recordings_import/` | Source directory for the `import_recordings` bulk import command |
| `RECORDINGS_TRASH_RETENTION_DAYS` | `30` | Days before soft-deleted recordings are permanently purged |
| `RECORDINGS_LINKED_HOST_PATH` | `./linked` | Host directory mounted read-only at `/data/linked` in the web and worker containers, for recordings registered in place |
| `RECORDINGS_LINKED_ROOTS` | *(empty)* | Container paths files may be linked from, comma-separated; set to `/data/linked` to enable linking. Empty disables it |

A dataset too large to copy can be registered in place rather than imported: `import_recordings --link --source-deidentified` reads EDF/BDF files under a linked root and writes the same database rows an import does, but never copies, rewrites or deletes the files. Linking is for a superuser, on a deployment whose users are all entitled to the source data, because the files are served as they are: the platform's de-identification pass does not run on them, and `--source-deidentified` records the operator's assertion that they are already de-identified. A linked file that changes size or is modified after it was linked is refused to every reader until it is linked again.

## Library and media

| Variable | Default | Description |
|---|---|---|
| `LIBRARY_PUBLIC_DATASET_LISTING` | `False` | Serve a public listing of datasets that anyone can browse and open without an account. See below |
| `LIBRARY_DATASET_PRELOAD_LIMIT` | `50` | Most members a dataset may have when it is flagged for the viewer to load every member on opening. The viewer's own limit, also 50, caps what it loads regardless, so raising one means raising both |
| `LIBRARY_TAG_CREATION_REQUIRES_STAFF` | `True` | Reserve creating tags for staff. Tag names are shown to everyone a tagged item is shared with, so the default makes the vocabulary a deployment decision |
| `MEDIA_ALLOWED_UPLOAD_EXTENSIONS` | *(empty)* | File extensions accepted as media uploads, comma-separated, such as `pdf,mp4,png`. Empty accepts none. A project that sets the list in its own settings replaces this value |

With the public listing on, a dataset's author or a superuser can list the dataset through one of its share links, from the dataset page. The listing publishes that link, so everything behind it is read as the link's holder would read it, without an account. A dataset is listed only while all of the following hold, and they are checked again each time the listing is read, so a dataset that stops qualifying drops off the listing until it qualifies again:

- the dataset is not release-gated and not in the trash;
- the share link belongs to the dataset, grants read, is de-identifying and has not expired;
- the dataset holds at least one recording and nothing but recordings, each naming the published dataset it was taken from, and none with media attached.

The listing is meant for republishing data that its publisher already releases openly. See [Data protection](docs/platform/data-protection#where-data-leaves-the-deployment) for what a reader without an account receives.

Video, audio and image files open in the viewer, in an edition built with the native media module (the builder's `full` profile). Other accepted files are served as downloads.

## Cache and task queue

| Variable | Default | Description |
|---|---|---|
| `REDIS_CACHE_URL` | `redis://redis:6379/2` | Redis URL for the Django cache backend |
| `CELERY_BROKER_URL` | `redis://redis:6379/0` | Redis URL for the Celery broker. The compose files set it with `REDIS_PASSWORD` |

Keeping the cache on database `/2` avoids any cross-contamination with task queue state.

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
| `FEDERATION_KEY_FETCH_TIMEOUT` | Seconds to wait when fetching a peer's public key from its well-known URL (default `10`) |

Both keypairs are generated automatically by `init_env`. To rotate the federation keypair after a suspected compromise:

```bash
scripts/manage.sh rotate_federation_keys --apply
docker compose restart web celery
```

After rotating, remote instance administrators must re-fetch your public key before inbound requests will succeed again.

## Annotations

| Variable | Description |
|---|---|
| `ANNOTATION_EXPORT_ALL_ANNOTATORS_REQUIRES_SUPERUSER` | Whether exporting annotations across all annotators is reserved for superusers (default `True`). Set to `False` where the staff tier is the deployment's research-coordinator tier, which restores staff-wide export. Everyone outside the tier exports their own annotations only. |

`ANNOTATION_CODE_STRICT_VOCABULARY` is not an environment variable. Whether an unregistered coding standard is rejected belongs with the code that registers the vocabularies, so a project sets it in its own settings module; see [Annotations](docs/platform/project-development/annotations) in the project development guide.

## Logging

| Variable | Default | Description |
|---|---|---|
| `LOG_LEVEL` | `INFO` | Root logger level; output is JSON-formatted to stdout |
