import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(path, 'utf8');

test('route expansion blockers are tracked with live GitHub issue links', () => {
  const project = read('.planning/PROJECT.md');
  const requirements = read('.planning/REQUIREMENTS.md');
  const roadmap = read('.planning/ROADMAP.md');
  const state = read('.planning/STATE.md');
  const adr = read('docs/adr/0008-route-blocker-issue-tracking.md');
  const phase16Summary = read('.planning/phases/16-route-blocker-issue-tracking/16-01-SUMMARY.md');
  const combined = [project, requirements, roadmap, state, adr, phase16Summary].join('\n');

  for (const issue of [151, 152, 156, 157, 158]) {
    assert.match(
      combined,
      new RegExp(`https://github\\.com/sandwichfarm/meshdrop/issues/${issue}\\b`),
      `missing blocker issue #${issue}`,
    );
  }

  assert.doesNotMatch(combined, /GitHub issues are disabled/i);
  assert.match(phase16Summary, /Phase 16 Summary: Route Blocker Issue Tracking/);
  assert.match(phase16Summary, /Complete\./);
  assert.match(state, /Phase: 17 Tor Byte Transfer Proof/);
});
