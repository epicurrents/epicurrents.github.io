[[toc]]

## Routes to an update

A deployment is updated in one of three ways, and all three end in the same script, `update.sh`:

- **A package from a shell.** Put the next distribution package in `./update/` and run `./update.sh` from the deployment root. This is the default mode, and the route for a deployment installed from a package.
- **A checkout from a shell.** `scripts/update.sh --from repo` pulls from git, rebuilds the frontend in a container and applies the result.
- **A package from the web interface.** A superuser uploads the package in the Maintenance tab, and a root-owned host agent verifies it and runs `update.sh`. See [Remote maintenance](#remote-maintenance).

In a checkout the script is `scripts/update.sh`; a package carries it at its root as `./update.sh`. Either copy accepts `--root DIR` to operate on the deployment at `DIR` instead of the one it sits in.

## What an update does

Before it changes anything, `update.sh` raises the [maintenance lock](#the-maintenance-lock), stops the workers and writes a pre-update snapshot under `./backups/`: the code tree, a database dump and `.env`, plus a full Borg backup when the `borg` service is running. Only then is the tree changed. The shared tail builds the image, applies pending migrations, collects static files, re-runs the vendoring steps (the viewer edition, the Pyodide runtime, the static lead fields), recreates the application containers on the production overlay, with the proxy overlay when `PROXY_DOMAIN` is set, and polls the readiness endpoint. A failed health check is a failed run.

A vendoring step that fails does not end the run: each is reported, the recreate and the health check still run, and the summary repeats what did not happen.

One `update.sh` runs at a time. A second is refused (`locked`), and so is a manual run while a maintenance flag is up that it did not raise. A run that fails after the snapshot leaves the flag up and names the snapshot `--rollback --snapshot NAME` restores; until that rollback or a successful update, a new update is refused (`unfinished`) and the snapshot is never pruned, so a retried update cannot rotate the real pre-update snapshot out.

`update.sh` stops `borg` alongside the application services and starts it again at the end if it was running, because a scheduled backup in progress holds database locks a migration would queue behind.

## Updating from a package

Put the newer `epicurrents*.tar.gz` in `./update/` together with the `.manifest.json` and `.manifest.sig` files the packager wrote beside it, then run the script from the deployment root:

```bash
./update.sh
```

The newest matching archive in `./update/` itself is applied over the deployment, preserving `.env` and the data volumes. Subdirectories are not searched; name a package elsewhere with `--archive FILE`.

### Checks before anything changes

A package is verified before anything is extracted, and every check runs before the snapshot, so a refused package changes nothing:

- **Signature.** The signature is over the manifest, verified against `RELEASE_KEY.pub` at the deployment root, which the previous package installed, and against `RELEASE_KEY.next.pub` beside it when a release announced a successor key. `--release-key PATH`, repeatable, names other keys to try. A deployment that holds a release key requires a signature that verifies: a missing manifest or signature is a refusal unless `--allow-unsigned` is passed on that run. Only a deployment with no key at all treats a missing signature as a warning. `--require-signature` refuses an unsigned package even there.
- **Hash and size.** The archive must match the sha256 and size the manifest names.
- **Identity.** A package built for another project or another plugin set is refused (`incompatible`), as is one whose manifest asks for a newer `update.sh` than the one running (`updater_too_old`). Replace the script with the copy at the package's root and run it again.
- **Version.** A package older than the installed release is refused unless `--allow-downgrade` is passed. A downgrade never migrates the database backwards, so rolling back to a snapshot is almost always what is meant. `--require-newer` also refuses a package of the same version.
- **Contents.** An archive carrying a link, a device node, a setuid file, a parent reference, a second top-level entry, or a `.env`, `.git/`, `backups/`, `update/` or `.epicurrents-files` member is refused.
- **Disk.** A package whose unpacked size the disk under `backups/` cannot hold twice over is refused.

The archive and its sidecars are copied into a private directory under `backups/` before anything reads them, and the copy is what is verified and extracted: `./update/` is writable by the web containers, so a file checked where it lies could be exchanged between the check and the extraction. The host verifies signatures with OpenSSL 3, or with `python3` and the `cryptography` package where the system OpenSSL is older.

To run every check without applying anything:

```bash
./update.sh --check-archive update/epicurrents-myproject.tar.gz
```

Nothing is extracted and no container is touched, and the check needs no container runtime. It also lists the settings the package would add to `.env`, and what sits under the package's directories in the tree that the package does not carry.

### Settings a release introduces

A package carries an `env-additions` file at its root, merged by the packager from the platform's own and the bundled project's and plugins'. After the snapshot, `update.sh` appends to `.env` each setting introduced after the release being replaced whose key `.env` lacks, under a dated comment. A value `.env` already holds is never replaced, an entry from an earlier release is not re-added after an operator removed it, and credentials, the keys that shape the stack (`DJANGO_MODE`, `EPICURRENTS_PROJECT`, `EPICURRENTS_PLUGINS`, `EPICURRENTS_UID`, `HOST_PORT`, `PROXY_DOMAIN` and similar) and the two remote-maintenance switches are never written. A rollback restores the snapshot's `.env`, which takes the additions back out.

### Files a release removes

A package built with `--tarball` carries a `FILELIST` naming every file it ships, and the deployment keeps the installed release's list at `.epicurrents-files`. After the overlay, `update.sh` deletes what the previous package shipped and the new one does not, and nothing else. A file no package ever listed is never a candidate, and `.env`, `backups/`, `update/`, `static/`, the vendored asset trees, a project with its own `.git`, vendored converters, `local/` and `testdata/` are never touched even when listed. The first update to a deployment without an installed list records the new list and deletes nothing.

## Updating a checkout

```bash
scripts/update.sh --from repo
```

`--from repo` runs `git pull`, builds the frontend in the `frontend-build` container and then runs the shared tail. `--no-pull` rebuilds the current checkout without pulling, for a checkout you have moved by hand.

## Holding the scheduler back

`--skip-beat`, in either mode, leaves `celery-beat` stopped after the recreate. The scheduler fires every periodic task that came due while it was down as soon as it starts, so a purge that fell due during the build would unlink files seconds after the recreate: files a rollback restores the rows for and cannot bring back. Verify the update first, then start beat:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d celery-beat
```

Add `-f docker-compose.proxy.yml` when `PROXY_DOMAIN` is set, here and in every other compose command on this page.

## The maintenance lock

While `update.sh` runs, and while a remote update is in flight, the platform is suspended. The script keeps a flag file at `update/maintenance.json` with the phase and a timestamp, and the platform answers `503` with a `Retry-After` header and a message the login page shows:

| Phase | Users | Superusers |
|---|---|---|
| `updating`, `rolling_back` | Every API request refused | Reads pass, writes refused |
| `verifying` (a remote update awaiting confirmation) | Reads pass; writes refused except sign-in and sign-out | Exempt, so they can test the release |

The health and readiness probes, the SPA document, the asset routes and the federation key document answer in every phase. The flag is a file rather than a database row because a rollback restores the database dump and would erase a row half-way through the operation it announces.

The flag is removed at exit unless the run failed after the stack was stopped or the tree was changed. It then stays up, so anyone who reaches the platform is told why it is not serving, and the script says so. Remove it by hand once the deployment is repaired or rolled back:

```bash
rm update/maintenance.json
```

## Snapshots and rollback

Undo the last update:

```bash
./update.sh --rollback
```

The rollback restores the newest complete pre-update snapshot's database, `.env` and code, rebuilds the images from the restored code, re-runs the static and vendoring steps, recreates the stack and polls the health endpoint. The rebuild is what makes the rollback real: the image carries the code, so restoring the tree alone would leave the new code running against the old schema. The database restore replaces the schema rather than overlaying it, runs as one transaction committed only after the whole dump was read, and refuses a dump whose gzip stream does not check, so a restore that fails leaves the database as it was. The task queue is purged after a database restore. Writes made between the snapshot and the rollback are lost, so roll back promptly or not at all.

| Command | Effect |
|---|---|
| `./update.sh --rollback` | Restore the newest complete `pre-update-*` snapshot |
| `./update.sh --rollback --snapshot NAME` | Restore `backups/NAME` instead |
| `./update.sh --rollback --code-only` | Restore the code and rebuild, keeping the database and `.env`. Refused unless the database's applied migrations are the ones the snapshot recorded |
| `./update.sh --snapshot LABEL` | Take a snapshot named `backups/LABEL-<stamp>` (code, database, `.env`) without stopping anything, and exit |
| `./update.sh --prune-snapshots` | Remove the snapshots under `backups/` older than `BACKUP_SNAPSHOT_MAX_AGE_DAYS`, and exit |

Every snapshot records which migrations the database had applied, and an update reports whether it applied any. When it applied none, `--code-only` restores the release and keeps everything written since. A plain `--rollback` ignores named snapshots, which is the point of naming one: a snapshot taken before rolling back, so that what the database gained since the update stays recoverable, must not be the one the rollback restores.

The newest three pre-update snapshots are kept. `BACKUP_SNAPSHOT_MAX_AGE_DAYS` additionally removes every snapshot older than that many days whatever its label, except one an unfinished update waits to be rolled back to. `update.sh` applies it when it updates and the host agent once a day; on a deployment without the agent, schedule `--prune-snapshots` yourself, or the limit holds only from one update to the next. See [Backup horizon](docs/platform/operations/backups#backup-horizon).

Two things a database restore cannot preserve:

- **Submission spool rows.** They are left out of every dump, because a row joins a contributor to the recording their file becomes, so a restore discards every file waiting in a submission pool's spool.
- **Account erasures made after the snapshot.** A restore brings the erased accounts back. A rollback requested from the web interface re-erases them on its own; after a restore from a shell, run the re-erasure yourself:

```bash
scripts/manage.sh shell -c "from maintenance.erasures import reapply; reapply()"
```

On a package deployment, which has no `scripts/`, run the same command through `docker compose run --rm web python manage.py shell -c ...`.

## Remote maintenance

The Maintenance tab of the administration pages lets a superuser run registered operations without a shell: checks and reports that run in the worker, and, with the host agent installed, updates, snapshots and rollbacks of the platform itself.

### The web tier executes nothing on the host

The web application never holds the capability to execute anything on the host. In production the code is baked into the images, no container mounts the container runtime's socket and none runs privileged, so a compromise of the web tier does not become root on the host. An operation that needs the runtime is therefore recorded as intent: an audited job row plus a request file in the `./update/` spool, which the production overlay bind-mounts into `web` and `celery`. A root-owned host agent under a systemd timer reads the request, verifies the package against its own root-owned copy of the release key and drives `update.sh`. Nothing the agent executes comes from the request: an operation is one of a fixed set the agent carries out, and a request names a package by hash or a snapshot by name, never a command or a path.

### Turning it on

```bash
REMOTE_MAINTENANCE_ENABLED=true
```

Set it in `.env` and recreate the application containers, which read the environment at creation:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate web celery celery-beat
```

The tab and its API answer 404 while the flag is off. On, a superuser can run the operations that need no host privilege: the audit-integrity check, the originals-volume validation, the signal-metadata refresh, the de-identification and grant-assessment reports, the dataset release and dataset reports, and *Send a test email*. A project or plugin can register its own. Every request is a job row audited under the requester, and an operation that writes asks for a step-up confirmation: the password, plus the second factor when the account has one. An account without a usable password and without a second factor cannot use the feature, and the tab says why.

Updates, snapshots and rollbacks also need `REMOTE_UPDATE_ENABLED=true` and the host agent. Leave that flag off until the agent is installed and enabled; on its own it makes the operations requestable with nothing to pick them up.

### Installing the host agent

A `--dist` package ships the agent as `updater/`. Install it once, as root, from the deployment root:

```bash
sudo ./updater/install-updater.sh
```

or pass `--with-updater` to `prepare-host.sh` on a fresh Debian or Ubuntu host. The installer puts the agent and its own copy of `update.sh` under `/usr/local/lib/epicurrents-updater/`, the configuration and the release public key under `/etc/epicurrents-updater/` (root-only), the agent's job records under `/var/lib/epicurrents-updater/`, creates the spool directories owned by the deployment account, and enables `epicurrents-updater.timer`, which runs the agent once a minute.

It prints the id of the release key it installed. Compare it with the id the publisher gave you through another channel before enabling anything.

| Installer option | Effect |
|---|---|
| `--root DIR` | The deployment. Default: the directory `updater/` sits in |
| `--key PATH` | The release public key to trust. Default: `RELEASE_KEY.pub` at the deployment root |
| `--enable` | Write `ENABLED=1` into the config |
| `--self-update` | Let the agent replace itself from verified packages (`SELF_UPDATE=1`) |
| `--allow-checkout` | Let the agent update a git checkout (`ALLOW_CHECKOUT=1`) |
| `--update-sh PATH` | The `update.sh` to install as the agent's copy. Default: the one beside `updater/` |

Running the installer again refreshes the agent and leaves the config alone. The agent refuses a git checkout by default, since remote updates are meant for package deployments; a checkout that is updated from packages anyway is installed from `scripts/updater/` with `--root` naming the checkout and `--allow-checkout`.

On a host where SELinux is enabled the installer also loads a policy module, `epicurrents-updater`, which lets the agent's rsync write the container-labelled deployment tree. Without it every update from the tab fails at its first rsync and the automatic rollback fails the same way. The installer stops if `semodule` is missing; `semodule -r epicurrents-updater` removes the module.

The agent starts disabled: it writes a heartbeat the tab shows and refuses every request. To switch remote updates on, set `ENABLED=1` in the agent's config:

```bash
sudoedit /etc/epicurrents-updater/config
```

then set `REMOTE_UPDATE_ENABLED=true` beside `REMOTE_MAINTENANCE_ENABLED=true` in `.env` and recreate `web`, `celery` and `celery-beat` as above. The tab shows the agent's heartbeat and reports it as not running after two minutes without one.

The agent's config, `/etc/epicurrents-updater/config`, holds `DEPLOY_ROOT`, `ENABLED`, `ALLOW_CHECKOUT`, `SELF_UPDATE`, `MIN_FREE_BYTES`, `HEALTH_TIMEOUT`, `DRAIN_TIMEOUT` and `VERIFY_WINDOW_MINUTES`. The agent refuses a config that is not root-owned or is writable by anyone else.

### Applying a release

A superuser uploads a release in the tab as the three files the packager writes: the archive, its manifest and the signature. The platform checks the signature against `REMOTE_UPDATE_RELEASE_KEY_PATH` (or the successor key beside it) and refuses, with the reason in words, a package that is not newer than the installed version, is built for another project or plugin set, is larger than `REMOTE_UPDATE_MAX_PACKAGE_SIZE`, or whose version falls outside the platform pin of an installed project or plugin the package does not carry. Only then is the archive kept, under `update/packages/<sha256>/`. The newest `REMOTE_UPDATE_KEEP_PACKAGES` packages keep their files beside the applied one; older ones are listed as removed. These checks give an immediate answer; the security boundary is the agent, which repeats the verification on its own copy before anything runs.

Requesting the update asks for the step-up confirmation. The agent claims the request within a minute, checks that the package hashes to what the request names, that the disk has room for twice the package plus a gigabyte, and that its own `update.sh --check-archive` accepts the copy with a required signature against the root-owned keys and a required newer version. A refusal fails the job with a reason such as `refused_signature`, `refused_version_not_newer` or `refused_disk`, and nothing changes.

An accepted update raises the maintenance flag, stops `celery-beat`, waits for the worker to finish its tasks and runs `update.sh` with the signature and version checks made refusals. The job log is readable from the job page as it runs. Every state change also goes to the host's journal, which a database restore cannot erase:

```bash
journalctl -t epicurrents-updater -n 50
```

### The verification window

After the update, the agent checks that the readiness probe answers and that the web container reports the package's version. The job is then `awaiting_verification`, the platform is read-only for everyone but superusers, and a superuser has a window to test the release and confirm it with their password. The window is `REMOTE_UPDATE_VERIFY_WINDOW_MINUTES` (default 30) unless the request named another, clamped to between five minutes and a day.

A confirmation ends the job, lifts the flag and starts `celery-beat`. A rollback request, a closed window, a failed readiness probe or a version that is not the package's rolls the deployment back to the update's own snapshot, after a `post-update` snapshot of what the database gained in the meantime, so a shell user can still recover it. When the release applied no migration, the rollback keeps the database and restores only the code. Superusers are notified of each state that needs attention by push and, when a mail relay is configured, by email.

A succeeded update can still be rolled back from its job page while its snapshot exists, nothing else is in flight and no later update or rollback has settled.

### Snapshots and rollbacks from the tab

The tab lists the snapshots the host holds, as the agent reports them, with when each was taken and the version its code carries. *Take a snapshot* stores code, database and `.env` under `backups/backup-<stamp>` without stopping anything; the newest three are kept. *Roll back to this* suspends the platform, takes a `pre-rollback` safety snapshot and restores the chosen one, the database included unless the request keeps it. Keeping the database is allowed only while no migration was applied since the snapshot; otherwise the job fails as `refused_code_only` and nothing changes but the safety snapshot.

A request that would restore the database while accounts have been erased since the snapshot is refused until it is repeated with the erasures acknowledged; once the restore succeeds, those accounts are erased again.

### Rotating the release key

A rotation is two releases. The first is signed with the old key and announces the new one: the packager's `--successor-key` puts its public half inside the signed manifest and ships it as `RELEASE_KEY.next.pub`. Applying that release teaches both sides: the platform accepts uploads signed with either key, and the agent installs the successor beside its current key. The second release is signed with the new key, and the first package that verifies with the successor makes it the agent's current key and drops the old one. The tab shows the ids of the keys the platform accepts and the agent trusts.

A deployment that skipped the announcing release does not know the new key and refuses the next package with `refused_signature`. Install the key by hand from a shell:

```bash
sudo ./updater/install-updater.sh --key RELEASE_KEY.next.pub
```

### Updating the agent

The agent's own copy of `update.sh` is replaced with the one every verified package ships. A release is therefore applied by the previous release's `update.sh`, and a release whose application needs a newer script says so in its manifest's `min_updater_version`; an agent whose copy is older refuses it as `refused_updater_too_old`. Re-run the new package's `updater/install-updater.sh` from a shell to install the newer script and agent, then request the update again.

The agent itself is replaced only with `SELF_UPDATE=1`: after a package verifies and applies, its `updater/epicurrents-updater.sh` replaces the installed one when it is newer and parses, the replaced copy is kept as `epicurrents-updater.sh.previous`, and the new agent runs from the next tick. With it off, re-run the package's installer to update the agent, which is the route where an unattended change to a root-owned script is not wanted.

### When a shell is needed

Most outcomes need nobody: a refused package changes nothing, and a failed update or a closed window rolls back on its own. Two states need a shell.

**`rollback_failed`.** The agent could not restore the snapshot, or the platform did not answer after it did. The maintenance flag stays up. From the deployment root, with the snapshot the job page names:

```bash
./update.sh --rollback --snapshot NAME
rm update/maintenance.json
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d celery-beat
```

Remove the flag only once the platform answers again. An interactive root shell runs `update.sh` outside the SELinux confinement the agent's service is under, which is why a rollback can succeed by hand where the agent's did not.

**`failed` with reason `stale`, without a snapshot.** The agent's run died before the update took its snapshot, typically on a reboot mid-update. Nothing changed and the previous release is serving; check the job log and request the update again.

**"Agent not running".** The timer is stopped or the agent fails before writing its heartbeat:

```bash
systemctl status epicurrents-updater.timer
journalctl -t epicurrents-updater -n 50
```

A request made meanwhile waits as `requested` until the agent picks it up or a superuser cancels it.

## Settings

| Variable | Default | Description |
|---|---|---|
| `REMOTE_MAINTENANCE_ENABLED` | `False` | Mount the Maintenance tab and its API |
| `REMOTE_UPDATE_ENABLED` | `False` | Make updates, snapshots and rollbacks requestable. Needs the host agent; `manage.py check` warns when it is on without the master flag |
| `REMOTE_UPDATE_VERIFY_WINDOW_MINUTES` | `30` | Default verification window, clamped to 5–1440 |
| `REMOTE_UPDATE_MAX_PACKAGE_SIZE` | `1073741824` | Largest package accepted for upload, in bytes (1 GiB) |
| `REMOTE_UPDATE_KEEP_PACKAGES` | `2` | Uploaded packages kept beside the applied one |
| `REMOTE_UPDATE_RELEASE_KEY_PATH` | `RELEASE_KEY.pub` at the deployment root | The key uploads are verified against; `RELEASE_KEY.next.pub` beside it is accepted too while present |
| `MAINTENANCE_SPOOL_PATH` | `update` at the deployment root | The spool. The production overlay sets it to the mount point `/data/update` |
| `MAINTENANCE_JOB_OUTPUT_LIMIT` | `65536` | Bytes of output kept per worker-run job |
| `BACKUP_SNAPSHOT_MAX_AGE_DAYS` | *(empty)* | Remove snapshots under `backups/` older than this many days. Empty keeps them by count |
