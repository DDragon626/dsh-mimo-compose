# Grill — resolving decisions

Read this when Step 0 says requirements or design are ambiguous, and whenever a decision surfaces mid-flight.

## Axes, not questions

A *decision axis* is one dimension the user owns: data model, public API shape, error behavior, compatibility policy, scope boundary, delivery target. Ask one axis per turn. A single axis may bundle several dependent fields in one structured question; unrelated axes must not be bundled.

## Asking

- Call `ask_user_question` with `options` whenever choices are enumerable. Each option: short `label`, one-sentence `description` explaining the consequence.
- Put the recommendation first and append `(Recommended)` to its label.
- For consequential choices include 2–3 viable alternatives, not one.
- When choices cannot be enumerated, pass `options: []` and let the user write free text.
- Do not restate the question in prose — the tool renders it.
- Do not ask for permission to continue when no decision remains; continuing is the default.

## Before asking

Check the environment first: `AGENTS.md`, `README`, existing specs, config, recent commits, and the code itself. A question the repository answers is a defect.

## Splitting

A request spanning independent subsystems is split *before* refining either part: name the parts, confirm the split if it is not obvious, then grill each part. Never silently narrow scope to make one part easier.

## Settling

Stop grilling when requirements and scope are settled, not when every implementation preference is decided. Record the settled outcome in the feature document's `[S2] Design` (or in the conversation when there is no document), so a later reader cannot re-open it by accident.

## User unavailable

When input cannot be obtained — the interaction cannot stop and wait, no reply arrives, or the run is unattended:

1. Choose the option marked `(Recommended)` when repository evidence still supports it.
2. Otherwise choose the closest minimal-scope option; prefer text-only, non-interactive work.
3. If the axis includes destructive or irreversible work, choose the non-destructive path that preserves progress. Never auto-approve destruction.
4. State the option selected and the reason in your response.

This applies to the current decision only. Ask normally at the next axis.
