[[toc]]

## Two ways to deploy

A deployment is a Docker Compose stack on one host: web server, background worker, scheduler, PostgreSQL, Redis and a backup service. There are two ways to arrive at one.

- **From a checkout.** Clone the platform repository and run the guided bootstrap. The host builds the frontend bundles itself, inside a container, and is updated from git. This is the route for a deployment that follows the platform's development or runs a project from its own repository.
- **From a distribution package.** Unpack a tarball someone built for you with the packager and run its `start.sh`. The package carries prebuilt bundles, so the host needs nothing but a container runtime, and later releases arrive as further packages, applied from a shell or from the web interface. See [Distribution packages](#distribution-packages).

Both routes end in the same stack, the same `.env` and the same [update](docs/platform/operations/updating) and [backup](docs/platform/operations/backups) machinery.

## Prerequisites

- **Docker Engine 25 or later** with Docker Compose v2. The bootstrap refuses an older engine, and installs a current one itself on Ubuntu and Debian. On RHEL and its rebuilds the stack runs on rootful Podman instead; see [Podman on the RHEL family](#podman-on-the-rhel-family).
- **Git** with submodule support, for the checkout route.
- **A non-root account with sudo.** The bootstrap and `start.sh` refuse to run as root, because every container runs as the account that owns the deployment tree, and a tree owned by root is one the containers cannot write.
- **A domain name with HTTPS** for anything beyond a trial. Web push notifications and federation both require HTTPS. See [Exposure and TLS](#exposure-and-tls).

## Guided bootstrap

`scripts/bootstrap.sh` goes from a fresh Ubuntu or Debian machine to a running stack in two passes, with one pause for editing `.env`. On macOS, Windows or another Linux, install git and Docker Desktop first; the script detects them and skips its install steps.

### 1. Create a non-root account

Skip this if you already log in as one. A cloud VM image commonly gives you `root` and nothing else. As root:

```bash
adduser --disabled-password --gecos "" epicurrents
usermod -aG sudo epicurrents
install -d -m 700 -o epicurrents -g epicurrents /home/epicurrents/.ssh
cp /root/.ssh/authorized_keys /home/epicurrents/.ssh/
chown epicurrents:epicurrents /home/epicurrents/.ssh/authorized_keys
```

An account without a password leaves `sudo` nothing to prompt for, so an unattended run hangs on it. Either give the account a password or grant it passwordless sudo:

```bash
echo "epicurrents ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/epicurrents
chmod 440 /etc/sudoers.d/epicurrents
```

Log back in as that account before continuing. Use a dedicated account rather than one a host service already runs as: the containers' files become this account's, and the bootstrap records its uid and gid in `.env` as `EPICURRENTS_UID` and `EPICURRENTS_GID`.

### 2. First pass

```bash
git clone https://github.com/epicurrents/platform epicurrents
cd epicurrents
./scripts/bootstrap.sh
```

The first pass installs git and Docker Engine when they are missing, adds the account to the `docker` group, initialises the submodules (the viewer and the documentation), builds the Python image and generates `.env` from `.env.example`. `init_env` fills the secrets: `SECRET_KEY`, `DB_PASSWORD`, `REDIS_PASSWORD`, `BORG_PASSPHRASE`, `ADMIN_PASSWORD`, the audit-trail hash key `ACTIVITY_HASH_KEY_V1`, the VAPID keypair and the federation Ed25519 keypair. The script then exits so you can review the file.

Each generated secret is printed once, under `Generated secrets:`, and remains readable only in `.env`. Do not capture the run with `tee` or a redirect: that writes the database password, the Borg passphrase and the rest into a plaintext file nothing cleans up.

When the account was added to the `docker` group during the run, the rest of that session drives Docker through `sudo`; log out and back in afterwards to use it without.

### 3. Edit .env

At minimum, review:

| Variable | What to set |
|---|---|
| `ALLOWED_HOSTS` | Hostnames the server answers to, comma-separated. Append your domain rather than replacing the value: the web container's healthcheck requests `127.0.0.1` |
| `FRONTEND_URL` | The address users reach the platform at, such as `https://eeg.example.com`. Production refuses to start while it holds the development default |
| `DB_*` | PostgreSQL credentials. `DB_PASSWORD` was generated |
| `ADMIN_USERNAME`, `ADMIN_EMAIL` | The first superuser. `ADMIN_PASSWORD` was generated |
| `EMAIL_*` | The outgoing mail relay; see [Email](docs/platform/configuration#email). Accounts are created by invitation, so this is needed before the first account is added |
| `PROXY_DOMAIN`, `PROXY_ACME_EMAIL` | The public hostname and a certificate contact, to turn on the bundled TLS proxy. See [Exposure and TLS](#exposure-and-tls) |
| `EPICURRENTS_PROJECT` | The project to run, if any. Blank runs the base platform |
| `EPICURRENTS_PROJECT_REPO` | Where to clone the project from when `projects/<name>/` is not already present |
| `EPICURRENTS_PLUGINS` | Plugins to enable, comma-separated |
| `FEDERATION_INSTANCE_URL` | Only when this instance will federate |
| `BORG_REMOTE_REPO` | Only when backing up off-host; see [Backups](docs/platform/operations/backups) |

`EPICURRENTS_PROJECT_REPO` accepts a bare name (resolved against the epicurrents organisation over HTTPS), `org/name`, a full `https://` or `git@host:` URL, or a local path. A project directory that already exists is never touched.

Two characters truncate a value silently. A `$` is read by docker compose as a variable reference, so `smtp$ecret99` reaches the application as `smtp`; double it (`$$`). A `#` preceded by whitespace opens a comment, so `hunter2 #old` arrives as `hunter2`; quote the value. A `#` inside a value, as in `hunter2#old`, passes through whole. The second pass refuses either case and names the line.

### 4. Second pass

```bash
./scripts/bootstrap.sh
```

The second pass skips what is already done and then:

1. Clones the project from `EPICURRENTS_PROJECT_REPO` when `projects/<name>/` is missing, before the image build, which installs the project's requirements.
2. Fetches the dicom plugin's OHIF viewer submodule when `dicom` is among the plugins.
3. Installs the viewer edition pinned in `frontend/viewer-pin.json` with `manage.py vendor_viewer`; an empty pin leaves whatever the frontend build produces.
4. Builds the frontend bundles in the on-demand `frontend-build` Node container, writing `VITE_PROJECT` into `frontend/.env` to match `EPICURRENTS_PROJECT`. The host needs no Node installation.
5. Vendors the Pyodide runtime the viewer's analysis tools load, under `frontend/vendor/`.
6. Initialises the Borg repositories, local and remote, unless `BORG_PASSPHRASE` is empty.
7. Activates the configured project.
8. Starts the stack on the production overlay, with the proxy overlay when `PROXY_DOMAIN` is set.
9. Generates the static lead fields for the viewer's source localisation.
10. Joins the tailnet, when an auth key was passed.

On first start the one-shot `migrate` service applies migrations, collects static files and creates the admin user; the other Django services wait for it. Captured step output goes to `bootstrap.log`.

### Flags

| Flag | Effect |
|---|---|
| `--no-start` | Stop before activating the project and starting the stack. Start it yourself with `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`, adding `-f docker-compose.proxy.yml` when `PROXY_DOMAIN` is set |
| `--tailscale-authkey KEY` | After the stack starts, put the deployment on a tailnet. The single-use key is never written to disk |
| `--tailscale-hostname NAME` | The tailnet device name. Default: `TS_HOSTNAME` in `.env` |
| `--tailscale-mode join\|serve` | How to join; see [Tailnet](#tailnet). Default `join` |

The tailnet flags apply to the run that starts the stack, so on a first setup pass them to the second pass.

## Podman on the RHEL family

`scripts/bootstrap-podman.sh` is the counterpart of `bootstrap.sh` for RHEL-family hosts. It is exercised on RHEL 9 and accepts Alma, Rocky and Fedora, which are less tested. It takes the same two passes and the same flags. Its own steps are the prerequisites: it checks the distribution, installs git and Podman with `dnf`, installs Docker Inc.'s docker-compose v2 from a pinned release verified by checksum as the compose provider, removes `podman-compose` if present, and enables the rootful `podman.socket`. `podman-compose` is refused because it silently ignores parts of the compose specification these files rely on. Everything after the prerequisites is the same run as the Docker path.

**The stack runs rootful.** Every compose call is `sudo -E podman compose`, while the script itself still refuses to run as root. Every service runs as the deployment account's uid (`EPICURRENTS_UID` / `EPICURRENTS_GID`) against a bind mount of the deployment tree, and only a rootful runtime maps that uid to the tree's owner; rootless Podman remaps it into the invoking user's subuid range, where the containers cannot write the checkout. Drive the stack the same way afterwards:

```bash
sudo -E podman compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

**Install aardvark-dns.** Without Podman's DNS resolver the containers cannot resolve each other by service name, and the stack stalls at `migrate` waiting for the database with no error. Install it alongside Podman with `sudo dnf install -y aardvark-dns`.

**SELinux.** With SELinux enforcing, containers cannot read a home directory as it is labelled by default, and the start fails with `Permission denied` on `/code/manage.py`. Label the deployment tree for containers, with the path filled in:

```bash
sudo semanage fcontext -a -t container_file_t "/home/epicurrents/epicurrents(/.*)?"
sudo restorecon -R /home/epicurrents/epicurrents
```

`semanage` comes with `policycoreutils-python-utils`. The rule is recorded, so a later relabel of the file system keeps it, and files the stack creates inherit the label. A directory mounted for linked recordings needs `container_ro_file_t` the same way, or `sudo setsebool -P virt_use_nfs 1` when it is on NFS. The remote-maintenance host agent needs a policy module of its own, which its installer loads; see [Installing the host agent](docs/platform/operations/updating#installing-the-host-agent).

**Debian and Ubuntu have no Podman path.** `bootstrap-podman.sh` refuses a host that is not RHEL-family, and a distribution package's `prepare-host.sh` installs Docker only. On Debian or Ubuntu, use Docker Engine.

## Manual setup

The steps the bootstrap automates, for a host where you want to run each one yourself.

### 1. Clone and initialise

```bash
git clone https://github.com/epicurrents/platform epicurrents
cd epicurrents
git submodule update --init
```

If you are using a project from a separate repository, check it out at `projects/<name>/` before continuing; see [Separate repository](docs/platform/project-development/separate-repository).

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

`init_env` fills any empty or placeholder secret in `.env` with a securely generated value. It never overwrites a value you have set.

```bash
docker compose run --rm --no-deps --entrypoint "" web python manage.py init_env
```

### 5. Edit .env

Fill in the values listed in step 3 of the [guided bootstrap](#guided-bootstrap), and set `EPICURRENTS_UID` / `EPICURRENTS_GID` to the uid and gid of the account that owns the checkout when it is not 1000. Set `VITE_PROJECT` in `frontend/.env` to match `EPICURRENTS_PROJECT`, and `VITE_PLUGINS` to match `EPICURRENTS_PLUGINS`.

A first deployment needs no project activation step: with `EPICURRENTS_PROJECT` set, the `migrate` service creates the project's tables on the first start. `activate_project` exists for switching projects on a running deployment (`scripts/switch_project.sh`).

> **Important:** always run management commands through `docker compose run` or `scripts/manage.sh`, never directly on the host. The host Python environment uses a local SQLite database; the stack uses PostgreSQL. Running commands outside the container applies migrations to the wrong database.

### 6. Build the frontend and vendored assets

```bash
mkdir -p update/packages update/jobs linked
docker compose --profile vendor run --rm --no-deps -T vendor python manage.py vendor_viewer
docker compose --profile build run --rm frontend-build
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile vendor \
    run --rm --no-deps -T vendor python manage.py vendor_pyodide
```

The `update/` directories are the maintenance spool the production overlay bind-mounts, and `linked/` the default source of the read-only linked-recordings mount. Create both as the deployment account before the first start: a bind source the runtime creates itself belongs to root.

### 7. Start the stack

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Add `-f docker-compose.proxy.yml` when `PROXY_DOMAIN` is set. A bare `docker compose up -d` starts the development stack instead: `DJANGO_MODE=development`, Django's `runserver`, bound to `127.0.0.1` only.

Then generate the static lead fields:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile vendor \
    run --rm --no-deps -T vendor python manage.py generate_compute_static
```

For ad-hoc commands against a production stack, set the file list once per shell, adding `:docker-compose.proxy.yml` when the proxy is in use:

```bash
export COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml
```

## Exposure and TLS

The production overlay binds `HOST_PORT` (default `8000`) on all interfaces. Gunicorn speaks plain HTTP and production sets `SECURE_SSL_REDIRECT`, so an internet-reachable host needs something in front of it that terminates TLS: without it every request is redirected to an `https://` URL nothing is listening on. There are three ways to provide it.

### Bundled Caddy proxy

Set `PROXY_DOMAIN` and `PROXY_ACME_EMAIL` in `.env`. The bootstrap scripts, `update.sh` and a package's `start.sh` all add `docker-compose.proxy.yml` to the compose file list whenever `PROXY_DOMAIN` has a value, so there is no separate flag to remember. The overlay:

- adds a `caddy` service that terminates TLS on ports 80 and 443 (and 443/udp for HTTP/3) with Let's Encrypt certificates it obtains and renews itself;
- serves the static asset trees straight from disk and proxies everything else to `web`;
- drops `web`'s port binding back to `127.0.0.1`, so the proxy is the only route in;
- sets `USE_X_FORWARDED_PROTO` for Django, and `PROXY_FILE_OFFLOAD_ENABLED`, which hands raw recording downloads to Caddy after Django has authorised and audited the request.

Two preconditions: the domain's A/AAAA record must already resolve to the host, and ports 80 and 443 must be reachable from the internet. The ACME HTTP-01 challenge runs on port 80 and fails without both. While DNS and the firewall are still being worked out, point `PROXY_ACME_CA` at Let's Encrypt's staging directory, which has far higher rate limits. Certificates and the ACME account key live in the `caddy-data` volume; losing it forces re-issuance, and Let's Encrypt refuses duplicate certificates after a handful in a week.

`PROXY_MAX_BODY_SIZE` (default `2GiB`) must be at or above `RECORDINGS_MAX_UPLOAD_SIZE`; Django refuses to boot otherwise. Caddy reads `GB` as powers of 1000, so `2GB` is below the 2 GiB application default. The full variable list is under [Reverse proxy](docs/platform/configuration#reverse-proxy).

### An existing ingress

An institutional reverse proxy or a cloud load balancer. Leave `PROXY_DOMAIN` empty, keep the direct binding, restrict `HOST_PORT` at the firewall to the proxy's source range, and set `TRUSTED_PROXIES` to that range so Django trusts the forwarded scheme and the security log records real client addresses rather than the proxy's.

### Tailnet

No public port at all: the deployment joins a [Tailscale](https://tailscale.com) tailnet and is reached privately. Generate a single-use auth key in the tailnet admin console and pass it to the bootstrap or to `start.sh` (`--tailscale-authkey`), or run `scripts/tailscale-join.sh` or `scripts/tailscale-serve.sh` any time after the stack is up. The key can be passed in the `TS_AUTHKEY` environment variable instead of on the command line, and is never written to disk; only `TS_HOSTNAME` is saved to `.env`.

| | `join` (default) | `serve` |
|---|---|---|
| What runs | The Tailscale package, on the host | An unprivileged container, compose profile `tailnet` |
| Direction | Inbound and outbound | Inbound only |
| Containers can reach the tailnet | Yes, through the host | No |
| Host is modified | Yes | No |

Choose `join` when anything has to leave the machine over the tailnet, such as shipping the security log to a separate evidence host or federating over the tailnet. `join` also disables Tailscale's stateful filtering, which would otherwise drop the replies to a container's outbound traffic.

Under `serve`, enable **HTTPS Certificates** in the tailnet admin console, add the node's MagicDNS name (`<hostname>.<tailnet>.ts.net`) to `ALLOWED_HOSTS`, and set `TRUSTED_PROXIES` to the Docker network range or `USE_X_FORWARDED_PROTO=True`, so Django trusts the forwarded scheme and Secure cookies keep working.

### HSTS

`SECURE_HSTS_SECONDS` starts at 300 seconds under all three arrangements. Raise it only after the certificate has renewed at least once on the real domain; see [Security](docs/platform/configuration#security).

## Verify

Open the site: `https://<PROXY_DOMAIN>` with the bundled proxy, otherwise `http://localhost:8000` on the host. Sign in with the admin credentials. From the host:

```bash
curl http://localhost:8000/api/v1/ready
curl http://localhost:8000/api/v1/health
```

`/ready` is what the `web` container's healthcheck polls: it opens a database cursor and reads from the cache, and answers `503` with the failing dependency marked `"error"` if either does not respond. `/health` reports only that the process is answering, with `mode` and `debug` reflecting `DJANGO_MODE`.

## Admin user

On every start, the `migrate` service calls `python manage.py createadmin`, which creates a superuser from `ADMIN_USERNAME`, `ADMIN_PASSWORD` and `ADMIN_EMAIL` if no superuser exists yet. If one exists the command is a no-op.

That no-op covers the password as well: an existing account keeps the one it was created with, so editing `ADMIN_PASSWORD` in `.env` and restarting changes nothing, while the file and a clean restart both suggest otherwise. Use `scripts/manage.sh changepassword <username>` instead.

After the first sign-in, change the generated password from the profile page and enrol a second factor there with any TOTP authenticator. Store the recovery codes shown when you confirm the enrolment; they are displayed only once. Two-factor is opt-in per account until `TWO_FACTOR_REQUIRED_FOR_STAFF` or `TWO_FACTOR_REQUIRED_FOR_ALL` is set; see [Two-factor authentication](docs/platform/configuration#two-factor-authentication).

`createadmin` is only for the first account. Every account after it is created in the application: sign in, open the user menu in the navigation bar and pick *Administration*. That surface also covers group membership, project roles, password resets and clearing a second factor for someone who has lost their authenticator. Staff can read it, superusers can change it.

Accounts are added by invitation: give the new account a username and an email address, and it is created with no password while a link goes out for the holder to choose one. The link lasts three days and the account page can send it again. Setting a password yourself is still offered on the form for the case where there is no address to send to.

That makes [outgoing mail](docs/platform/configuration#email) a prerequisite for adding accounts: without a relay the invitation goes to the container log and the account cannot be signed in to. The *Send a test email* operation in the Maintenance tab checks the relay before the first invitation.

Accounts are deliberately not deleted from there. Removing someone is `scripts/manage.sh erase_user`, which also unlinks the recording and media files they own and scrubs their personal data from the audit trail, none of which a plain account delete does.

## Distribution packages

`scripts/make-bootstrap-fixture.sh` assembles a self-contained copy of the platform that a recipient runs with nothing installed but a container runtime. A package carries the backend, the prebuilt UI and optionally a project and plugins, with no git history.

### Building a package

Build the bundles first; a package ships them prebuilt, not as source:

```bash
cd frontend && npm run build && npm run build:viewer && cd ..
```

A `--dist` package also carries the viewer edition. If `frontend/viewer-dist/` has none, install the pinned release with `manage.py vendor_viewer`, or build one from the viewer checkout with `npm run build:edition` in `frontend/`.

Then assemble the package:

```bash
scripts/make-bootstrap-fixture.sh ~/epicurrents-demo --demo
scripts/make-bootstrap-fixture.sh ~/epicurrents-myproject --dist --with-project myproject --tarball
```

| Option | Effect |
|---|---|
| `--demo` | Base platform with the browsable UI. No signal viewer, no project, no plugins |
| `--dist` | A runnable distribution: the UI and the signal viewer, plus the project and plugins named |
| `--with-project NAME` | Copy `projects/NAME`; with `--dist` a single project is activated. Repeatable |
| `--with-plugin NAME` | Copy and activate `plugins/NAME`. Repeatable |
| `--proxy-domain DOMAIN` | Preconfigure `PROXY_DOMAIN`, `FRONTEND_URL` and `ALLOWED_HOSTS` for a known address. Requires `--acme-email` |
| `--acme-email ADDRESS` | The certificate contact for `--proxy-domain` |
| `--federation` | Also set `FEDERATION_INSTANCE_URL` from `--proxy-domain` |
| `--tarball` | Also pack the result into `<dest>.tar.gz`, owned by uid and gid 1000, with a `FILELIST` inside and a manifest beside it |
| `--sign-key PATH` | Sign the manifest; see [Release signing](#release-signing). Requires `--tarball` |
| `--successor-key PATH` | Announce the next release key. Requires `--sign-key` |
| `--network-name NAME` | The Docker network the package joins. Default: the destination directory name, which keeps two packages on one host off each other's database |
| `--force` | Clear a non-empty destination first |

The bundle that ships must belong to the package. A checkout with a project active builds that project's UI, and every build writes `frontend/dist/build-info.json` naming the project and plugins it was compiled with; the packager refuses a bundle naming a project the package does not carry. Blank `VITE_PROJECT` in `frontend/.env` and rebuild for a base package. The package's `.env.example` is written from what the package carries, so a base package arrives with `EPICURRENTS_PROJECT` blank whatever the builder's tree was set to.

Prefer `--tarball` to packing the directory by hand. The archive records the ownership the deployment ends up with, and a tarball carrying the builder's uid leaves the deployment account unable to write its own tree. The `FILELIST` is what lets an update prune files a release removed, and the manifest, `<dest>.tar.gz.manifest.json`, names the package's version, project, plugins, size, sha256 and the oldest `update.sh` that can apply it.

### Release signing

A signed package lets the deployment verify that it came from you and arrived intact. Generate a release key once, keep the private half off every deployment host, and pass it at build time:

```bash
.venv/bin/python scripts/lib/release_sign.py keygen ~/.epicurrents/release.key
scripts/make-bootstrap-fixture.sh ~/epicurrents-myproject --dist --with-project myproject --tarball \
    --sign-key ~/.epicurrents/release.key
```

The signature lands in `<dest>.tar.gz.manifest.sig`, and the public key ships as `RELEASE_KEY.pub` at the package root, so the deployment that installs this package holds the key that verifies the next one. Signing refuses a version that is not greater than the newest release tag, because a package applied remotely must be newer than what it replaces. Ship the archive, the manifest and the signature together.

What a recipient needs to know about keys:

- **Compare the key id out of band.** `release_sign.py key-id` prints the id for the publisher, and the host agent's installer prints the id of the key it installs. The two should match; tell the recipient the id through a channel other than the package.
- **A deployment that holds a release key requires a signature.** `update.sh` refuses an unsigned package there unless `--allow-unsigned` is passed for that run, and the web interface refuses it outright. Only a deployment with no key at all treats a missing signature as a warning.
- **Keys rotate through the releases they protect.** To retire a key, build one release with `--successor-key PATH` naming the new key's `.pub` file. It goes inside the signed manifest and ships as `RELEASE_KEY.next.pub`, and a deployment that applies that release accepts either key from then on. Sign the release after it with the new key. A deployment that skipped the announcing release does not know the new key and refuses the next one; see [Rotating the release key](docs/platform/operations/updating#rotating-the-release-key).

### Installing a package

The recipient unpacks the tarball as the deployment account and runs the start script:

```bash
tar -xzf epicurrents-myproject.tar.gz -C ~
cd ~/epicurrents-myproject
./start.sh
```

`start.sh` detects Docker Engine or Podman and drives either, running Podman rootful through `sudo -E podman compose`. It reads the runtime name out of the version string rather than trusting the command name, since `podman-docker` installs a `docker` that is Podman. On the first run it writes `.env` with generated secrets, records the account's uid and gid as `EPICURRENTS_UID` / `EPICURRENTS_GID`, builds the image, starts the stack and prints the URL and the admin login.

Without `PROXY_DOMAIN`, `start.sh` runs the development compose file on `127.0.0.1` with Django's development server, which is for trying the platform out. With `PROXY_DOMAIN` and `PROXY_ACME_EMAIL` set in `.env`, the same script switches to the production and proxy overlays: gunicorn, `DJANGO_MODE=production`, the scheduler and Caddy with a certificate for the name. Running it again is safe. It takes the same `--tailscale-authkey`, `--tailscale-hostname` and `--tailscale-mode` flags as the bootstrap, and a `--dist` package carries `tailscale-join.sh` and `tailscale-serve.sh` at its root.

**A fresh Debian or Ubuntu server.** `prepare-host.sh`, at the package root, does the two things `start.sh` cannot do as an unprivileged account. Run it once as root:

```bash
sudo ./prepare-host.sh
```

It installs Docker Engine from the same script the bootstrap uses, creates an `epicurrents` account (uid 1000 when free), puts it in the `docker` group, copies root's SSH keys to it, adds a passwordless-sudo drop-in and hands the directory over. Then log in as that account rather than using `su`, because group membership applies only to a new session. Options: `--user NAME` for another account name, `--no-sudoers` to skip the sudo drop-in, and `--with-updater` to install the [host agent](docs/platform/operations/updating#installing-the-host-agent) as well.

**RHEL and its rebuilds.** `prepare-host.sh` is Debian and Ubuntu only. A package carries `INSTALL-RHEL.md` with the manual steps: Podman and `aardvark-dns`, docker-compose v2 at the release and checksum the platform pins, a dedicated account with sudo, unpacking as that account, and the [SELinux labelling](#podman-on-the-rhel-family). `start.sh` checks each and names the fix when one is missing.

A package carries `update.sh` at its root and, for `--dist`, the host agent under `updater/`. Later releases are applied as described in [Updating](docs/platform/operations/updating).

## Updating

A checkout updates with `scripts/update.sh --from repo`; a package deployment drops the next package into `./update/` and runs `./update.sh`, or uploads it from the Maintenance tab. Both take a pre-update snapshot, suspend writes while they run and can be rolled back. See [Updating](docs/platform/operations/updating).

## Scripts

All host-side scripts live in `scripts/` in a checkout. A distribution package carries `start.sh`, `update.sh`, `prepare-host.sh` and, for `--dist`, the two Tailscale scripts and `updater/` at its root, and none of the others.

| Script | Purpose |
|---|---|
| `bootstrap.sh` | Go from a fresh machine to a running platform: install git and Docker Engine on Ubuntu/Debian, generate `.env`, build images, start the stack |
| `bootstrap-podman.sh` | The rootful Podman counterpart of `bootstrap.sh` for RHEL-family hosts |
| `update.sh` | Update a running deployment from a distribution tarball or from git, with a pre-update snapshot and `--rollback` |
| `updater/install-updater.sh` | Install the remote-maintenance host agent |
| `make-bootstrap-fixture.sh` | Build a demo or distribution package |
| `manage.sh` | Run a Django management command inside the `web` container |
| `backup.sh` | Trigger an on-demand Borg backup and prune old archives |
| `restore.sh` | Restore the database and optionally file data from a Borg archive |
| `restore-drill.sh` | Prove a backup restores, against a scratch stack |
| `logs.sh` | Tail logs for one service or the whole stack |
| `reset.sh` | **Development only**: destroy all containers and volumes (refuses unless `DJANGO_MODE=development` in `.env`) |
| `apply-changes.sh` | Rebuild the frontend and restart the app containers after a code change |
| `rebuild-frontend.sh` | Build the frontend and restart the `web` container |
| `switch_project.sh` | Deactivate the current project, activate a new one, rebuild the frontend |
| `enable_plugin.sh` / `disable_plugin.sh` | Add or remove a plugin in `EPICURRENTS_PLUGINS` and `VITE_PLUGINS`, apply its migrations and rebuild the frontend |
| `lock-requirements.sh` | Regenerate the hash-pinned requirements lock, or a project's lock with `--project <name>` |
| `tailscale-serve.sh` / `tailscale-join.sh` | Publish the web UI on a tailnet, or make the host a tailnet node |

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

Runtime state lives in named volumes, one per domain: `postgres-data`, `recordings-data`, `staging-data`, `media-data`, `artifact-data`, `celery-data` and `borg-data`, plus `caddy-data` with the proxy and `tailscale-state` under `serve`.
