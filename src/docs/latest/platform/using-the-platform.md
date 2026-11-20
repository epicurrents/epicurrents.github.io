[[toc]]

## Overview

These pages are for people who sign in to an Epicurrents deployment through its web interface: clinicians and researchers working with recordings, dataset managers sharing them, and staff and superusers administering the deployment. Installing and configuring a deployment is covered under [Deployment](docs/platform/deployment) and [Configuration](docs/platform/configuration).

The web interface is where you upload recordings, organise them, share them through datasets and open them in the signal viewer. The viewer itself is documented under [User interface](docs/user-interface) and [Annotations](docs/annotations).

| Page | Covers |
|---|---|
| [Library](docs/platform/using-the-platform/library) | Uploading recordings, processing status, collections, media files, opening recordings in the viewer, the trash |
| [Datasets](docs/platform/using-the-platform/datasets) | Datasets, the dataset browser, sharing and share links, the catalogue and public listing, release-gated datasets and submission pools |
| [Profile](docs/platform/using-the-platform/profile) | Your details, password, two-step verification, push notifications, viewer settings that follow your account |
| [Administration](docs/platform/using-the-platform/administration) | Accounts, groups, roles and affiliations, the Maintenance tab, deployment viewer settings, annotation export |

A deployment may run a project or plugins that add their own pages and navigation entries. Those are not described here.

## Signing in

Open the deployment's address and sign in with your `Username` and `Password`. Accounts are created by an administrator, or on the first external login where the deployment allows that; there is no registration form.

### Two-step verification

If your account has two-step verification turned on, the sign-in asks for a `Verification code` after your password: the six-digit code from your authenticator app, or one of your recovery codes. Each recovery code works once.

A deployment can require two-step verification for staff accounts or for every account. If it is required and you have not set it up, the sign-in takes you through `Set up two-step verification`: scan the code with your authenticator app (or enter the key shown under `Cannot scan? Enter this key instead:`), enter the code the app shows and select `Confirm and sign in`. The next screen shows your recovery codes once. Store them somewhere other than the device holding your authenticator, then select `I have saved them, continue`.

Too many wrong codes lock the sign-in for a few minutes.

### External login

Where the deployment has an external identity provider set up, the sign-in page shows a `Sign in with <provider>` button below the password form. Your organisation's provider then handles the password and any second factor, and the platform has no password of its own for your account. The provider may refuse accounts from email domains the deployment does not admit.

### Accepting an invitation

A new account usually starts with an invitation email. Its link opens `Choose a password`; once you set one you can sign in. The link is valid for three days. If it has expired, ask whoever created your account to send it again.

### Forgotten password

Select `Forgot password?` on the sign-in page, enter your `Email address` and select `Send reset link`. If the address belongs to an account, a link arrives by email and opens `Set new password`. You can request a link once every five minutes. Accounts that sign in through an external provider reset their password with that provider instead.

### User agreement

A deployment can publish a user agreement. Until you have accepted the current version, signing in takes you to the `User agreement` page and nothing else is available. Read it and select `I accept`, or `Sign out`. When a new version is published you are asked again. The agreement page can also be read without signing in, at `/agreement`.

## Navigation

The navigation bar along the top holds:

| Entry | Page |
|---|---|
| `Home` | Recordings needing attention or still processing, your recent recordings, and the `Upload` button |
| `Library` | Your collections, unassigned recordings and failed recordings |
| `Datasets` | The datasets you created or that are shared with you |
| `Catalogue` | Released datasets you can read, and the deployment's public listing where it has one |
| `Export annotations` | Annotation export (staff) |
| `Viewer settings` | Deployment-wide viewer defaults (staff) |

On the right are the colour theme picker (`Light`, `Dark` or `System`) and the user menu with `Profile`, `Administration` (staff) and `Sign out`. The viewer has a light theme only, so the picker is disabled while the viewer is open and your choice applies again on other pages.

The navigation bar is hidden while the viewer fills the window.

## Access tiers

What you can do with a particular recording or dataset depends on whether you created it and what has been shared with you. Across the whole deployment, accounts sit in one of three tiers:

| Tier | In addition to the tier above |
|---|---|
| Account | Upload and organise your own recordings, create datasets and share them, read what is shared with you, annotate in the viewer |
| Staff | `Export annotations` and `Viewer settings` in the navigation, read-only `Administration` (accounts, groups, the Maintenance tab), creating tags |
| Superuser | Creating and changing accounts and groups, running maintenance operations, managing every dataset, exporting annotations across annotators unless the deployment opens that to staff |

A project may also register roles of its own, which are carried by groups. See [Roles](docs/platform/using-the-platform/administration#roles).

## Maintenance periods

While the platform is being updated or rolled back, a banner at the top of every page says so and the platform accepts no changes. The sign-in page says when signing in is possible again and checks by itself. After an update, the deployment may wait for a superuser to confirm it; during that window you can sign in and look around, but changes are not accepted until the update is confirmed. The page reloads by itself when the platform comes back on a new version.

## Data protection

Recordings are de-identified when they are uploaded: the identification fields in the file header are blanked, annotation text in the file is removed unless the uploader chose to keep it, and channel labels are rewritten into a standard form. The signal itself is unchanged, so what the platform stores and shares is pseudonymised personal data. Handle everything you download or export under the same policy as the original recordings. The details are in [Data protection](docs/platform/data-protection).
