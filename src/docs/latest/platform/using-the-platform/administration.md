[[toc]]

## Overview

Staff and superusers administer a deployment from `Administration` in the user menu. It has three tabs: `Accounts`, `Groups` and `Maintenance`. Staff can read everything there; changing anything requires a superuser, and a staff account sees the pages without their controls. The first superuser is created when the deployment is installed (see [Admin user](docs/platform/deployment#admin-user)); every account after it is created here.

Two further staff pages are in the main navigation: [Viewer settings](#viewer-settings) and [Export annotations](#exporting-annotations).

## Confirming sensitive changes

Changes that could give someone a way into the platform ask you to confirm it is you, with your password and, if you use two-step verification, an `Authenticator or recovery code`. This covers changing an account's staff tier or email address, activating an account, adding an account to a group, setting a role on a group, setting a password, clearing a second factor, and running most maintenance operations. Renames and removals do not ask. Repeated failed confirmations lock confirmation for a few minutes.

## Accounts

The `Accounts` tab lists every account, inactive ones included, with its status, whether it has a second factor and its tier. Search by username, name or email.

### Creating an account

Select `New account` and fill in the `Username`, `Email`, `First name` and `Last name`, and tick `Staff` or `Superuser` if needed. Select `Create account`.

The account is created without a password, and an email invites the holder to choose their own. The link is valid for three days. Sending invitations needs the deployment's outgoing mail to work; if it is not configured the page says that no invitation was sent. Use the `Send a test email` operation on the [Maintenance](#maintenance) tab to check mail before inviting anyone. `Set a password myself` lets you set the password instead, for an account with no address to send to; you then pass the password on yourself.

### The account page

Select an account to open its page:

- **`Details`**: name, email, `Active`, `Staff` and `Superuser`, saved with `Save details`. Deactivating an account ends its sessions. The last active superuser cannot be demoted or deactivated.
- **`Groups`**: tick the groups the account belongs to and select `Save groups`. Group membership is set here, not on the group page. Affiliations are marked in the list.
- **`Roles`**: the roles the account holds through its groups, each with the groups that carry it. Roles are assigned on groups, not on accounts.
- **`Sign-in`**: when the account last signed in and whether it has a second factor. `Set password` sets a new password; it does not sign the account out of open sessions, so deactivate the account instead if its credentials may be compromised. `Resend invitation` appears while the holder has not yet chosen a password. `Clear second factor` removes the second factor for someone who lost their authenticator; the account signs in with its password alone until it sets one up again.

For your own account, change the password and second factor on your [profile](docs/platform/using-the-platform/profile). An account that signs in through an external provider has no password on the platform to set or reset.

### Removing an account

Accounts are not deleted from the web interface. Deactivate an account to stop it signing in. To erase an account, the operator runs the `erase_user` command on the host, which also removes the recording and media files the account owns and scrubs its personal data from the audit trail. See [Data protection](docs/platform/data-protection#erasure-and-retention).

## Groups

The `Groups` tab lists the groups with their member and grant counts. Groups carry access grants and roles, and members receive both through their membership.

- **`New group`** creates a group from a `Group name`. Tick the affiliation option to create an [affiliation](#affiliations) instead.
- **The group page** renames the group and sets its roles (`Save group`). Its `Members` list is read-only and links to each account; membership is changed on the account page.
- **`Delete group`** removes the group. Members keep their accounts and lose only what the group conveyed. A group that is still the target of access grants cannot be deleted until those grants are revoked.

Some groups belong to another feature, such as the contributor group of a [submission pool](docs/platform/using-the-platform/datasets#submission-pools). Their page says which feature owns them; they carry no access grant or role and are removed with their owner. You manage their members like any other group's.

### Roles

A project running on the deployment may register roles. The group page shows a selector for each role that applies to the group, with `No role` to clear it. Every member of the group then holds that role. The selectors and their choices come from the deployment, so what the roles mean is described by the project, not here. A deployment without project roles shows no selectors.

### Affiliations

An affiliation is a group that records the organisation its members belong to, such as a hospital or university. It grants nothing: no access grant can target it, and it carries only the roles a project scopes to affiliations. Members see their affiliations on their profile page. A group becomes an affiliation when it is created; an existing group cannot be converted.

## Maintenance

The `Maintenance` tab appears only where the deployment has remote maintenance turned on. It lets superusers carry out management tasks without a shell on the host. Staff can view the state and job history. Turning the feature on and installing the host agent are operator tasks, described in [Updating](docs/platform/operations/updating#remote-maintenance).

The top of the tab shows the `Installed version`, whether `Remote updates` are enabled, the state of the `Host agent` and the release key. Warnings appear when the platform is locked for maintenance or when host operations cannot be requested.

### Operations

`Operations` lists what the deployment can run, each with a description. `Run` opens a form for the operation's arguments; operations marked `Confirmation required` ask for your credentials. One job runs at a time. The core operations include:

| Operation | What it does |
|---|---|
| `Send a test email` | Sends a test message to the superusers, to check outgoing mail |
| `Verify audit-trail integrity` | Checks the audit trail for tampering |
| `De-identification report` | Reports which de-identification version each recording was written with |
| `Grant assessments` | Lists the contextual assessments recorded on access grants and when they are due |
| `Release dataset members` | Runs a release of a release-gated dataset |
| `Dataset access report` | Counts reads of a release-gated dataset's members, without naming readers |
| `Take a snapshot` | Snapshots the code, database and configuration on the host (remote updates only) |
| `Update the platform` | Applies an uploaded update package (remote updates only) |
| `Roll back to a snapshot` | Restores a snapshot (remote updates only) |

Projects and plugins can add operations of their own.

### Jobs

`Jobs` lists every requested operation. A job's page shows its timeline, its output and, for host operations, the agent's log. A job not yet picked up can be withdrawn with `Cancel request`. `Mark as failed` frees the slot when the process running a job has gone away; it stops nothing on the host.

### Updating the platform

Where remote updates are enabled:

1. Under `Update packages`, select `Upload package` and choose the three files of a release together: the archive (`.tar.gz`), its manifest (`.manifest.json`) and the signature (`.manifest.sig`). The package is verified against the deployment's release key before it is kept.
2. Select `Apply` on the package, or run `Update the platform`. The platform is locked while the update runs, and a snapshot is taken first.
3. When the update is running, its job page asks you to check that the platform works and then `Confirm update` before the time shown runs out. Without a confirmation the update is rolled back when the window closes. `Roll back` undoes it at once.

Rolling back restores the database as it was before the update unless the update applied no database change; everything written since is then lost. `Snapshots on the host` lists the available snapshots with `Take a snapshot` and `Roll back to this`. If accounts were erased after a snapshot was taken, restoring it asks you to acknowledge that their personal data comes back until the erasure is repeated.

## Viewer settings

`Viewer settings` in the navigation (staff) holds deployment-wide overrides of the viewer's defaults. Each entry maps a dotted setting path to a value, such as `"eeg.defaultMontage": "lon"`. The page shows the project defaults, your `Overrides` and the `Effective configuration` the viewer applies. A dataset can override these again from its own page (see [The dataset page](docs/platform/using-the-platform/datasets#the-dataset-page)).

## Exporting annotations

`Export annotations` in the navigation (staff) downloads events, labels and any annotation types the project adds as a file for analysis elsewhere.

- **`Contents`**: the annotation types and the `Format`, JSON (every type in one file) or CSV (one type per file).
- **`Annotators`**: whose annotations to include. Exported files identify annotators by user ID number only, and this list is what maps the IDs back to people, so it stays on the platform.
- **`Filters`**: a `Dataset`, a `From` and `To` date and a signal `Version`. Empty fields place no limit.
- **`Text`**: `Withhold text written by other annotators` exports other annotators' entries without their text, keeping timing, codes and annotator IDs, for a recipient who may not read annotation text.

Exporting across annotators is for superusers unless the deployment opens it to staff; otherwise the export covers your own annotations. An exported file is pseudonymised personal data of the recording subjects, and its header says so. Handle it under the same policy as the recordings it describes.
