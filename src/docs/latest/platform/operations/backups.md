[[toc]]

## What is backed up

The `borg` service runs borgmatic on a schedule inside the stack. Each run writes one encrypted, deduplicated archive holding:

- a dump of the PostgreSQL database, taken in PostgreSQL's custom format;
- the stored recordings (`/data/recordings`, the `recordings-data` volume);
- the uploaded media files (`/data/media/uploads`, in the `media-data` volume).

Left out deliberately:

- **`.env`.** An archive carrying the passphrase that decrypts it is not a control. Keep `.env` in a custody store of its own; see [Keys and passphrases](#keys-and-passphrases).
- **The artifact cache** (`artifact-data`), which is rebuilt from the recordings.
- **The staging areas**, which hold files only while they are processed.
- **The submission spool's rows.** A row joins a contributor to the recording their file becomes, so it is excluded from every dump. A restore therefore discards every file waiting in a submission pool's spool.

The backup service mounts the data volumes read-only. Restores go through a separate `borg-restore` service, started on demand, which mounts them read-write.

Separately from Borg, every update takes a snapshot of the code, the database and `.env` under `./backups/`; those snapshots are what `update.sh --rollback` restores. See [Snapshots and rollback](docs/platform/operations/updating#snapshots-and-rollback).

## Repositories

There are two tiers, chosen independently. They fail in different ways and are not substitutes.

| Failure | Local repository | Remote, append-only |
|---|---|---|
| Operator error, a bad migration | Yes, and fastest | Yes |
| Disk failure | Only if the volume is separate storage | Yes |
| Host loss | No | Yes |
| Host compromise, an attacker with root deleting archives | No | Yes |
| Provider or datacentre loss | No | Yes |

**The local repository** lives in the `borg-data` volume, mounted at `/backup` in the borg container, and is on by default. It restores at disk speed without depending on another host, but on a stock deployment it sits on the same disk as the data, so it protects against mistakes rather than against hardware.

**The remote repository** is an SSH target named by `BORG_REMOTE_REPO`. An attacker with root on the application host holds the passphrase and can destroy any repository the host can write to, so make the remote append-only for this host: a forced command on the remote such as `borg serve --append-only`. A second copy is only worth what its write restriction is worth.

Set `BACKUP_LOCAL_ENABLED=false` for a remote-only arrangement, when disk is tight and an append-only remote is in place. With both tiers off there is nowhere to write, and the backup container refuses to start rather than report success while backing up nothing. A value outside `true`/`false`/`yes`/`no`/`on`/`off`/`1`/`0` is refused rather than read as the default.

Production logs a warning at boot while `BORG_REMOTE_REPO` is empty, unless `BACKUP_LOCAL_ONLY=true` records that keeping the only copy on the host is deliberate.

### Setting up the remote

1. Create an SSH key for the backup, and authorise it on the remote with an append-only forced command:

```bash
ssh-keygen -t ed25519 -C "borg@$(hostname)" -f ~/.ssh/id_borg -N ""
```

2. Capture the remote's host key into a file of its own, so what the backup trusts is a deliberate list:

```bash
ssh-keyscan -t ed25519 backup.example.com > ~/.ssh/known_hosts_borg
```

3. Set `BORG_REMOTE_REPO`, `BORG_SSH_KEY_PATH` and `BORG_SSH_KNOWN_HOSTS_PATH` in `.env`. The key is mounted into the container as `/root/.ssh/id_borg` whatever its name on the host, and the known_hosts file as `/root/.ssh/known_hosts`. The default `BORG_RSH` connects with `StrictHostKeyChecking=yes`; with no known_hosts file every run fails verification, which is the intended outcome. Do not relax it to `accept-new`.
4. Initialise the repository. The bootstrap's second pass does it when `BORG_REMOTE_REPO` is set; on an existing deployment:

```bash
docker compose run --rm --entrypoint borg borg init --encryption repokey "$BORG_REMOTE_REPO"
```

Run it with `BORG_REMOTE_REPO` exported in the shell, or paste the value in its place. borgmatic does not create a missing repository, it fails, so this step is not optional. Then export the new repository's key; it is not the local one.

5. Recreate the borg service so it reads the new environment:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate borg
```

### Expiring the remote

Retention is applied to both repositories, but on an append-only remote a prune only marks archives deleted. Borg keeps the data until the repository is compacted by someone with full access, which the host deliberately lacks. Left alone the remote grows without bound and keeps everything it was ever sent, including data an account erasure removed everywhere else.

So whoever administers the remote runs `borg compact` against it with full access, on a schedule: at least once per retention period, and preferably monthly. Before compacting, check that the deletions the host recorded since the last compaction are the ones the retention policy explains, since a compromised host can also mark archives deleted and compaction makes those deletions permanent. Record the interval in `.env` as `BACKUP_REMOTE_COMPACTION_DAYS`; `manage.py check` warns while a remote is configured without it.

## Schedule and retention

The borg service runs a backup every `BACKUP_INTERVAL` seconds (default one day) and prunes by `BACKUP_KEEP_DAILY`, `BACKUP_KEEP_WEEKLY` and `BACKUP_KEEP_MONTHLY` (default 7, 3 and 5). Borg counts the weekly archives from where the daily ones end and the monthly ones from where the weekly ones end, so at the defaults an archive can survive about six months.

Retention matches archives by name, so keep `BORG_ARCHIVE_PREFIX` stable. Change it only when two deployments share one repository, and then give each its own, or they prune each other's archives.

## Taking a backup by hand

In a checkout:

```bash
scripts/backup.sh
scripts/backup.sh --list
```

The first creates an archive and applies the retention policy; `--list` only lists the archives. A distribution package carries no `scripts/`; there, run borgmatic directly:

```bash
docker compose run --rm borg borgmatic create --stats --list
docker compose run --rm borg borgmatic prune --stats --list
```

## Restoring

In a checkout:

```bash
scripts/restore.sh
```

The script lists the archives and asks which to restore, or takes an archive name as its argument. It stops `web`, `celery` and `celery-beat`, keeps `db` running, and restores the database. It then asks whether to restore the recording and media files as well, extracting them through `borg-restore`. Finally it applies any migrations the code has gained since the archive was taken, so the application does not start against a stale schema, and starts the services again.

The database restore drops and recreates the schema first, because `pg_restore` replaces only the objects the dump holds and a table from a later migration would otherwise survive and fail the migration that follows. A restore that fails after that point leaves an empty database. The restore waits a bounded time for its locks; a lock timeout means something else still holds a connection, such as a backup in progress or a shell.

A restore brings back every account the dump holds, including accounts erased after it was taken. Re-apply the erasures afterwards:

```bash
scripts/manage.sh shell -c "from maintenance.erasures import reapply; reapply()"
```

## Rehearsing a restore

```bash
scripts/restore-drill.sh
```

An untested restore is a hypothesis. The drill seeds a database row and a recording file, backs both up through the same borgmatic configuration production uses, destroys the database volume and unlinks the file, restores, and checks that the row came back and the file is byte-identical. It also checks that both halves were really gone before the restore, so a drill whose destroy step did nothing cannot pass, and that a seeded submission spool row did not come back.

Everything runs under a dedicated compose project with its own network and volumes, publishes no host port, and forces `BORG_REMOTE_REPO` and `BORG_MONITOR_URL` empty, so it is safe beside a live deployment and never writes into the real remote or reports itself to the monitor. `--keep` leaves the scratch stack up for inspection. Expect a few minutes. The drill does not cover the remote repository, or whether anyone would notice a failing backup.

Rehearse retrieving the passphrase from its custody store, rather than from `.env`, at least once as part of a drill.

## Backup alerting

A backup that has been failing for weeks looks exactly like one that works until a restore is attempted. Two independent reports close that gap:

- **The log token.** Every failure writes an `EPICURRENTS_BACKUP_FAILURE` line to the `borg` container's log, naming the repository and the error. The token is stable; build a log-shipper alert on it.
- **A monitor.** Set `BORG_MONITOR_URL` to a Healthchecks-compatible ping URL (healthchecks.io, a self-hosted Healthchecks, or anything speaking the same protocol). Each run pings on start, finish and failure. The ping carries no content unless `BORG_MONITOR_SEND_LOGS=true` attaches the run's log tail, which is worth it when whoever is paged has no shell on the host; the monitor is then a processor of what those logs contain.

The monitor is the stronger of the two because it also alerts on silence: a hook inside the container cannot report that the stack is stopped, and a monitor expecting a periodic ping notices exactly that. Treat the URL as a secret, since anyone holding it can report your backups as healthy. The borg container warns at start while either `BORG_MONITOR_URL` or `BORG_REMOTE_REPO` is unset.

## Keys and passphrases

`BORG_PASSPHRASE` lives in `.env`, and `.env` is in no archive. Losing the host therefore loses the ability to read the backups, off-host copies included, unless the passphrase is kept somewhere the host loss cannot reach:

- Store it in a password manager the operators can reach without this host, or seal it wherever the organisation keeps its other break-glass credentials.
- Record beside it which repository it opens and where that repository is.

The same applies to the rest of `.env`: `SECRET_KEY`, the audit-trail hash keys (`ACTIVITY_HASH_KEY_*`), the federation private key and the VAPID keys cannot be recovered from a backup. Losing the audit-trail keys means the restored audit trail cannot be verified.

**Export each repository's key.** With `repokey` encryption the key is stored inside the repository, wrapped by the passphrase, so damage to the repository's few hundred bytes of configuration makes its archives unreadable with a correct passphrase. A deployment with off-host backups has two repositories and two unrelated keys, and exporting one leaves the other unrecoverable. From the deployment root:

```bash
mkdir -p ~/borg-key-export
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm -T \
    -v "$HOME/borg-key-export:/out" --entrypoint borg borg \
    key export /backup /out/borg-key-local.txt
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm -T \
    -v "$HOME/borg-key-export:/out" --entrypoint borg borg \
    key export "$BORG_REMOTE_REPO" /out/borg-key-remote.txt
```

The container writes as root, so `chown` the results, move them off the host and delete the originals. Store the exports apart from the passphrase: an export plus the passphrase is full read access to that repository. `borg key export --paper` prints a checksummed block for paper storage. Re-export after any passphrase change and after initialising another repository.

## Backup horizon

The backup horizon is how long after a given moment every copy of the database taken before it is gone. A project that pools files the server held dates them past it, so that no backup still holds the copy a pooled file was made from. It is computed from what `.env` declares, as the longest of three terms:

| Copy | Term | At the defaults |
|---|---|---|
| Borg archives | The age at which a prune removes an archive, from `BACKUP_KEEP_*` and the gap between runs (`BACKUP_INTERVAL` plus six hours) | 187 days |
| The append-only remote | The archive term plus `BACKUP_REMOTE_COMPACTION_DAYS` | Unbounded without the setting |
| Snapshots under `backups/` | `BACKUP_SNAPSHOT_MAX_AGE_DAYS` plus a day | Unbounded without the setting: snapshots are kept by count |

A project that relies on the horizon sets `BACKUP_HORIZON_REQUIRED`, and `manage.py check` then refuses the deployment while any term is unbounded or a value does not parse. Elsewhere only the remote term is reported, as a warning. Setting `BACKUP_SNAPSHOT_MAX_AGE_DAYS` below the archive term keeps snapshots from lengthening the horizon. The bound assumes the backups run: a stopped borg service, an unreachable remote or a run longer than six hours each delay a prune past it, which is what the monitor is for.

## Settings

| Variable | Default | Description |
|---|---|---|
| `BORG_PASSPHRASE` | Generated by `init_env` | Passphrase of the repositories. Empty turns the built-in backups off; the borg container then logs a failure each cycle |
| `BACKUP_LOCAL_ENABLED` | `true` | Keep the local repository in the `borg-data` volume |
| `BORG_REMOTE_REPO` | *(empty)* | Off-host SSH repository, as `user@host:/path` or `ssh://user@host/path` |
| `BORG_SSH_KEY_PATH` | *(empty)* | Host path to the SSH private key for the remote, mounted as `/root/.ssh/id_borg` |
| `BORG_SSH_KNOWN_HOSTS_PATH` | *(empty)* | Host path to a known_hosts file with the remote's host key, mounted as `/root/.ssh/known_hosts` |
| `BORG_RSH` | `ssh -i /root/.ssh/id_borg -o StrictHostKeyChecking=yes -o UpdateHostKeys=no` | The SSH command. Keep `-i /root/.ssh/id_borg` when overriding it, or the key is never offered |
| `BORG_ARCHIVE_PREFIX` | `epicurrents` | Archive name prefix, which retention matches on |
| `BACKUP_INTERVAL` | `86400` | Seconds between backup runs |
| `BACKUP_KEEP_DAILY` | `7` | Daily archives kept |
| `BACKUP_KEEP_WEEKLY` | `3` | Weekly archives kept |
| `BACKUP_KEEP_MONTHLY` | `5` | Monthly archives kept |
| `BORG_MONITOR_URL` | *(empty)* | Healthchecks-compatible ping URL, pinged on start, finish and failure |
| `BORG_MONITOR_SEND_LOGS` | `false` | Attach the run's log tail to each ping |
| `BACKUP_LOCAL_ONLY` | `false` | Acknowledge a deployment with no remote repository, which silences the boot warning |
| `BACKUP_REMOTE_COMPACTION_DAYS` | *(empty)* | How often the remote's administrator compacts it, in days |
| `BACKUP_SNAPSHOT_MAX_AGE_DAYS` | *(empty)* | Remove snapshots under `backups/` older than this many days. Empty keeps them by count |
| `BACKUP_HORIZON_REQUIRED` | `false` | Set by a project that dates pooled files by the backup horizon; `manage.py check` then refuses a deployment whose horizon cannot be computed |
