[[toc]]

## Django modes

The platform selects its settings module based on `DJANGO_MODE`:

| `DJANGO_MODE` | Module | `DEBUG` | Database |
|---|---|---|---|
| `development` | `epicurrents.settings.development` | From `.env` | SQLite (default) or Postgres via `DB_DEV_*` |
| `production` | `epicurrents.settings.production` | Always `False` | Postgres via `DB_*` |

The base `docker-compose.yml` runs the Django services with `DJANGO_MODE=development` against the stack's Postgres (`DB_DEV_ENGINE=postgres`). The `docker-compose.prod.yml` overlay sets `DJANGO_MODE=production`; `scripts/bootstrap.sh` and `scripts/update.sh` always apply it. Development mode also serves for running the Django server directly on the host.

## Deployment account

| Variable | Default | Description |
|---|---|---|
| `EPICURRENTS_UID` | `1000` | The uid every container runs as, and the owner the deployment's files must have. The bootstrap scripts and a package's `start.sh` record the account that runs them on the first run |
| `EPICURRENTS_GID` | `1000` | The matching gid |
| `HOST_PORT` | `8000` | Host port the `web` container is published on. The production overlay binds it on all interfaces, the proxy overlay on `127.0.0.1` only |
| `EPICURRENTS_NETWORK_NAME` | `epicurrents` | Name of the Docker network the stack joins. Give each stack on one host its own, or two stacks share the `db` alias |

Use an account of its own for the deployment rather than one a host service already runs as: the containers' files become this account's. Never write a literal uid into a compose file or script; read the setting.

## Projects and plugins

| Variable | Default | Description |
|---|---|---|
| `EPICURRENTS_PROJECT` | *(empty)* | The active project, by its directory name under `projects/`. Exactly one project is active per deployment; empty runs the base platform |
| `EPICURRENTS_PROJECT_REPO` | *(empty)* | Where the bootstrap clones the project from when `projects/<name>/` is missing: a bare name on the epicurrents organisation, `org/name`, a full git URL or a local path |
| `EPICURRENTS_PLUGINS` | *(empty)* | Enabled plugins, comma-separated, each a directory under `plugins/`. Plugins compose with the active project |

The frontend bakes the same choice in at build time from `frontend/.env`: `VITE_PROJECT` must match `EPICURRENTS_PROJECT`, and `VITE_PLUGINS` must list the same plugins as `EPICURRENTS_PLUGINS`. The bootstrap writes `VITE_PROJECT` itself. Settings merge with the precedence common settings, then plugins, then the active project, then `.env`.

Change the project on a running deployment with `scripts/switch_project.sh`, never by editing the value alone, and enable or disable a plugin with `scripts/enable_plugin.sh` or `scripts/disable_plugin.sh`, which update both files, apply the plugin's migrations and rebuild the frontend. Both are for a checkout. A distribution package is built for one project and plugin set, and an update refuses a package built for another.

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

### Sessions

| Variable | Default | Description |
|---|---|---|
| `SESSION_COOKIE_AGE` | `43200` | Session lifetime in seconds in production, 12 hours. Django's two-week default is too long for a platform serving health data |

### Login rate limiting

Failed login attempts are counted per username in the Django cache. After 10 consecutive failures within a 5-minute window the account is locked and subsequent attempts return **429 Too Many Requests**, even with the correct password. The counter resets on a successful login. Constants are in `user/api/v1/ninja.py`.

### Upload size

| Variable | Default | Description |
|---|---|---|
| `RECORDINGS_MAX_UPLOAD_SIZE` | `2147483648` | Maximum recording upload size in bytes (2 GiB) |
| `MEDIA_MAX_UPLOAD_SIZE` | `268435456` | Maximum media upload size in bytes (256 MiB). Raise it for video, and keep it within `PROXY_MAX_BODY_SIZE` |

Uploads exceeding this limit are rejected mid-stream and the partial staging file is cleaned up.

## Reverse proxy

| Variable | Default | Description |
|---|---|---|
| `PROXY_DOMAIN` | *(empty)* | Public hostname. A value switches the deployment to the bundled Caddy overlay, `docker-compose.proxy.yml`, which the bootstrap scripts, `update.sh` and a package's `start.sh` add on their own |
| `PROXY_ACME_EMAIL` | *(empty)* | Certificate-authority contact for expiry warnings. Required whenever `PROXY_DOMAIN` is set; the stack refuses to start without it |
| `PROXY_ACME_CA` | Let's Encrypt production | ACME directory. Point it at `https://acme-staging-v02.api.letsencrypt.org/directory` for a dry run |
| `PROXY_MAX_BODY_SIZE` | `2GiB` | Request-body ceiling at the proxy. Must be at or above `RECORDINGS_MAX_UPLOAD_SIZE`; Django refuses to boot otherwise. Caddy reads `GB` as powers of 1000 and `GiB` as powers of 1024 |
| `PROXY_HTTP_PORT` / `PROXY_HTTPS_PORT` | `80` / `443` | Host ports the proxy publishes. The ACME HTTP-01 challenge must arrive on port 80 |
| `PROXY_FILE_OFFLOAD_ENABLED` | `False` | Hand raw recording downloads to the proxy after Django has authorised and audited the request. The proxy overlay sets it; set it `False` there to force streaming through Django. Never applies to a de-identifying grant, whose bytes are computed per request |
| `TRUSTED_PROXIES` | *(empty)* | CIDR ranges, comma-separated, allowed to set `X-Forwarded-For` and `X-Forwarded-Proto`. Set it to a fronting proxy's source range so the HTTPS redirect does not loop and the security log records real client addresses |
| `USE_X_FORWARDED_PROTO` | *(empty)* | Trust `X-Forwarded-Proto` regardless of the source. The proxy overlay sets it, which is safe there because only the proxy can reach gunicorn |

Choosing between the bundled proxy, an existing ingress and a tailnet is covered in [Exposure and TLS](docs/platform/deployment#exposure-and-tls).

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

## Accounts and sign-in

### Two-factor authentication

| Variable | Default | Description |
|---|---|---|
| `TWO_FACTOR_REQUIRED_FOR_STAFF` | `False` | Require a TOTP second factor of accounts with staff or superuser rights that sign in with a password |
| `TWO_FACTOR_REQUIRED_FOR_ALL` | `False` | Require it of every account that signs in with a password. Covers staff too |

Two-factor authentication is otherwise opt-in per account, from the profile page. Turning either requirement on locks nobody out: an account without a factor is sent to enrolment during sign-in and completes it in the same step that opens the session. Neither applies to external (OIDC) sign-in, where the identity provider owns the second factor; set the requirement at the provider. A superuser clears the factor of someone who has lost their authenticator from the account's page under *Administration*.

### Account search

| Variable | Default | Description |
|---|---|---|
| `USER_SEARCH_REQUIRES_STAFF` | `False` | Reserve looking accounts up by name for staff. The search serves the sharing dialogs, and it is also what turns the user ids in annotation and grant responses into names, so a deployment whose workflows keep the parties unnamed turns it on |

### External login (OIDC)

Single-tenant Microsoft Entra ID sign-in, beside the password form. Off by default; the endpoints answer 404 until it is enabled and configured.

| Variable | Default | Description |
|---|---|---|
| `OIDC_ENABLED` | `False` | Master switch |
| `OIDC_ENTRA_TENANT_ID` | *(empty)* | The Entra directory (tenant) GUID. Sign-in is locked to that one directory |
| `OIDC_ENTRA_CLIENT_ID` | *(empty)* | Application (client) ID from the Entra app registration |
| `OIDC_ENTRA_CLIENT_SECRET` | *(empty)* | Client secret from the app registration |
| `OIDC_ENTRA_ALLOWED_DOMAINS` | *(empty)* | Email domains permitted to sign in, comma-separated, enforced before any account is created. Empty admits any account in the tenant. A non-empty list rejects guest accounts |
| `OIDC_REDIRECT_URI` | `FRONTEND_URL` + `/api/v1/user/oidc/entra/callback` | Must match the redirect URI registered in Entra exactly, including the absence of a trailing slash |
| `OIDC_AUTO_CREATE_USERS` | `True` | Create an account on a first sign-in that matches none |
| `OIDC_LINK_BY_VERIFIED_EMAIL` | `True` | Link a first sign-in to an existing account by a verified email address an operator set |

To take it into production:

1. In Microsoft Entra ID, register an application for accounts in this organisational directory only, with a **Web** redirect URI of `https://<host>/api/v1/user/oidc/entra/callback`.
2. Note the application (client) ID and the directory (tenant) ID, and create a client secret.
3. Keep the delegated `openid`, `profile` and `email` permissions, and add `email` as an optional token claim when relying on the domain allowlist or email linking.
4. Fill the `OIDC_*` values in `.env`, with `OIDC_ENTRA_ALLOWED_DOMAINS` listing the vetted domains.
5. Recreate the application containers so they read the new environment, and rebuild the frontend so the sign-in screen shows the button.

Test against the built, same-origin stack rather than the Vite dev server, whose origin does not receive the session cookie. The email-domain allowlist is a backstop; the stronger control is Entra's *User assignment required* on the application, which stops the provider issuing a token to anyone not assigned. An account created through the provider has no usable password: it cannot use the password form, password reset or the invitation link.

### User agreement

A deployment can require every account to accept its user agreement before using anything else. Nothing is gated until a version is published, and the text is the deployment's own, kept outside the repository. Publish it from the host:

```bash
docker compose exec -T web python manage.py publish_agreement --label 2026-11 < local/user-agreement.md
```

The command reads the Markdown from a file argument or standard input. Every version is kept with its digest, and each acceptance records the version it accepted, so what an account agreed to stays provable after later versions. A label is published once; a change is a new label. A new version asks every account to accept it again. `--no-reaccept` publishes a correction instead, such as a fixed typo or link: new accounts accept it, and accounts that accepted the version it corrects are not asked again. Never use it for a change to what anyone agreed to.

While a version is in force, an account that has not accepted it is sent to the agreement page and every other API request answers `403`. Superusers are gated like everyone else. Requests without a session, from federated peers or share-link holders without an account, are not gated. Accepting the agreement is not consent to processing personal data; link the agreement to the privacy notice rather than repeating it.

## File storage

| Variable | Default | Description |
|---|---|---|
| `RECORDINGS_UPLOAD_PATH` | `recordings_uploads/` | Permanent storage for processed recordings |
| `RECORDINGS_STAGING_PATH` | `recordings_staging/` | Temporary staging area for files being processed |
| `COMPUTE_ARTIFACT_CACHE_PATH` | `artifact_cache/` | Where the versions a project's reconstruction stages build from each recording are kept (`/data/artifacts`, the `artifact-data` volume, in the stack). Rebuildable, so no backup includes it; removed with the recording |
| `COMPUTE_ARTIFACT_CACHE_SWEEP_GRACE_HOURS` | `24` | Age past which a file in the artifact cache that no recording version names is removed |
| `COMPUTE_STAGE_STALE_HOURS` | `6` | A correction stage left running longer than this is taken as stopped and failed, so the recording can be retried |
| `RECORDINGS_IMPORT_PATH` | `recordings_import/` | Source directory for the `import_recordings` bulk import command |
| `RECORDINGS_LINKED_HOST_PATH` | `./linked` | Host directory mounted read-only at `/data/linked` in the web and worker containers, for recordings registered in place |
| `RECORDINGS_LINKED_ROOTS` | *(empty)* | Container paths files may be linked from, comma-separated; set to `/data/linked` to enable linking. Empty disables it |

A dataset too large to copy can be registered in place rather than imported: `import_recordings --link --source-deidentified` reads EDF/BDF files under a linked root and writes the same database rows an import does, but never copies, rewrites or deletes the files. Linking is for a superuser, on a deployment whose users are all entitled to the source data, because the files are served as they are: the platform's de-identification pass does not run on them, and `--source-deidentified` records the operator's assertion that they are already de-identified. A linked file that changes size or is modified after it was linked is refused to every reader until it is linked again.

## Recording ingest

| Variable | Default | Description |
|---|---|---|
| `RECORDINGS_ALLOW_PRESERVE_ANNOTATIONS` | `True` | Whether an uploader may ask for annotation text to be kept in the stored file. Stripping it is the default either way; set `False` to make it a prohibition, refused at the endpoint and ignored by the import command and the ingest task |
| `RECORDINGS_DISCARD_EMBEDDED_ANNOTATIONS` | `False` | Drop the annotation rows that came out of the uploaded file, so everything annotating a recording was written on the platform. Interruptions are kept. Governs the rows, not the stored file; a deployment that wants neither sets this and turns the previous setting off |
| `RECORDINGS_DISCARD_ORIGINAL_NAME` | `False` | Replace the uploaded filename with an upload timestamp before the row is written |
| `RECORDINGS_DISCARD_SOURCE_CHANNEL_METADATA` | `False` | Keep no copy of each channel's original label, transducer, filter strings and position beside the cleaned values |

Two channel-naming settings are set in a project's or plugin's settings module rather than in `.env`, because they name files that ship with that code:

- **`RECORDING_CHANNEL_RULES`** lists JSON tables that teach the de-identification pass a deployment's own spellings of the shipped channel names. A rule may only map to a name the platform stores. Tables are tried before the shipped rules.
- **`RECORDING_CHANNEL_MAPS`** names, by key, exact tables of one source's channel labels. A map is chosen per upload (the upload page, or `channel_map` on the upload endpoint) or per import (`import_recordings --channel-map`), and applies only to the files it was chosen for.

`manage.py check` refuses a table or map it cannot use, so a broken one stops the deployment at start-up. The key and digest of the map and tables in force are sealed into each recording's de-identification record.

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

Video, audio and image files open in the viewer through the [media module](docs/media-module), in an edition built with it (the builder's `full` profile). Documents open by extension through the [document module](docs/document-module): `.md` files through its `doc/htm-url` loader and `.pdf` files through `doc/pdf-url`. Other accepted types are served as downloads.

## Retention

| Variable | Default | Description |
|---|---|---|
| `RECORDINGS_TRASH_RETENTION_DAYS` | `30` | Days a trashed recording stays before its row and file are purged |
| `MEDIA_TRASH_RETENTION_DAYS` | `30` | Days a trashed media file stays before it is purged |
| `LIBRARY_TRASH_RETENTION_DAYS` | `30` | Days a trashed collection, dataset or collection item stays before it is purged |
| `ACTIVITY_ARCHIVE_AFTER_DAYS` | `90` | Days after which per-request activity rows are archived and hidden from default queries. Archived rows are never deleted; `0` disables archiving. Change records are never archived |
| `FEDERATION_AUDIT_RETENTION_DAYS` | `2200` | Days federation access-log rows are kept, about six years. `0` keeps them indefinitely |

Session lifetime is `SESSION_COOKIE_AGE`, under [Security](#security). Backup and snapshot retention are under [Backups](#backups).

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

## Public viewer

A standalone viewer page at `/viewer/<mode>` that needs no account and carries no platform data, for demos, embedding or a public landing viewer. It sets its own cross-origin isolation headers, so the viewer's shared-memory signal storage works regardless of `ENABLE_CROSS_ORIGIN_ISOLATION`.

| Variable | Default | Description |
|---|---|---|
| `ENABLE_PUBLIC_VIEWER` | `False` | Serve the page. Off, the route answers 404 |

Two related settings live in a project's settings module rather than in `.env`:

- **`PUBLIC_VIEWER_MODES`** maps each mode to the viewer bundle it loads (`lib_path`, and `lib_file` for its filename) and the deployment's part of the viewer setup. The built-in `public` mode loads the viewer edition at `/viewer/`. A project can add a mode, such as one pointing at its own viewer build under `/viewer/<project>/`, or override `public`. Only configured modes resolve.
- **`PYODIDE_ASSET_PATH`** is where the viewer loads its in-browser Python runtime from, `/vendor/pyodide/<version>/` on the deployment's own origin. `manage.py vendor_pyodide` downloads that version into the tree at deploy time. It is added to every mode's setup, so a project that redefines a mode keeps it.

The edition at `/viewer/` is installed by `manage.py vendor_viewer` from the release pinned in `frontend/viewer-pin.json`, by release tag and SHA-256, verified before it is unpacked. The bootstrap and every update run it; `vendor_viewer --check` verifies what is on disk against the pin without downloading. An empty pin leaves whatever the frontend build produced in place.

## Remote maintenance

| Variable | Default | Description |
|---|---|---|
| `REMOTE_MAINTENANCE_ENABLED` | `False` | Mount the Maintenance tab, where a superuser runs registered operations without a shell |
| `REMOTE_UPDATE_ENABLED` | `False` | Make platform updates, snapshots and rollbacks requestable from the tab. Needs the host agent installed and enabled |
| `REMOTE_UPDATE_VERIFY_WINDOW_MINUTES` | `30` | Minutes a superuser has to confirm a remote update before it rolls back, clamped to 5–1440 |
| `REMOTE_UPDATE_MAX_PACKAGE_SIZE` | `1073741824` | Largest package accepted for upload, in bytes |
| `REMOTE_UPDATE_KEEP_PACKAGES` | `2` | Uploaded packages kept beside the applied one |
| `REMOTE_UPDATE_RELEASE_KEY_PATH` | `RELEASE_KEY.pub` at the deployment root | The release key uploads are verified against |

Installing the host agent and the update flow are in [Updating](docs/platform/operations/updating#remote-maintenance).

## Backups

| Variable | Default | Description |
|---|---|---|
| `BORG_PASSPHRASE` | Generated | Passphrase of the Borg repositories. Empty turns the built-in backups off |
| `BORG_REMOTE_REPO` | *(empty)* | Off-host SSH repository, such as `ssh://user@host/path/to/repo` |
| `BORG_SSH_KEY_PATH` | *(empty)* | Host path to the SSH private key for the remote |
| `BORG_SSH_KNOWN_HOSTS_PATH` | *(empty)* | Host path to a known_hosts file holding the remote's host key. Required for remote backup |
| `BACKUP_LOCAL_ENABLED` | `true` | Keep the local repository in the `borg-data` volume |
| `BACKUP_INTERVAL` | `86400` | Seconds between backup runs |
| `BACKUP_KEEP_DAILY` / `BACKUP_KEEP_WEEKLY` / `BACKUP_KEEP_MONTHLY` | `7` / `3` / `5` | Archive retention |
| `BORG_MONITOR_URL` | *(empty)* | Healthchecks-compatible ping URL |

The full list, what is backed up and how to restore are in [Backups](docs/platform/operations/backups#settings).

## Logging

| Variable | Default | Description |
|---|---|---|
| `LOG_LEVEL` | `INFO` | Root logger level; output is JSON-formatted to stdout |
