[[toc]]

## Overview

When the Epicurrents viewer is embedded inside a larger application — for example, the Epicurrents platform's `ViewerView.vue` — components outside the viewer's own module boundary need to react to viewer events: the user opens a recording, scrolls to a new time position, adds an annotation, and so on.

The viewer exposes a shared `EventTarget`-compatible bus on `window.__EPICURRENTS__.EVENT_BUS`. Any script on the same page can subscribe to it, regardless of which framework or build system it uses.

## Waiting for the bus

`window.__EPICURRENTS__.EVENT_BUS` is `null` at page load and is assigned during viewer initialisation. A component that tries to subscribe in `onMounted` synchronously will get `null` and register nothing.

Use `waitForEventBus()` to defer registration until the viewer is ready:

```ts
import { waitForEventBus } from '../eventBus'  // path relative to your project

let isMounted = false

onMounted(async () => {
    isMounted = true
    let bus: EventTarget
    try {
        bus = await waitForEventBus()
    } catch {
        // Viewer never initialised (e.g. user navigated away) — nothing to do
        return
    }
    if (!isMounted) return  // component was destroyed while we were waiting

    bus.addEventListener('property-change:activeResources', onActiveResourcesChanged)
})

onUnmounted(() => {
    isMounted = false
    window.__EPICURRENTS__?.EVENT_BUS
        ?.removeEventListener('property-change:activeResources', onActiveResourcesChanged)
})
```

`waitForEventBus()` polls every 50 ms and resolves once the bus is non-null. It rejects after 10 seconds if the viewer never initialises.

Always check `isMounted` after the await — the component may have been destroyed while waiting, in which case registering a listener would be a memory leak.

## Useful events

All events are `CustomEvent` instances. The relevant data is in `event.detail`.

| Event name | Fired by | `detail` fields | When |
|---|---|---|---|
| `property-change:activeResources` | `GenericDataset` | `newValue: DataResource[]` | Recording opened or switched in the viewer |
| `property-change:displayViewStart` | `GenericBiosignalResource` | `newValue: number` (seconds) | View scrolled — fires continuously during scrolling |
| `property-change:viewStart` | `GenericBiosignalResource` | `newValue: number` (seconds) | View position committed after scroll inertia settles |
| `property-change:events` | `GenericBiosignalResource` | `newValue: BiosignalEvent[]` | Annotation created, moved, or deleted |
| `add-dataset` | `RuntimeStateManager` | `payload: dataset object` | New dataset loaded |
| `set-active-resource` | `RuntimeStateManager` | `payload: DataResource \| null` | Active resource changed |

## Event detail shape

Property change events follow this shape:

```ts
{
    property: string,    // e.g. 'activeResources'
    newValue: unknown,   // the value after the change
    oldValue: unknown,   // the value before the change
    phase: 'before' | 'after',
    scope: string,       // asset ID of the emitter
    origin: unknown,     // emitting asset instance
}
```

Payload events (like `add-dataset`) follow this shape:

```ts
{
    payload: unknown,    // the event-specific data
    phase: 'before' | 'after',
    scope: string,
    origin: unknown,
}
```

Each event is dispatched twice — once with `phase: 'before'` and once with `phase: 'after'`. For `property-change` events, `newValue` reflects the in-progress value during `'before'` and the final committed value during `'after'`. In most cases you want the `'after'` phase:

```ts
bus.addEventListener('property-change:viewStart', (e: Event) => {
    const detail = (e as CustomEvent).detail
    if (detail.phase !== 'after') return
    const newStart: number = detail.newValue
    // update your panel to match the new time position
})
```

## Reading current state without waiting for an event

If your component needs the current resource at mount time (after the bus is live), read it directly from the runtime:

```ts
const runtime = (window.__EPICURRENTS__ as any)?.RUNTIME
const resource = runtime?.APP?.activeDataset?.activeResources?.[0] ?? null
```

This is safe to call at any point after `waitForEventBus()` has resolved. It returns `null` if no recording is open.

## Using the `ViewerPlugin` interface

For deeper integration, the platform's `ViewerView.vue` exposes a `ViewerPlugin` hook that is called at key points in the viewer lifecycle. This is preferred over raw event subscriptions when you need to run setup logic after the viewer has fully initialised.

See the [Implementation](docs/implementation#embedding-with-a-viewerplugin) page for the full interface and usage example.
