[[toc]]

## Requirements

The base Epicurrents library and its core modules can be run in most modern web browsers. Some features, most notably the SharedArrayBuffer-dependent memory management option and FileSystem API for opening files from the local file system have only been tested in Google Chrome and MS Edge, and full functionality is currently only supported in Chromium-based browsers.

Even though the Epicurrents as an application is platform-agnostic, many of the features of the default library require either the use of a mouse and keyboard or a touch-screen.

Lack of available memory may limit the availability of features or cause instability. Recommended RAM for tabletop and laptop computers is 8 Gb or higher.

## Progressive web application

The default user interface is designed to be used on desktop and laptop computers and works best as a progressive web application (PWA). The installation procedure depends on the browser used; the following applies to Google Chrome specifically.

### Installing as a PWA

To install the viewer as a progressive web application, click on the *install icon* (![install-icon](/img/install-pwa-icon-chrome.svg)) on the right end of the browser address bar and confirm the installation. The application will open into a standalone window and can be launched as a separate app from now on.

![install-icon-location](/img/install-pwa-chrome.png)

### Uninstalling the PWA

To modify or uninstall the application, write `chrome://apps` on the browser address bar and hit enter. This will open a progressive web app directory with a link to the Epicurrents viewer. Right-clicking on the application icon will open a context menu with an option to uninstall the application.

![pwa-directory](/img/pwa-directory-chrome-scaled.png)

## Running from a single HTML file

The application can also be saved on the device as a HTML file and then opened even when not connected to the internet. However, services and some advanced features are not available without an active internet connection.

## Using a package manager

Epicurrents is hosted on NPM under the namespace @epicurrents. To install the modules please follow the instructions of your package manager of choice.

## Building from source

Most modules include build configuration for Webpack, with the exception of the default interface module that uses Vite. Please see the [Development](docs/development) section for more details.
