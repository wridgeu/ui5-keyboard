# Documentation Index

This folder is organized by library area and document lifecycle.

## Areas

- [Hotkeys](./hotkeys/README.md)
- [Kiosk Keyboard](./kiosk/README.md)
- [Kiosk Keyboard Web Component](./kiosk-webc/README.md)
- [Shared](./shared/README.md)
- [Glossary](./GLOSSARY.md)
- [Proposals](./proposals/) (cross-cutting, not specific to one package; includes deferred [Future Improvements](./proposals/FUTURE-IMPROVEMENTS.md))
- [Specs](./specs/README.md) (dated design and validation records)

## Lifecycle

- `Current` docs describe the active architecture and consumer guidance.
- `proposals/` docs describe planned work; they can become stale if plans change.
- `specs/` docs are dated design specifications and adversarial-validation records.
- `history/` docs are implementation-era notes kept for context and traceability.

### Proposal Status Convention

Each proposal doc should include a status line near the top:

```
> Status: <status>
```

| Status          | Meaning                                               |
| --------------- | ----------------------------------------------------- |
| **Proposal**    | Idea documented, not yet committed to                 |
| **Accepted**    | Approved for implementation                           |
| **In Progress** | Implementation underway                               |
| **Implemented** | Completed. Move to `history/`                         |
| **Deferred**    | Postponed, may revisit later                          |
| **Rejected**    | Will not implement. Move to `history/` with rationale |

## Naming Conventions

- Use `README.md` for folder entry points.
- Use UPPERCASE kebab-case for topic files (for example `API-STABILITY.md`).
- Keep proposal docs in `proposals/` and historical docs in `history/` to avoid mixing active guidance with archival content.
