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

## API layout

| Prefix | Purpose |
|---|---|
| `/api/v1/` | Core platform (health, recordings, library, annotations, federation, user, activity, notifications) |
| `/project/api/v1/` | Active project plugin endpoints (mounted when `EPICURRENTS_PROJECT` is set) |
| `/annotations/api/v1/` | Annotation CRUD (events, interruptions, labels) |
| `/recordings/api/v1/` | File upload, download, status, soft-delete |
| `/.well-known/` | Federation public key document |
