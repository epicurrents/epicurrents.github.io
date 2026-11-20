[[toc]]

## Overview

The Epicurrents platform is the server-side backend that powers an Epicurrents deployment. It provides the REST API, file processing pipeline, authentication, object permissions, and federated data sharing that the viewer library connects to.

The platform is open-source and available on [GitHub](https://github.com/epicurrents/platform).

## Architecture

| Layer | Technology | Role |
|---|---|---|
| API | Django 6 + Django Ninja | REST endpoints, authentication, permissions |
| Workers | Celery + Redis | Async file processing, push notifications, scheduled tasks |
| Database | PostgreSQL (production) / SQLite (development) | Primary data store |
| Frontend | Vue 3 + Vite + TypeScript | Single-page application served by Django |
| Storage | Filesystem (configurable path) | EDF/BDF recording files |

All services are packaged as a Docker Compose stack. See [Deployment](docs/platform/deployment) to get started.

## Project plugins

The platform is designed to be extended with *project plugins* — self-contained modules that add models, API endpoints, and settings for a specific deployment use-case. Only one project is active at a time, selected by the `EPICURRENTS_PROJECT` environment variable.

See [Project development](docs/platform/project-development) for both integration patterns.

*Plugins* are the composable counterpart: any number can be enabled at once through `EPICURRENTS_PLUGINS` (comma-separated), and they compose with whichever project is active rather than owning the primary interface.

## API layout

| Prefix | Purpose |
|---|---|
| `/api/v1/` | Core platform: health, and under it `user/`, `activity/`, `notifications/`, `library/`, `federation/` and `maintenance/` |
| `/recordings/api/v1/` | Recording upload, download, status, soft-delete |
| `/annotations/api/v1/` | Annotation CRUD (annotations, events, interruptions, labels) and classification codes |
| `/media/api/v1/` | Non-signal media files: upload, download, soft-delete |
| `/compute/api/v1/` | Server-side computation, such as EEG lead fields |
| `/project/api/v1/` | Active project's API endpoints (mounted when `EPICURRENTS_PROJECT` is set) |
| `/project/<name>/` | Active project's plain Django views, such as a project page or viewer |
| `/plugin/<name>/api/v1/` | Each enabled plugin's API endpoints |
| `/plugin/<name>/` | Each enabled plugin's plain Django views |
| `/.well-known/` | Federation public key document |
