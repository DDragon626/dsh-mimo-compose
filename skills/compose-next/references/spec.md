# Spec — the feature document

Read this when a durable document is warranted, and whenever editing an existing one.

## Location

`docs/compose/spec/<feature-name>.md` from the workspace root. No date in the filename. A user-specified location, or a project instruction in `AGENTS.md`, overrides this path. Write it only after the worktree owns the active workspace.

## Template

```markdown
---
feature: <feature-name>
status: designed | in-progress | delivered
updated: YYYY-MM-DD
source: Local <path> | Branch <name> | PR #id | MR !id
---

# <Feature Name>

## Report

## [S1] Problem
User-visible problem, in the user's terms.

## [S2] Design
Chosen behavior and the contracts needed to implement it.

## [S3] Out of Scope
Explicit boundaries.

## Tasks
- [ ] T1: <work item> — acceptance: <observable result> (covers: S2)
- [ ] T2: <work item> — acceptance: <observable result> (covers: S2; depends: T1)
```

## Design-time rules

- `Report` stays empty and `status: designed` until delivery.
- `source` names where the work lives (`Local <path>`, `Branch <name>`, `PR #id`, `MR !id`) and is updated whenever that changes.
- `[Sn]` anchors are stable: when a heading is renamed, keep the anchor; never renumber existing anchors.
- Record settled decisions and precise contracts — architecture, interfaces, data flow, error behavior, testing boundaries. Not exploration history, not file-level code dumps.
- Each task is the smallest independently verifiable unit with an observable acceptance criterion. `depends:` only for real prerequisites, and the graph must stay acyclic.
- `covers:` on every task that implements a design section. Every design requirement must be covered by at least one task; every reference must resolve.
- No `TBD`, no "handle edge cases", no "similar to the previous one". A placeholder is a bug.
- Scale detail to the change. Do not pad a small design.

## Before implementation

Fix ambiguous requirements, contradictions, unresolved references, and unverifiable acceptance criteria. If the user is reachable, request document approval through `ask_user_question`; otherwise continue and say so.

## Amendments

Update only the affected sections. Bump `updated:`. Preserve anchors. Keep only the tasks the amendment requires plus their dependents. Never regenerate the document and never create duplicate tasks.

## Delivery

At finalize: `status: delivered`, bump `updated:`, check completed tasks (leave genuinely incomplete ones unchecked), and replace `Report` with the three-part report (What was built / Verification / Journey log). Commit the document on the feature branch.
