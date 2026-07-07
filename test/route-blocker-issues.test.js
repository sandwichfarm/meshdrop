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
  const combined = [project, requirements, roadmap, state, adr].join('\n');

  for (const issue of [151, 152, 156, 157, 158]) {
    assert.match(
      combined,
      new RegExp(`https://github\\.com/sandwichfarm/meshdrop/issues/${issue}\\b`),
      `missing blocker issue #${issue}`,
    );
  }

  assert.doesNotMatch(combined, /GitHub issues are disabled/i);
  assert.match(roadmap, /Phase 16: Route Blocker Issue Tracking/);
  assert.match(state, /Status: Complete/);
});
