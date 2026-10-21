# Verify & review

Read this before claiming completion and before dispatching the reviewer.

## Verify

- Run from the correct directory — usually the worktree, not the primary checkout.
- Run it *this turn*. Prior output, a subagent report, or "it passed earlier" is not evidence.
- Record one line per command: the command, its exit status, and the observed result (test counts when available).
- Mark known baseline failures `PRE-EXISTING` with a short identifier, so the reviewer does not chase them.
- Wait for every command to exit before dispatching the reviewer. Never run the reviewer beside a heavy test suite or a live app.
- Do not substitute reasoning for execution: "these changes cannot break X" is not a verification result.

## Reviewer brief

Dispatch one fresh subagent (`subagent`). Give it exactly:

1. The applicable spec sections and acceptance criteria — or, without a document, the acceptance criteria agreed in the conversation.
2. Workspace path, base SHA, head SHA, and the exact diff command (from `worktree_info`).
3. The verification summary: one line per command with `PASS` / `FAIL` / `PRE-EXISTING`, plus test counts.

What not to give it: your narrative of what you did, your confidence, or your summary of the diff. It reads the diff itself.

Use a reviewer model at least as capable as the strongest implementer whose work it reviews.

The reviewer may run extra commands needed to validate a conclusion. It must not repeat a command already reported as passing unless the result is stale, the code changed afterward, or concrete evidence makes that result suspect — and before any justified rerun it confirms no equivalent command is still running.

## Three separate conclusions

Require all three, each with evidence:

- **Spec compliance** — every acceptance criterion met, each pointing at a diff hunk or reviewer-observed command output.
- **Correctness** — logic, boundaries, error handling, regressions, and test quality, including issues outside the written spec.
- **Codebase consistency** — naming, structure, and local conventions match surrounding code.

## Loop rules

- Classify unmet or unverifiable acceptance criteria, and correctness bugs, as **critical**.
- Fix criticals, re-verify, then re-review the affected areas.
- Reject incorrect findings with technical evidence, not with deference.
- Stop looping and report the impasse when it stops converging: the same area attracting repeated findings, or fixes that introduce new criticals.
- For human review feedback: verify each item against the codebase first, clarify ambiguous items before editing, implement validated items one at a time with verification, and surface conflicts with earlier user decisions instead of silently complying.

## Parallel work

Review integrated task diffs at useful boundaries only when delaying review would compound risk. Otherwise review once, on the complete change.
