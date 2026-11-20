[[toc]]

## Overview

The document module (`@epicurrents/doc-module`) displays text documents in the viewer. It knows no file format itself; two readers supply them:

| Reader | Formats | File types |
|---|---|---|
| `@epicurrents/htm-reader` | Markdown and HTML | `.md`, `.markdown`, `.htm`, `.html` |
| `@epicurrents/pdf-reader` | PDF, through [pdf.js](https://mozilla.github.io/pdf.js/) | `.pdf` |

The module is registered twice, once for each reader, and each registration has its own viewer: Markdown and HTML under the `htm` modality, PDF under `pdf`. The `full` edition includes both; the `eeg` edition includes neither.

## Opening documents

Markdown and HTML documents are opened from the `Pages` section of the `File` menu, which has an `Open markdown` and an `Open HTML` submenu. PDF documents are opened from the `Documents` section, under `Open PDF`. Each submenu holds `From file`, `From folder` and `From URL` (see [Opening files](docs/getting-started/opening-files)).

## Markdown and HTML

Markdown is rendered to HTML with [markdown-it](https://github.com/markdown-it/markdown-it). HTML embedded in a Markdown file is not rendered: it is escaped and shown as text.

An HTML file is read as it is and sanitized with [DOMPurify](https://github.com/cure53/DOMPurify) before it is displayed, so scripts and other active content in the file do not run in the viewer. The same sanitizing applies to rendered Markdown.

The controls bar sets the text size:

- `[[icon:minus]]` `Decrease size` and `[[icon:plus]]` `Increase size` step the size by 10 %.
- **Scale** selects a size from 50 % to 200 %.

## PDF

A PDF page is rendered to a canvas scaled to fit the viewer, and re-rendered when the viewer is resized. The page is drawn as an image, so its text cannot be selected or searched.

The controls bar pages through the document:

- `[[icon:chevron-left]]` `Previous page` and `[[icon:chevron-right]]` `Next page`.
- **Page** selects a page by number and shows the page count beside it. It is disabled for a single-page document.

The arrow keys page as well: `→` and `↓` go to the next page, `←` and `↑` to the previous one. They follow the [Require Alt for hotkey actions](docs/user-interface/settings#require-alt-for-hotkey-actions) setting.

## Settings

Neither viewer adds a settings tab.

## Registering the module

The builder registers the module under each reader's modality key, `htm` (`setup/modules/htm.ts`) and `pdf` (`setup/modules/pdf.ts`), and an edition activates them by listing those keys in its `activeModules`. Each format gets its own importer, because a reader hands over the worker for the format it was constructed with.

Markdown and HTML, shown for Markdown; HTML is the same with `'html'`, `HtmlWorkerSubstitute` and the `doc/html-*` keys:

```ts
import * as interfaceDocModule from '@epicurrents/interface/modules/doc'
import * as docModule from '@epicurrents/doc-module'
import { HtmImporter, MarkdownWorkerSubstitute } from '@epicurrents/htm-reader'

app.registerModule('htm', docModule)
const inWorker = () => useSAB && window.__EPICURRENTS__.RUNTIME!.SETTINGS.getFieldValue('doc.useMemoryManager')
const mdReader = new HtmImporter('markdown')
mdReader.setWorkerOverride('markdown', () => inWorker() ? mdWorker() : new MarkdownWorkerSubstitute())
const mdLoader = new docModule.DocumentLoader('HTMLoader', 'htm', mdReader)
app.registerStudyImporter('doc/htm-file', 'Open markdown file', 'file', mdLoader)
app.registerStudyImporter('doc/htm-folder', 'Open markdown files from folder', 'folder', mdLoader)
app.registerStudyImporter('doc/htm-url', 'Open markdown from URL', 'url', mdLoader)
registerInterfaceModule('htm', interfaceDocModule)
```

`doc.useMemoryManager` is off by default, so the Markdown and HTML processors run on the main thread unless a host turns it on.

PDF:

```ts
import * as interfacePdfModule from '@epicurrents/interface/modules/pdf'
import * as docModule from '@epicurrents/doc-module'
import { PdfImporter } from '@epicurrents/pdf-reader'

app.registerModule('pdf', docModule)
const pdfLoader = new docModule.DocumentLoader('PDFLoader', 'pdf', new PdfImporter(pdfWorkerUrl()))
app.registerStudyImporter('doc/pdf-file', 'Open PDF file', 'file', pdfLoader)
app.registerStudyImporter('doc/pdf-folder', 'Open PDF files from folder', 'folder', pdfLoader)
app.registerStudyImporter('doc/pdf-url', 'Open PDF from URL', 'url', pdfLoader)
registerInterfaceModule('pdf', interfacePdfModule)
```

pdf.js runs its own worker and loads it from an address, so `PdfImporter` takes the URL of the worker bundle rather than a worker override. That bundle must be the same pdf.js version as the library the page loads; pdf.js refuses every document when the two differ. A study is one PDF document: if a study holds several files, the first is shown and the rest are ignored.

`mdWorker`, `pdfWorkerUrl`, `useSAB` and `registerInterfaceModule` come from the builder's setup.

| Export | Package | Role |
|---|---|---|
| `DocumentLoader` | `doc-module` | Builds a `PaginatedDocument` from a loaded study and the reader's worker. |
| `PaginatedDocument` | `doc-module` | The resource: page count, current page and the page content. |
| `HtmImporter` | `htm-reader` | Importer for one format, `'markdown'` or `'html'`. |
| `MarkdownWorkerSubstitute`, `HtmlWorkerSubstitute` | `htm-reader` | The processors, run on the main thread. |
| `PdfImporter` | `pdf-reader` | Importer for PDF, taking the pdf.js worker URL. |

A reader returns the document's markup unsanitized; the interface sanitizes it immediately before display. A host that displays reader output in its own page has to sanitize it there.
