import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CommonsIntegration } from '../lib/external/commons-integration.mjs';

describe('CommonsIntegration', () => {
  it('should instantiate with config', () => {
    const integration = new CommonsIntegration({ basePath: '.' });
    assert.ok(integration);
    assert.ok(integration.loader);
  });

  it('should merge skills from multiple sources', () => {
    const integration = new CommonsIntegration({ basePath: '.' });
    const result = integration.mergeSkills({
      ecc: { commands: ['cmd1'] },
      superpowers: ['skill1', 'skill2'],
      anthropic: ['skill3'],
    });
    assert.deepEqual(result, ['skill1', 'skill2', 'skill3']);
  });

  it('should integrate resources with defaults', () => {
    const integration = new CommonsIntegration({ basePath: '.' });
    const result = integration.integrate({});
    assert.deepEqual(result, {
      commands: [],
      agents: [],
      rules: [],
      skills: [],
    });
  });
});
