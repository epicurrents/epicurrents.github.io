[[toc]]

## General settings

Settings on the general tab affect either the general functionality of the application or all applicable study modalities.

### Saving preferences accross sessions

By default all settings are stored only for the current session. A session changes whenever the page is opened in a new tab, but survives page reloads in the same tab. It is possible to save settings information in a more persistent storage using a cookie. Enabling the `Use a cookie to store my settings locally` implies that the user gives their consent to the use of cookies.

All store settings only apply to the device **and** the browser in question.

### Require Alt for hotkey actions

By default, hotkey actions only require pressing the key in question. It is possible to change this functionality to require the `Alt` key (or `Opt` key on Mac) to be pressed for the action to be triggered. Note that this may conflict with actions on the browser itself.

### Signal scaling

The application support dynamic signals scaling based on the pixel-per-inch (PPI) ratio of the display. Unfortunately, a web application has not direct access to this information and no reliable means to automatically determine it. The default value for this setting, 96, is a common ratio on tabletop displays. However, for a high-definition laptop or table computer display it may be too low, resulting in a compressed amplitude and timebase.

If the exact PPI is known, it can be inserted manually. Alternatively, a ruler can be dragged to match 10 cm (about 4 inches) on the screen.

It is assumed that the pixels on the device are square shaped; the application uses a single value for both vertical and horizontal scaling.
