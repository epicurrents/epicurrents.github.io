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
| `standard` | `CharField(64)` | Identifier for the coding system |
| `value` | `TextField` | The code value within that system |
| `meta` | `JSONField(null=True)` | Arbitrary structured metadata (the API accepts objects, lists, and scalars) |

### Naming convention

External standards use their own registry identifier as the `standard` string — `hed`, `icd10`, `snomed` — because there the string is the meaningful public identifier. Project-specific codes use a dot-separated hierarchy to namespace the standard:

```
epicurrents.<project>.<concept>
```

Examples:
- `epicurrents.myproject.mark` — an instructor's evaluation mark
- `epicurrents.myproject.confidence` — a model's confidence score

### Vocabulary validation

A project or plugin that owns a coding standard can register a validator from its `AppConfig.ready()`:

```python
from annotations.vocabularies import register_vocabulary

register_vocabulary(
    "epicurrents.myproject.mark",
    label="Evaluation marks",
    version="1",
    validator=validate_mark,  # (value, meta) -> None, raises ValueError
    term_name=mark_name,      # optional: a term's display name
    closed=True,              # an enumerated set of terms, no free placeholders
)
```

The validator receives `(value, meta)` and raises `ValueError` when the pair violates the vocabulary; the annotations API rejects such writes with 422. The other keyword arguments:

| Argument | Meaning |
|---|---|
| `closed` | The validator accepts only an enumerated set of terms. Ingest accepts a code a file declares only under a closed vocabulary, since under an open one the file chooses the value |
| `confined` | Every part of a value comes from a domain the validator declares — terms, identifiers from a closed set, numbers in a declared range — and never typed text. `closed` implies it |
| `canonicalise` | Rewrites a value into the one spelling the standard stores, before validation, for a grammar that admits several spellings of the same meaning |
| `write_meta` | Returns the `meta` a server-side writer stamps on a code of this standard, for a vocabulary whose validator pins its `meta` |
| `term_name` | Returns a term's display name, which ingest writes as the name of a row it creates from a code |

`annotations.vocabularies.validate_code(standard, value, meta)` runs the registered validator and returns the value in the vocabulary's canonical spelling; a writer stores what it returns, never what it was given.

The platform registers its own closed vocabularies: `epicurrents.biosignal` and `epicurrents.eeg` (what was done, given and observed during a recording, from the sets the viewer ships) and `epicurrents.psg` (sleep stages and scored events). `hed` is registered by the `hedscore` plugin when it is enabled. An unregistered `standard` is accepted unvalidated unless the deployment sets `ANNOTATION_CODE_STRICT_VOCABULARY = True` in its project settings, which rejects every unregistered standard.

API writes are validated. Ingest writes only codes of closed vocabularies: the events a file arrives with are translated into registered terms, and an event that does not translate becomes a text-free placeholder. A project's own endpoint or management command is not gated by the platform and calls `validate_code` itself.

### Example: evaluation marks

A teaching project can use `Code` to attach an instructor's evaluation results to student annotation events without touching `AnnotationBase`:

```python
from django.db import transaction

from annotations.codes import replace_codes
from annotations.vocabularies import validate_code

_MARK_STANDARD = "epicurrents.myproject.mark"

# Set a mark with an optional numeric score, keeping the event's other codes
meta = {"score": 8.5}
value = validate_code(_MARK_STANDARD, "correct", meta)  # 'correct' | 'incorrect' | 'reference'
codes = {code.standard: (code.value, code.meta) for code in event.codes.all()}
codes[_MARK_STANDARD] = (value, meta)
with transaction.atomic():
    replace_codes(event, codes)

# Read the mark back
code = event.codes.filter(standard=_MARK_STANDARD).first()
if code:
    mark = code.value  # 'correct'
    score = code.meta.get("score") if code.meta else None
```

`replace_codes` from `annotations.codes` is the sanctioned writer: it makes the parent's codes exactly the mapping it is given (a code it is not handed is deleted) and saves rows one at a time, so every change reaches the audit trail. It validates nothing; the calling path decides which codes it accepts first. Clients writing through the annotations API send codes inline with the event, interruption or label they belong to, as a `codes` object keyed by standard.

### Exposing marks through the project API

Do **not** expose `Code` rows or the `standard` string directly to API consumers.  Instead wrap the interaction in a dedicated endpoint that:

1. Validates the `value` against an allowed set
2. Resolves the annotation by its `object_hash` (not by PK)
3. Writes the code through `replace_codes` inside the write's transaction, which keeps one code per standard

```python
# In projects/myproject/urls.py
_VALID_MARKS = frozenset({"reference", "correct", "incorrect"})
_PROJECT_MARK_STANDARD = "epicurrents.myproject.mark"


@submissions_router.patch("/{token}/annotation-mark", auth=None)
def patch_annotation_mark(request, token: str, payload: AnnotationMarkIn):
    """PATCH body: { object_hash, mark, score? }"""
    ...
    codes = {code.standard: (code.value, code.meta) for code in event.codes.all()}
    codes[_PROJECT_MARK_STANDARD] = (payload.mark, meta)
    with transaction.atomic():
        replace_codes(event, codes)
```

Callers send `{ mark: 'correct', score: 8.5 }` — the `epicurrents.myproject.mark` standard is an implementation detail they never see.

## Annotation text under de-identified access

A read grant can carry de-identification, which blanks the patient-identification fields in a signal file's header and replaces the annotation text inside it. The annotation rows hold that same text, so the platform withholds it from a caller who did not write it: `Event.name` and `value`, `Label.name` and `value`, and `Annotation.content` come back empty and the row carries `text_withheld`. Timing, hashes and author ids are unaffected, as are a code's `standard` and `value`; a code's free-form `meta` follows the text.

An endpoint a project ships has to apply the same rule itself — nothing in the core can reach a serialiser it does not own:

```python
from annotations.redaction import withheld_row_ids
from epicurrents.permissions import get_read_access_result

terms = get_read_access_result(user=request.user, obj=recording)
if not terms.granted:
    raise HttpError(403, "You do not have permission to view this recording")

withheld = withheld_row_ids(rows, caller=request.user, terms=terms)
return [serialise(row, withhold_text=row.pk in withheld) for row in rows]
```

Resolve the caller's access as *terms* rather than as a boolean: `can_read_object` reaches the same decision but discards what the rule needs. Two exemptions are built in and need no work from a project — the caller's own rows, and rows whose producer has registered them as machine-generated, such as an analysis run's findings.

## Content hash behaviour

Adding a `Code` to an annotation fires the `Code` post-save signal, which calls `recompute_content_hash()` on the parent annotation.  This is intentional: a marked annotation is semantically different from an unmarked one, and `ObjectChangeLog` should record the change.

If your project uses `Code` for labels that should **not** affect the content hash (unusual), you must call `Type.objects.filter(pk=...).update(content_hash=...)` directly after creating the Code to restore the previous hash.  This is strongly discouraged.

## `Code.meta` — JSONField

`meta` is a `JSONField(null=True, blank=True)`.  Use it for scalar or structured data that accompanies the code value but does not warrant a separate model field.  Keep it flat and avoid deeply nested structures — `meta` is not indexed and should not be used as a filter target in hot-path queries.
