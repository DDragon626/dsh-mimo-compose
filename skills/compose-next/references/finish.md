# Finish — closing the work

Read this at the end of the workflow, after the feature document is finalized.

## Never self-finish

Any irreversible closing action needs explicit confirmation first: opening a PR/MR, merging locally, pushing. If the user already named the closing action and a PR/MR already exists, confirm again before the merge.

## Report

State, in this order:

- branch, base ref, head SHA
- workspace path (the worktree, if one is in use)
- feature-document path, when one exists
- verification result in one line
- what the review concluded

## Ask how to close

Offer the concrete choices: local merge / open PR / push only / keep the branch; which base branch to merge or target; and whether to keep or remove the worktree.

Use `ask_user_question` with those options rather than prose.

## Closing actions

- **Open PR/MR** — from the worktree branch; then update the document's `source:` to `PR #id` / `MR !id` and commit that as documentation only. This commit does not restart verification or review.
- **Local merge** — run it from the primary checkout, because the base branch cannot be checked out while the worktree holds it.
- **Push only** — leave the branch in place; set `source:` to `Branch <name>`.
- **Keep the branch** — nothing to do; the branch is the deliverable.

## Worktree cleanup

- `worktree_remove` only removes paths under `.worktrees/`; never ask it to clean the primary checkout.
- Remove the worktree only after the branch is merged or explicitly abandoned.
- If the change should stay inspectable, keep the worktree and say where it is.

## Documentation commit

When the closing action changes where the spec lives, update `source:` on the feature branch and commit it as documentation only, then finish.
