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
| `RECORDINGS_DIRECT_UPLOAD` | `True` | When `False`, the upload endpoint accepts only an EDF or BDF file prepared in the viewer (identification blank, no annotation channel, no text in a signal's transducer, unit or prefiltering field, labels the platform stores or `MISC_<n>`) and refuses anything else, formats needing conversion included, before it is staged. A project may let named accounts keep the direct route. `import_recordings` is unaffected |

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
| `EMAIL_TIMEOUT` | `20` | Seconds to wait on the relay. Django's default is no deadline; mail is sent inside the workers, so a stalled relay would hold a worker child indefinitely |

Three kinds of message go out: the invitation a new account is created with, the password reset a user asks for, and maintenance job notices to superusers. Without a relay configured they all go to the container log, where an account created by invitation cannot be signed in to at all — so a deployment that adds accounts through the administration pages needs this section filled in before it adds the first one.

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

`ANNOTATION_CODE_STRICT_VOCABULARY` is not an environment variable. Whether an unregistered coding standard is rejected belongs with the code that registers the vocabularies, so a project sets it in its own settings module; see [Annotations](project-development/annotations.md) in the project development guide.

## Logging

| Variable | Default | Description |
|---|---|---|
| `LOG_LEVEL` | `INFO` | Root logger level; output is JSON-formatted to stdout |
