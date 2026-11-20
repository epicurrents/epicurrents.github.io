[[toc]]

## Components overview

The interface is composed of five main components:
- `Viewport`: This contains the visualization of the selected study (for example EEG channels) and is always visible.
- `Menubar`: The menubar on top of the window contains a set of global controls, available whether or not a study is open, and study-specific controls. It is always visible.
- `Controls`: The [controls bar](docs/user-interface/interface-layout#viewport-controls) directly above the viewport. It can be hidden.
- `Dataset`: The left hand panel contains controls for creating and opening datasets, as well as opening files within a dataset. This component can be hidden, however a set of quick actions are visible on the left edge of the controls bar.
- `Footer`: The footer bar on the bottom of the page displays information about on-going processes in different application modules and contains a system status menu. It can be hidden.

## The viewport component

The viewport is responsible for displaying the actual data of the opened study. Its capabilities depend on the study type.

### Viewport controls

All viewports have a `controls` bar on the top. Like the viewport itself, the content of the controls bar depend on the type of the study.

Common to all viewports are a set of three icons at the left end of the controls bar that provide quick actions for the current `dataset`:
- `[[icon:bars]]` Toggles the dataset navigator; if the navigator is visible clicking this hides it and vice versa.
- `[[icon:angle-up]]` Selects the item that is above the currently open item in the dataset navigation. This control is disabled when the open item is the first in the dataset.
- `[[icon:angle-down]]` Selects the item that is below the currently open item in the dataset navigation. This control is disabled when the open item is the last in the dataset.

The same actions have hotkeys: `` ` `` (backquote) toggles the dataset navigator, `` Alt+` `` opens the next item and `` Alt+Shift+` `` the previous one.

## The menubar component

The menubar contains a mix of controls that depend on both the modules that are active in the application as well as the resource that is currently open.

### File menu

The file menu contains controls for opening and writing files as well as registering connectors for file sources. The actual contents depend on the set of `file readers` and `study modules` that are active in the application; see [opening files](docs/getting-started/opening-files#direct-file-sources) for its structure.

### Edit menu

The edit menu contains controls for undoing and redoing actions if the currently opened resource supports those actions.

### Display menu

The display menu's `Components` section shows or hides the `Controls`, `Navigator` and `Footer` components. In the biosignal view it also has a `Biosignal` section with a `Trends` submenu and an `Invert signal polarity` toggle.

### Settings menu

User preferences can be opened via the settings menu.

### Help menu

The help menu gives access to the in-app `Instructions` and the external `Online manual`.

### The three-dot menu

The three-dot menu `[[icon:ellipsis]]` at the right edge of the menu bar contains options to set the application into full-screen mode or expanded mode (`Expand viewer`), which hides the controls, the dataset navigator and the footer. The menubar stays visible, and `Collapse viewer` in the same menu returns to the normal layout.

## The dataset component

The dataset component has three parts from top to bottom: the dataset selector, the dataset inspector, and the dataset footer.

### Dataset selector

The dataset selector contains currently available datasets and an options to create a new dataset. Only resources from the currently active dataset are displayed in the inspector below.

### Dataset inspector

Resources from the active dataset are listed in the dataset inspector, grouped under a header for each modality. In addition to the name of the resource, the inspector shows basic information about each resource, depending on its type: the number of signals, the duration, the page count or the date. Clicking on a resource sets it active, and the close button (`[[icon:xmark]]`) on the item closes it. Only one resource can be active at a time. A study the dataset lists without having loaded it yet is loaded when it is opened.

### Dataset footer

The dataset footer is a part of both the `dataset` and the `footer` components, so it is only visible if both of those resources are visible. It displays basic information regarding the dataset and ongoing processes, as well as a toggle for a system menu.

## The footer component

The footer is separated into two parts:
- The part below the `viewport` shows information regarding the opened resource.
- The part below the `dataset` navigator shows information about the dataset. The button on the left edge of the `dataset` footer opens a system menu that shows general information about system resources. Warnings and errors in the system log can also be viewed and exported from this menu.
