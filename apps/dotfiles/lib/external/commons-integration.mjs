import {
  ResourceLoader,
  syncIfNeeded,
  detectTechStack
} from '@ab-tao/commons';

export class CommonsIntegration {
  constructor(config) {
    this.config = config;
    this.loader = new ResourceLoader(config);
  }

  async initialize() {
    await syncIfNeeded();

    const resources = await this.loader.loadResources();

    return this.integrate(resources);
  }

  integrate(resources) {
    return {
      commands: resources.ecc?.commands || [],
      agents: resources.ecc?.agents || [],
      rules: resources.ecc?.rules || [],
      skills: this.mergeSkills(resources)
    };
  }

  mergeSkills(resources) {
    const skills = [];
    Object.entries(resources).forEach(([source, data]) => {
      if (source !== 'ecc' && Array.isArray(data)) {
        skills.push(...data);
      }
    });
    return skills;
  }
}
