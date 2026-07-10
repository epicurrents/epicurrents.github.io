[[toc]]

## Roles

The platform is software; it is not a data controller. Every deployment's operator is the controller for the personal data that deployment processes, and this page describes what the software does with that data so the operator can meet their own obligations — writing a privacy notice, signing processor agreements, and answering data-subject requests. It makes no compliance claim on the operator's behalf.

The living engineering companion — exact model fields, retention settings, erasure internals, and the current gap list — is the [GDPR compliance document](https://github.com/epicurrents/platform/blob/main/docs/gdpr-compliance.md) in the platform repository. This page is the stable summary; that document is the detail.

## What personal data the platform stores

Three families of data subjects, with different mechanics:

| Subjects | Data | Where it lives |
|---|---|---|
| **Account holders** — clinicians, researchers, students with accounts | Username, name, email, password hash, external-login identity, push-notification device registrations | The user account and its linked rows |
| **Recording subjects** — patients whose data is uploaded | Signal recordings (EDF/BDF), uploaded filenames, clinical annotation text, attached media, DICOM data (dicom project) | Recording, media, and annotation storage |
| **Third parties** — people incidentally mentioned | Free-text mentions in notes or search queries | Prevented where possible: search queries are stored hashed, credential and identifier fields are masked out of audit records |

The platform keeps a tamper-evident audit trail of data changes. Identifier and credential fields are excluded from audit records at write time (masked), so the permanent trail does not accumulate password hashes, encryption keys, patient-identifying filenames, or session credentials.

## Erasure and retention

**Account erasure.** The `erase_user` management command is the fulfilment path for an account holder's erasure request: it inventories the account's data (dry run by default), deletes the account and everything it owns — recordings and media including their files on disk, collections, datasets, annotations, sharing grants, push registrations, external-login identity — flushes the user's sessions, and scrubs the person's identifiers from the audit trail while keeping the trail's integrity chain verifiable. The erasure itself is recorded.

**Recording erasure.** Deleting a recording (or media file) moves it to a trash state; a scheduled task permanently removes the database rows and the files after the retention window. De-identification also happens at the front door: EDF/BDF patient-identification header fields are blanked during upload processing.

**Retention windows.** All operator-tunable:

| Data | Default retention | Setting |
|---|---|---|
| Trashed recordings | 30 days, then purged | `RECORDINGS_TRASH_RETENTION_DAYS` |
| Trashed media files | 30 days, then purged | `MEDIA_TRASH_RETENTION_DAYS` |
| Trashed collections / datasets | 30 days, then purged | `LIBRARY_TRASH_RETENTION_DAYS` |
| Request log (audit trail activity) | Archived after 90 days | `ACTIVITY_ARCHIVE_AFTER_DAYS` |
| Federation access log | ~6 years, then pruned | `FEDERATION_AUDIT_RETENTION_DAYS` |
| Login sessions | 12 hours | `SESSION_COOKIE_AGE` |

Change records in the audit trail are permanent by design, with personal data handled by the masking and erasure mechanisms above rather than by deletion.

## Where data leaves the deployment

The flows an operator needs on their processor list and in their privacy notice:

| Destination | What flows there |
|---|---|
| **Federated peer instances** | Recordings shared under a federation grant. Peers are separate controllers, not processors. Recordings are de-identified by default when served to a peer (anonymized header, stripped annotation text); serving raw bytes requires an explicit opt-out by the person granting access. |
| **Email provider** (operator-chosen SMTP) | Recipient addresses and account emails such as password-reset links. |
| **Browser push services** (Google, Mozilla, Apple) | A per-device delivery endpoint and message timing. Message content is end-to-end encrypted; the push service cannot read it. |
| **External login provider** (Microsoft Entra, when enabled) | Login events; the provider returns the user's identity to the platform. |
| **Tailscale** (when the tailnet deployment option is used) | Connection metadata only; traffic between nodes stays encrypted end-to-end. |

The platform includes no analytics, telemetry, or error-reporting services.

## What remains the operator's responsibility

- **Lawful basis and the privacy notice.** The tables above are the raw material; the notice itself is per-deployment.
- **Processor agreements** with the email provider and any other services the deployment adds, and controller-to-controller arrangements with federation peers.
- **Backups.** Encrypted backups retain erased data until snapshots rotate out (about six months at default settings). Record erasure-request dates; if an older snapshot is ever restored, re-run the erasure afterwards.
- **The preserved-originals volume.** When original-upload preservation is enabled, that volume is outside the platform's reach by design — the erasure command lists the affected entries, and removing them is a manual operator step.
- **Log and SIEM retention** downstream of the deployment, if logs are shipped off the host.
