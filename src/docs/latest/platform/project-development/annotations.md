[[toc]]

## Extending annotations from a project plugin

The platform ships a generic annotation system in the `annotations` app.  Four concrete types — `Event`, `Interruption`, `Label`, and `Annotation` — all extend an abstract `AnnotationBase` that provides a generic FK target (any Django model), a 32-character `object_hash` unique per target, a 64-character `content_hash` that covers every type-specific field, and `author` / `created_at` / `modified_at` timestamps.

A fifth model, `Code`, attaches standardised classification codes (ICD-10, SNOMED, LOINC, or custom standards) to any `Event`, `Interruption`, or `Label` via a generic FK.

## Why not add fields to `AnnotationBase`?

`AnnotationBase` is abstract.  Adding a field there:
- Requires a migration on **all four** concrete tables at once
- Invalidates every stored `content_hash` (the hash covers all non-audit fields)
- Couples a project-specific concept to the shared core schema

Use `Code` instead for any project-specific semantic labeling.

## Using `Code` for project-specific labeling

`Code` has three relevant fields:

| Field | Type | Purpose |
|---|---|---|
| `standard` | `CharField(64)` | Namespaced identifier for the coding system |
| `value` | `CharField(128)` | The code value within that system |
| `meta` | `JSONField(null=True)` | Arbitrary structured metadata |

### Naming convention

Use a dot-separated hierarchy to namespace the standard:

```
epicurrents.<project>.<concept>
```

Examples:
- `epicurrents.edu.mark` — instructor evaluation mark in the edu project
- `epicurrents.epicai.confidence` — model confidence score in the epicai project

### Example: edu annotation marks

The `edu` project uses `Code` to attach instructor evaluation results to student annotation events without touching `AnnotationBase`:

```python
from annotations.models import Code, Event
from django.contrib.contenttypes.models import ContentType

_MARK_STANDARD = 'epicurrents.edu.mark'

# Set a mark with an optional numeric score
Code.objects.update_or_create(
    content_type=ContentType.objects.get_for_model(Event),
    object_id=str(event.pk),
    standard=_MARK_STANDARD,
    defaults={
        'value': 'correct',           # 'correct' | 'incorrect' | 'reference'
        'meta': {'score': 8.5},
    },
)

# Read the mark back
code = event.codes.filter(standard=_MARK_STANDARD).first()
if code:
    mark = code.value           # 'correct'
    score = code.meta.get('score') if code.meta else None
```

### Exposing marks through the project API

Do **not** expose `Code` rows or the `standard` string directly to API consumers.  Instead wrap the interaction in a dedicated endpoint that:

1. Validates the `value` against an allowed set
2. Resolves the annotation by its edu `object_hash` (not by PK)
3. Uses `update_or_create` keyed on `(content_type, object_id, standard)` to prevent duplicates

```python
# In projects/edu/urls.py
_VALID_MARKS = frozenset({'reference', 'correct', 'incorrect'})
_EDU_MARK_STANDARD = 'epicurrents.edu.mark'

@submissions_router.patch("/{token}/annotation-mark", auth=None)
def patch_annotation_mark(request, token: str, payload: AnnotationMarkIn):
    """PATCH body: { object_hash, mark, score? }"""
    ...
    Code.objects.update_or_create(
        content_type=event_ct,
        object_id=str(event.pk),
        standard=_EDU_MARK_STANDARD,
        defaults={'value': payload.mark, 'meta': meta},
    )
```

Callers send `{ mark: 'correct', score: 8.5 }` — the `epicurrents.edu.mark` standard is an implementation detail they never see.

## Content hash behaviour

Adding a `Code` to an annotation fires the `Code` post-save signal, which calls `recompute_content_hash()` on the parent annotation.  This is intentional: a marked annotation is semantically different from an unmarked one, and `ObjectChangeLog` should record the change.

If your project uses `Code` for labels that should **not** affect the content hash (unusual), you must call `Type.objects.filter(pk=...).update(content_hash=...)` directly after creating the Code to restore the previous hash.  This is strongly discouraged.

## `Code.meta` — JSONField

`meta` is a `JSONField(null=True, blank=True)`.  Use it for scalar or structured data that accompanies the code value but does not warrant a separate model field.  Keep it flat and avoid deeply nested structures — `meta` is not indexed and should not be used as a filter target in hot-path queries.
