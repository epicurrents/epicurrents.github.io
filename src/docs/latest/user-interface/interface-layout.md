[[toc]]

## Components overview

The interface is composed of four main main components:
- `Viewport`: This contains the visualization of the selected study (for example EEG channels) and is always visible.
- `Menubar`: The menubar on top of the window contains a set of global controls (i.e. they are available irrespective of a study being open or not) and study-specific controls. It can be hidden.
- `Dataset`: The left hand panel contains controls for creating and opening datasets, as well as opening files within a dataset. This component can be hidden, however a set of quick action are always visible on the left edge of the *Viewport* controls bar.
- `Footer`: The footer bar on the bottom of the page displays information about on-going processes in different application modules and contains a system status menu.

## The viewport component

The viewport is responsible for displaying the actual data of the opened study. Its capabilities depend on the study type.

### Viewport controls

All vieports have a `controls` bar on the top. Like the viewport itself, the content of the controls bar depend on the type of the stydy.

Common to all vieports are a set of three icons at the left end of the controls bar that provide quick actions for the current `dataset`:
- `[[icon:bars]]` Toggles the dataset navigator; if the navigator is visible clicking this hides it and vice versa.
- `[[icon:angle-up]]` Selects the item that is above the currently open item in the dataset navigation. This control is disabled if there is no preceding item (i.e. the currently open item is the first item in the dataset).
- `[[icon:angle-down]]` Selects the item that is below the currently open item in the dataset navigation. This control is disabled if there is no following item (i.e. the currently open item is the last item in the dataset).

## The menubar component

The menubar contains a mix of controls that depend on both the modules that are active in the application as well as the resource that is currently open.

### Files menu

The files menu contains controls for opening and writing files as well as registering connectors for file sources. The actual contents depend on the set of `file readers` and `study modules` that are active in the application.

### Edit menu

The edit menu contains controls for undoing and redoing actions if the currently opened resource supports those actions.

### Display menu

The display menu contains controls for hiding or showing each of the interface components. It also allows switching the view if a resource supports multiple views.

### Settings menu

User preferences can be opened via the settings menu.

### Help menu

The help menu gives access to both external and in-app instructions, as well as general app information.

### The three-dot menu

The three-dot menu `[[icon:ellipsis]]` at the right edge of the menu bar contains options to set the application into full-screen mode or expanded mode, in which all other components but the `viewport` will be hidden.

## The dataset component

The dataset component three parts from top to bottom: the dataset selector, the dataset inspector, and the dataset footer.

### Dataset selector

The dataset selector contains currently available datasets and an options to create a new dataset. Only resources from the currently active dataset are displayed in the inspector below.

### Dataset inspector

Resources from the active dataset are listed in the dataset inspector. In addition to the name of the resource, the inspector shows basic information about each resource (such as the length of the recording and number of electrodes). Clicking on a resource toggles it, i.e. sets it active is it was inactive before and vice versa. Only one resource can be active at a time (for now).

### Dataset footer

The dataset footer is a part of both the `dataset` and the `footer` components, so it is only visible if both of those resources are visible. It displays basic information regarding the dataset and ongoing processes, as well as a toggle for a system menu.

## The footer component

The footer is separated into two parts:
- The part below the `viewport` shows information regarding the opened resource.
- The part below the `dataset` navigator shows information about the dataset. The button on the left edge of the `dataset` footer opens a system menu that shows general information about system resources. Warnings and errors in the system log can also be viewed and exported from this menu.
