# MeshDrop Agent Contract

This file is mandatory. Read it before any work in this repo. Follow it over generic agent habits.

## Prime Directive

Finish real work, not chat work.

## Project Mission

MeshDrop is a robust, self-healing, easy-to-use sharing application for moving files through as many real network conditions as possible. It uses the Nostr social graph to discover trusted peers, then negotiates across multiple network topologies so peers can still connect when LAN discovery, direct routing, relays, captive networks, NAT, or firewalls get in the way. Privacy is the default: private transfers must stay private, encrypted paths must fail closed instead of silently downgrading, and public sharing options must be explicit. WebRTC is the standard data transport across topologies; server handoffs, Blossom/Pollen/FIPS-style federation, relay signaling, and other topology-specific helpers exist to establish or recover the connection, not to replace the privacy and transfer guarantees. Keep this forest in view: every feature should make file sharing more reliable, more understandable, or safer under hostile or weird network conditions.

Done means:
- Issue understood from real repo/runtime evidence.
- Change implemented with small diff.
- Tests and required manual/runtime checks pass.
- AI-slop scan passes for changed code; full-repo baseline failures are reported, not hidden.
- Work is committed.
- Work is pushed to remote, unless user explicitly says local-only.
- During alpha, branch work is opened as a PR, read back from GitHub, and merged to `master` after verification unless the user explicitly says to hold it.
- The operator can test the exact changed state from a named local path without doing git archaeology or guessing Docker/image/cache state.
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
   - State a git brief before edits:
     - primary worktree path, branch, and dirty paths
     - task worktree path, branch, and base commit
     - dirty-state decision: ignored unrelated, blocked overlap, or incorporated by explicit user request
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
   - Keep scope coherent and reviewable.
   - Prefer larger vertical slices over many tiny CI-triggering slices when the work is related and safe to batch.
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
   - Run the lightest local gate that proves the changed behavior.
   - Reserve full CI-class verification for larger slices, release work, cross-surface runtime changes, or explicit user requests.
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

CI budget rule:
- Full CI is expensive. Do larger coherent slices before spending a full CI run.
- Do not split related code/test/doc adjustments into many small PRs or pushes that each trigger the full matrix.
- For narrow slices, prove the behavior locally with focused tests plus the smallest relevant broad gate, then state what full CI-class coverage was intentionally deferred.
- Run or wait for full CI-class coverage before merging release, packaging, Docker, mobile, cross-browser, or broad runtime slices.

Default local verification for narrow slices:

```sh
git diff --check
npx --yes aislop scan --changes .
```

Add the smallest relevant proof for the touched behavior:

```sh
npm test
npm run build:service-worker
npm run test:e2e
npm run test:docker
```

Full local verification for larger slices:

```sh
npm test
git diff --check
npx --yes aislop scan --changes .
npx --yes aislop scan .
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
```

Changed-code gate must be clean before commit. Run the full-repo scan before final for larger slices, cleanup/refactor work, release work, or when the touched code intersects known baseline risk. For narrow slices, it is acceptable to defer full-repo scan and report `Not run: full-repo slop scan deferred for CI budget`.

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
- Do not keep cloning this repository into `~/Develop` for every task. Use one canonical operator checkout plus git worktrees.
- Treat the user's normal checkout as the operator worktree; do not edit it when it has unrelated dirty state.
- For each independent user task, fetch `origin`, start from current `origin/master`, create a fresh task branch, and attach it to a fresh task worktree before editing, unless the user explicitly says to continue the current branch or work directly on `master`.
- Use predictable branch names: `agent/<kind>-<slug>-<yyyymmdd>` or an issue-specific `fix/<issue>-<slug>` when the user names an issue.
- Use predictable task worktree paths beside the operator checkout, for example `~/Develop/meshdrop-<slug>-<yyyymmdd>`.
- Preserve user changes. Never reset, checkout, or overwrite dirty files you did not create.
- Commit every completed task.
- Push every completed task.
- Open/update PR for every task branch.
- While MeshDrop is in alpha, merge the PR after verification and PR readback unless checks fail, the branch conflicts, or the user explicitly says not to merge. Alpha means clean breaks are allowed; do not leave completed work sitting in open PRs by default.
- When a branch should be pushed, push it before announcing completion.

Recommended start commands:

```sh
git -C ~/Develop/meshdrop fetch origin
git -C ~/Develop/meshdrop worktree add -b agent/<kind>-<slug>-<yyyymmdd> \
  ~/Develop/meshdrop-<slug>-<yyyymmdd> origin/master
cd ~/Develop/meshdrop-<slug>-<yyyymmdd>
```

Use an existing task worktree only when it is already on the branch for the same task and `git status --short --branch` proves its state. Do not create a second clone or second worktree for the same task unless the first one is corrupt, missing, or unsafe to reuse.

Worktree roles:
- Operator worktree: the user's normal checkout, normally `~/Develop/meshdrop`. Use it for inspection, fetching, and safe fast-forward handoff only unless it is clean and the user explicitly wants work there.
- Task worktree: the agent-owned worktree for one task branch, normally `~/Develop/meshdrop-<slug>-<yyyymmdd>`. Implement, test, commit, push, open PR, and merge from here.
- Review/UAT worktree: optional clean checkout of the PR branch or merged commit for the operator to run or inspect locally. Create or update it when useful, and report its path.

Dirty-state protocol:
- If the operator worktree has unrelated dirty files, leave them untouched and create a task worktree from `origin/master`.
- If dirty files overlap intended edit paths, stop before editing and report exact paths plus the decision needed.
- If the user explicitly wants to continue dirty work, say that in the git brief and keep all commits on that existing branch.
- Never stash, reset, checkout, clean, or rebase user-owned dirty state unless the user explicitly requests that exact operation.

Successive PR policy:
- Independent task: branch from current `origin/master`.
- Dependent or overlapping task: branch from the prior PR branch.
- If overlap with an open PR is accidental, stop and ask whether to stack, split, or wait.
- Stacked PR bodies must include `Depends on: #N`, merge order, retarget/rebase plan after the base PR merges, and overlapping files or behavior.

PR ceremony:
- Push the branch before any completion claim.
- Open or update the PR.
- Read the PR back with `gh pr view --json number,url,state,headRefName,baseRefName,title,body,commits,statusCheckRollup`.
- PR bodies must include summary, verification, known baseline failures, runtime/UAT notes, dependencies, and merge order when stacked.
- During alpha, merge the PR with `gh pr merge` after required verification and readback. Prefer merge commits for normal task branches unless repo policy says otherwise. After merge, fetch `origin` and prove `origin/master` contains the merge.

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
- Final response must include branch, commit hash, push status, PR URL when relevant, task worktree path, and review/UAT path if one exists.

Operator-testable handoff:
- If the user's normal checkout is the named test surface, do not finish with only a remote PR/merge. Leave that checkout at the tested commit, unless doing so would overwrite user-owned dirty files.
- If the operator checkout has unrelated dirty files, preserve them and either:
  - fast-forward only when Git can do it without touching dirty paths, or
  - create/update a separate review/UAT worktree at the exact commit and name that path as the test surface.
- If the operator checkout has dirty files that overlap the handoff paths, stop and report the exact paths. Do not overwrite, stash, reset, or clean them without explicit user instruction.
- After merging a PR that the user is expected to test locally, fetch and read back whether the operator checkout is at the merge commit. If it is not, final must say `Not testable from operator checkout` and name the exact path/commit gap plus the review/UAT path that is testable.
- For Docker/Compose-visible changes, make the Compose image/container match the source being reported:
  - Use `docker compose build` or `docker compose up --build`, not bare `docker build .`, unless the compose file does not use a named image.
  - Read `docker compose ps --format json` or equivalent to confirm the running container image/tag and project working directory.
  - Prove served assets from the published port contain the expected change with `curl`/browser DOM/screenshot evidence.
  - Browser hard refresh or service-worker unregister is not proof when source, image tag, or running container may be stale.

Task end states:
- Ready for UAT: code is committed, branch is pushed, PR is open/read back, verification is recorded, and the review path or task worktree path is named. Use this only when the user asked to hold before merge or a real blocker prevents merge.
- Complete during alpha: PR is merged into `master`, merge readback is done, and the operator checkout or a named review/UAT worktree is at the tested commit.
- Do not delete task or review worktrees automatically after opening a PR. Keep them until merge or explicit cleanup request.
- Before cleanup, show the worktree path and branch to be removed. Never remove a dirty worktree.

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
- Operator-testable path is named and is actually at the tested commit.
- For Docker/Compose work, running container/image and served assets match the tested commit.
- Commit exists.
- Branch pushed.
- PR readback done when relevant.
- Known gaps are named plainly.

If any item is missing, final must say `Not complete` and name exact missing item.
