[[toc]]

## Overview

Open `Profile` from the user menu at the right end of the navigation bar.

## Personal information

Edit your `First name`, `Last name` and `Email` and select `Save changes`. Password reset links are sent to your email address, so changing it asks you to confirm with your password (and your authenticator code, if two-step verification is on).

If you belong to any affiliations, they are listed under `Affiliations`: the organisations your account belongs to. An administrator sets them.

## Changing your password

Under `Change password`, enter your `Current password`, then the `New password` twice. The deployment's password rules apply, and a password that does not meet them is refused with the reason.

An account that signs in through an external provider has no password on the platform; the section says so, and the password is changed with the provider.

## Two-step verification

Two-step verification asks for a code from an authenticator app in addition to your password when you sign in.

1. Under `Two-step verification`, select `Turn on` and confirm your password.
2. Scan the code with your authenticator app, or enter the key shown under `Cannot scan? Enter this key instead:`.
3. Enter the `Code from your authenticator` to confirm.
4. Save the recovery codes that are shown. Each one signs you in once if you lose your authenticator, and they are not shown again.

Once it is on, the section shows how many recovery codes remain. `Issue new recovery codes` replaces them, and `Turn off two-step verification` removes the second factor; both ask for your password.

If you lose your authenticator and have no recovery codes left, a superuser can clear the second factor on your account (see [Accounts](docs/platform/using-the-platform/administration#accounts)).

Two-step verification applies to password sign-in. An account that signs in through an external provider uses the provider's own second factor.

## Push notifications

Where the deployment has push notifications set up, your browser asks for permission to show notifications after you sign in. With permission granted, you are notified, for example, when an upload finishes processing. Signing out removes that browser's registration. You can withdraw the permission at any time in the browser's site settings.

## Viewer settings on your account

While you are signed in, settings you change in the viewer, such as the chosen montage, are saved to your account as well as to the browser, so they follow you to another computer. When the two differ, the account's copy wins.

## Colour theme

The theme picker next to the user menu switches between `Light`, `Dark` and `System`. The choice is kept in the browser. The viewer always uses the light theme.
