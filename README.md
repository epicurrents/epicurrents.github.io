# Epicurrents main documentation

This repository holds the main Epicurrents documentation. It is built using Vue3 and Vite, and uses the WebAwesome component library.

This documentation is very much a work in progress and will be periodically updated.

## Code blocks

Fenced code blocks are highlighted when the fence names a language registered in [src/highlight.ts](src/highlight.ts): `bash`, `dotenv`, `js`, `json`, `python`, `ts`, `vue` and `yaml`, plus the aliases highlight.js gives them. A fence with no language, or one not registered there, renders as plain text, so a page that adds a language needs its grammar registered too. A block that names a language also gets a faint label in its top-right corner, with the display name from `LABELS` in the same file, or the fence text where it has none. Token colours are in [src/highlight.css](src/highlight.css) and use the Web Awesome semantic colours, which is what makes them follow the light and dark modes.
