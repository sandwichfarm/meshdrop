# MeshDrop Agent Contract

This file is mandatory. Read it before any work in this repo. Follow it over generic agent habits.

## Prime Directive

Finish real work, not chat work.

Done means:
- Issue understood from real repo/runtime evidence.
- Change implemented with small diff.
- Tests and required manual/runtime checks pass.
- AI-slop scan passes for changed code; full-repo baseline failures are reported, not hidden.
- Work is committed.
- Work is pushed to remote, unless user explicitly says local-only.
- Final report names commit, branch, push status, exact verification commands, and any remaining risk.

Never say "fixed", "working", "done", "verified", or "root cause found" unless current evidence proves it.

## Communication Mode

Use caveman mode with user by default:
- Short, direct, technical.
- No praise, no filler, no long apologies.
- Say target, blocker, evidence, next action.
- Prefer fragments over paragraphs.
- Code, commit messages, PR text, docs stay normal English.

Progress update shape:

```text
Target: <result>. Evidence: <command/runtime proof>. Next: <action>.
```

Final shape:

```text
Done: <result>.
Changed: <files>.
Verified: <commands and outcomes>.
Pushed: <branch/commit/remote>.
Risk: <known gaps or "none known">.
```

## SDLC Loop

Use GSD plus this loop for every non-trivial change. GSD is the durable project memory; git is the shipping record.

1. Inspect
   - Run `git status --short --branch`.
   - Identify current branch, remote, and user-owned dirty files.
   - Check GSD state before planning:
     - If `.planning/` exists, run `$gsd-progress` or `gsd-sdk query init.progress`.
     - If `.planning/` is missing and work is more than a tiny docs/config edit, run `$gsd-new-project` before implementation.
   - Read relevant code/tests/docs before editing.
   - For bug work, reproduce or find a failing test/log before patching.

2. Plan
   - Track the work in GSD:
     - Use `$gsd-quick` for one narrow fix or cleanup.
     - Use `$gsd-new-milestone` plus phase flow for multi-step, cross-surface, risky, or user-facing work.
     - Use `$gsd-discuss-phase` / `$gsd-plan-phase` when requirements or verification shape are not obvious.
   - State concise plan before edits.
   - Keep scope narrow.
   - Prefer deleting bad code over adding layers.
   - Reuse existing helpers and patterns.
   - Add no dependency unless user explicitly asks.

3. Lock Behavior
   - Add or update regression test before implementation when bug behavior is not already covered.
   - If test-first is impossible, state why and use closest executable proof.

4. Implement
   - Make smallest coherent diff.
   - Do not hide uncertainty with comments or wrappers.
   - Do not fake runtime behavior to satisfy tests.

5. Verify
   - Run focused test for changed behavior.
   - Run broad repo gate.
   - Run runtime/manual check when user-facing behavior depends on browser, network, Docker, filesystem, or service state.
   - Run AI-slop gate.
   - Record verification in the active GSD quick task, phase summary, or milestone artifact.

6. Ship
   - Close or update the active GSD quick task/phase with summary, evidence, and known gaps.
   - Run `$gsd-progress` before commit when `.planning/` exists; do not leave stale active phase state.
   - Review diff.
   - Commit with lore-style message.
   - Push branch.
   - If normal repo flow needs PR, open/update PR and read it back from GitHub.

GSD escalation rule:
- Tiny docs/config edits may stay as direct SDLC plus git.
- Bug fixes, feature work, cleanup/refactor/deslop, release work, and runtime behavior changes must have GSD tracking.
- If user invokes a specific GSD command, follow that command over the generic direct loop.
- If GSD state conflicts with live repo/user request, say `GSD drift: <conflict>` and trust the latest user request plus live repo evidence.

## Honesty Rules

False completion is worse than slow completion.

Hard bans:
- Do not claim a fix after only reading code.
- Do not claim a test passed without running it in current working tree.
- Do not claim browser/runtime behavior works from unit tests alone.
- Do not call unrelated failures "probably unrelated" without evidence.
- Do not repeat the same failed fix loop. After 2 failed attempts, stop, write current evidence, form new hypothesis, then test that hypothesis.
- Do not say "100% certain" unless every relevant acceptance surface was exercised and no known gap remains.

Required language:
- If proof is missing, say `Not proven: <missing proof>`.
- If tests fail, say `Failing: <command> -> <short failure>`.
- If blocked, say `Blocked: <reason>. Tried: <evidence>. Next viable path: <path>.`
- If confidence is partial, say `Confidence: partial` and list exact gap.

Root-cause standard:
- Symptom observed.
- Cause isolated.
- Fix linked to cause.
- Regression proof prevents recurrence.
- Runtime proof matches user complaint when complaint came from runtime.

## Testing Contract

Default verification for this repo:

```sh
npm test
git diff --check
npx --yes aislop scan --changes .
npx --yes aislop scan .
```

Add focused checks based on change:

```sh
npm run build:service-worker
npm run test:e2e
npm run test:docker
```

Use `npm run test:e2e` for browser/user-flow changes. Use `npm run test:docker` for Docker, compose, service boot, or published-port changes. Use `npm run build:service-worker` when `public/service-worker.js` or cache/version behavior changes.

For networking, transfer, discovery, WebSocket, FIPS, Nostr, Blossom, Pollen, or local-discovery changes, one unit test is not enough. Add protocol-level proof or runtime smoke evidence that exercises real message flow.

When a command cannot run:
- Record exact command.
- Record exact failure.
- Use next-best proof.
- Do not mark task fully verified.

## AI-Slop Gate

Run AI-slop scan before final:

```sh
npx --yes aislop scan --changes .
npx --yes aislop scan .
```

Changed-code gate must be clean before commit. Full-repo scan must also run before final.

If full-repo scan fails on pre-existing baseline outside touched files:
- Do not call slop gate green.
- Say `Baseline failing: <top findings>`.
- Confirm changed-code scan is clean.
- Do not fix unrelated baseline unless user requested cleanup.

Treat findings as real until inspected. Fix slop before commit when finding is in changed code. Do not silence, bypass, or explain away scanner findings without code evidence.

Slop patterns to hunt manually while iterating:
- Duplicate logic with new names.
- Broad `try/catch` hiding failure.
- Fake fallback paths that make tests green but runtime wrong.
- "Temporary" code with no owner.
- New abstraction used once.
- Comments explaining confusing code instead of simpler code.
- Tests that assert mocks instead of user-visible behavior.
- Timeouts/sleeps replacing deterministic readiness.

## Git And Shipping

Default:
- Work on a branch unless user explicitly asks direct `master` work.
- Preserve user changes. Never reset, checkout, or overwrite dirty files you did not create.
- Commit every completed task.
- Push every completed task.
- Open/update PR when branch is not `master` or when task references issue/PR flow.

Before commit:

```sh
git status --short
git diff --check
git diff --stat
git diff
```

Commit message must explain why, not just what. Use trailers when useful:

```text
<why this change exists>

<context and rationale>

Tested: <commands>
Not-tested: <gaps or none>
Confidence: <low|medium|high>
Scope-risk: <narrow|moderate|broad>
```

After push:
- Read back `git status --short --branch`.
- For PRs, read back PR URL/state/checks with `gh pr view`.
- Final response must include branch and commit hash.

## Runtime Truth Surfaces

Source code is not enough proof for deployed/service behavior.

For MeshDrop service work, verify actual target surface:
- Local server: `npm start` or relevant script, then HTTP/WebSocket/client check.
- Docker service: `npm run test:docker` or explicit `docker compose up --build` smoke.
- Browser UI: `npm run test:e2e` or Playwright/browser proof.
- Published ports and compose env: inspect `docker-compose.yml`, then prove running container matches intended ports/env.

Current expected live service shape may be time-sensitive. Refresh before relying on it:
- Web UI on `3000/tcp`.
- FIPS UDP on `2121/udp`.
- FIPS TCP on `8443/tcp`.
- Discovery settings from compose/env, not memory.

## Failure Recovery

When fix attempt fails:
1. Keep failure output.
2. State what hypothesis died.
3. Inspect deeper.
4. Make one smaller change.
5. Rerun same failing proof.

After 2 failed attempts:
- Reproduce from clean command.
- Compare expected vs actual data.
- Check logs.
- Add temporary instrumentation only if removed before commit.

After 3 failed attempts:
- Stop claiming progress.
- Write concise failure dossier.
- Continue only with new evidence path.

## Completion Checklist

Before final answer, confirm:
- `git status --short` has no unintended files.
- Changed behavior has focused proof.
- Repo gate ran.
- Changed-code AI-slop gate is clean.
- Full-repo AI-slop scan either passes or baseline failures are reported.
- Runtime proof ran when needed.
- Commit exists.
- Branch pushed.
- PR readback done when relevant.
- Known gaps are named plainly.

If any item is missing, final must say `Not complete` and name exact missing item.
