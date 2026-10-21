---
name: compose-next
description: Use for multi-step feature work, bug fixes, or refactors where requirements must settle, one feature document must carry design + tasks + delivery evidence, and the change deserves independent review before it is merged. This skill belongs to the mimo-compose mode, so selecting that mode is the user's request; inside another mode it does not apply.
---

# Compose Next

End-to-end contract: orient → grill → workspace → spec → implement → verify → review → finalize → finish. One skill load; phases are sections of this document plus `references/`, never separate skill hand-offs.

On resumption after a compaction or checkpoint, if these instructions are absent, reload `compose-next` before continuing.

## Step 0 — Orient

Read the repository, its `AGENTS.md`/`README`, existing spec files, and recent commits **before asking anything**. Never ask for a fact the environment already answers.

Then choose the shape:

- **Mechanical change, no durable design surface** → skip Grill and Spec; go to Workspace, then Implement.
- **Requirements or design ambiguous** → Grill first.
- **Requirements clear and worth a durable document** → Workspace, then Spec.

Every path passes through **Workspace** before Spec or Implement. No exceptions.

Honor explicit overrides without re-asking: `without worktree` / a named worktree path (skip the worktree gate), `without spec` / "small fix" (skip the document, keep verify+review), and any project instruction defining worktree path, branch convention, or spec location.

## Grill — settle decisions

Resolve **one decision axis per turn**, through `ask_user_question`. Put known choices in `options`, recommendation first and marked `(Recommended)`, each with a one-line consequence. Use empty `options` when free text is the only sensible form. Split requests that span independent subsystems before refining any part.

Do not begin implementation while requirements or scope are unsettled. When no decision remains, do not ask for permission to continue.

If the user cannot answer, resolve that one decision yourself and continue: prefer the recommended option when evidence still supports it, otherwise the minimal non-destructive one, and state what you chose and why. Never auto-approve a destructive or irreversible action.

Details: `references/grill.md`.

## Workspace — isolation

Never implement on `main`/`master` without explicit consent. Create the worktree with **`worktree_create`** (it places linked worktrees under `<repo>/.worktrees/`, which keeps them inside the file sandbox); pass `base` when the mainline is ambiguous. Confirm the tree builds/tests before continuing.

The repository defaults to the session workspace. When the session workspace is not itself a git repository — a shared workspace holding several checkouts — pass `repo` with the checkout to work in (`worktree_*` accepts an absolute path or one relative to the session workspace). All four worktree tools take the same `repo` argument.

Read back `worktree_info` when you need the branch, base SHA, head SHA, or diff command.

## Spec — one document per feature

One document per feature at `docs/compose/spec/<feature>.md`; never a second plan or report, never a date in the filename. Status `designed` before implementation, `in-progress` on the first implementation commit, `delivered` at finalize.

Tasks are the smallest independently verifiable units, each with an observable acceptance criterion, a `covers:` link to a design section, and acyclic `depends:`. Every design requirement must be covered; every reference must resolve. Remove placeholders like `TBD` and "handle edge cases".

Template and amendment rules: `references/spec.md`.

## Implement

Follow the document; without one, follow the conversation. Execute tasks in dependency order and track them with `todo_write`.

For behavior changes with a cheap reproduction: write the failing test, confirm it fails for the intended reason, make the smallest fix, confirm it passes. A bug fix needs a regression test when one can be written. Skip test-first for generated code, config-only changes, throwaway prototypes, or an explicit user instruction.

Test public behavior. Do not re-implement production logic in expectations, add test-only production APIs, or assert that mocks were called. Prefer real implementations.

On failure: reproduce, then derive the cause from errors, diffs, recent commits, or boundary instrumentation. After two failed fix attempts, stop patching and re-derive.

Parallel work: give each subagent a disjoint file set plus the worktree path, task, acceptance criteria, and required verification; never session history. Keep commits with the orchestrator and treat a subagent report as a claim — inspect its diff.

Continue through tasks without routine approval pauses. Stop only for an unresolved product decision, an unworkable blocker, a destructive action, or completion.

## Verify

Before any completion claim, run the relevant tests, typecheck, build, or reproduction **from the correct directory in this turn** and read the output. Record every command and its result; mark known baseline failures `PRE-EXISTING` with an identifier. Prior output and subagent reports are not evidence.

Verification and review are strictly sequential: wait for every verification command to exit before dispatching the reviewer, and never run review beside a heavy test or app process.

## Review

After verification, dispatch one fresh subagent (`subagent`) with: the applicable spec sections and acceptance criteria; the worktree path, base SHA, head SHA, and the exact diff command from `worktree_info`; and a one-line-per-command verification summary (`PASS`/`FAIL`/`PRE-EXISTING`, plus test counts). No implementer narrative.

Require three separate conclusions: **spec compliance** (each criterion met, pointing at diff or reviewer-run evidence), **correctness** (logic, boundaries, errors, regressions), **codebase consistency** (naming, structure, local conventions). Unmet or unverifiable criteria and correctness bugs are critical: fix, re-verify, re-review. Reject incorrect findings with evidence. If the loop stops converging — repeated findings in one area, or fixes creating new criticals — stop and report the impasse.

The reviewer need not re-run a command already reported as passing unless the result is stale, the code changed, or evidence makes it suspect.

Reviewer brief and loop rules: `references/verify-review.md`.

## Finalize

Set `status: delivered`, bump `updated:`, check off completed tasks. Replace `Report` with **What was built** (1–3 paragraphs), **Verification** (commands and observed results), and **Journey log** (at most 5 entries: dead ends, pivots, transferable lessons). Update a design section only where it contradicts delivered behavior. Commit the document on the feature branch; that documentation-only commit does not restart verification or review.

## Finish

Never finish on your own initiative. Confirm before opening a PR/MR, merging, or pushing. Report branch, base, head SHA, workspace, feature-document path, and ask how to close: local merge / open PR / push only / keep the branch; the target base; and whether to keep or remove the worktree.

`worktree_remove` only removes paths under `.worktrees/`. A local merge runs from the primary checkout, since the base branch cannot be checked out while another worktree holds it.

Closing-action details: `references/finish.md`.

---

Adapted from MiMo-Code's `compose-next` skill (XiaomiMiMo/MiMo-Code, MIT). Phase contracts were rewritten for DSH tooling — `ask_user_question`, `todo_write`, `subagent`, `worktree_*` — and split into `references/` so each load stays under the harness's 8192-character tool-result pruning threshold.
