[[toc]]

## Components overview

The interface is composed of four main main components:
- `Viewport`: This contains the visualization of the selected study (for example EEG channels) and is always visible.
- `Menubar`: The menubar on top of the window contains a set of global controls (i.e. they are available irrespective of a study being open or not) and study-specific controls. It can be hidden.
- `Dataset`: The left hand panel contains controls for creating and opening datasets, as well as opening files within a dataset. This component can be hidden, however a set of quick action are always visible on the left edge of the *Viewport* controls bar.
- `Footer`: The footer bar on the bottom of the page displays information about on-going processes in different application modules and contains a system status menu.

## The viewport component

TBA

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

The quick actions that are always displayed at the right edge of the controls bar are:
- `[[icon:bars]]` Toggles the dataset navigator; if the navigator is visible clicking this hides it and vice versa.
- `[[icon:angle-up]]` Selects the item that is above the currently open item in the dataset navigation. This control is disabled if there is no preceding item (i.e. the currently open item is the first item in the dataset).
- `[[icon:angle-down]]` Selects the item that is below the currently open item in the dataset navigation. This control is disabled if there is no following item (i.e. the currently open item is the last item in the dataset).

## The footer component

The footer is separated into two parts:
- The part below the `viewport` shows information regarding the opened resource.
- The part below the `dataset` navigator shows information about the dataset. The button on the left edge of the `dataset` footer opens a system menu that shows general information about system resources. Warnings and errors in the system log can also be viewed and exported from this menu.
