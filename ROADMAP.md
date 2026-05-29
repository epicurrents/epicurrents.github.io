# Epicurrents docs — Roadmap

Items here are deferred improvements to the documentation site itself (build, navigation, presentation), not to the underlying platform or viewer. Content-level work belongs in the relevant source repository's own roadmap.

---

## Use Mermaid for diagrams

GitHub renders Mermaid natively in Markdown, and most static-site doc renderers (including the Vite + Vue setup this site uses) can render Mermaid via a plugin. In-repo READMEs across the platform currently use ASCII diagrams for flow / lifecycle illustrations because they're readable in raw text, but on the rendered docs site Mermaid would look noticeably better and is easier to maintain than carefully-tweaked ASCII.

Scope of the investigation:

- Pick a renderer for the Vite build (`vite-plugin-md` + `markdown-it-mermaid`, or render at runtime with `mermaid` JS — both are viable; trade-off is build-time vs. page-load cost).
- Decide where Mermaid lives: only on the docs site (source READMEs stay ASCII for editor / `cat` readability), or migrate source READMEs too (developers reading on GitHub.com see rendered diagrams; editor view loses them).
- Establish a style preset so diagrams across pages look consistent.

Not blocking anything — the ASCII diagrams in the platform READMEs work in both rendered and raw views, so the upside is presentation rather than function.
