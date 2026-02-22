import { strict as assert } from 'assert';
import { classifyPrompt } from '../../chat/agentRouter';

describe('agentRouter - classifyPrompt', () => {

  // --- Architect routes -------------------------------------------------

  it('should route "design the system architecture" to architect', () => {
    const result = classifyPrompt('design the system architecture');
    assert.equal(result.agentFile, 'architect');
  });

  it('should route "create an ADR for the new service" to architect', () => {
    const result = classifyPrompt('create an ADR for the new service');
    assert.equal(result.agentFile, 'architect');
  });

  it('should route "tech spec for authentication" to architect', () => {
    const result = classifyPrompt('We need a tech spec for authentication');
    assert.equal(result.agentFile, 'architect');
  });

  it('should route "spike on caching strategies" to architect', () => {
    const result = classifyPrompt('spike on caching strategies');
    assert.equal(result.agentFile, 'architect');
  });

  it('should route "scalability concerns" to architect', () => {
    const result = classifyPrompt('I have scalability concerns about the database');
    assert.equal(result.agentFile, 'architect');
  });

  it('should route "microservice boundaries" to architect', () => {
    const result = classifyPrompt('define microservice boundaries');
    assert.equal(result.agentFile, 'architect');
  });

  // --- Reviewer routes --------------------------------------------------

  it('should route "review the pull request" to reviewer', () => {
    const result = classifyPrompt('review the pull request');
    assert.equal(result.agentFile, 'reviewer');
  });

  it('should route "code review for the login module" to reviewer', () => {
    const result = classifyPrompt('code review for the login module');
    assert.equal(result.agentFile, 'reviewer');
  });

  it('should route "security review of the API" to reviewer', () => {
    const result = classifyPrompt('security review of the API');
    assert.equal(result.agentFile, 'reviewer');
  });

  // --- DevOps routes ----------------------------------------------------

  it('should route "set up CI/CD pipeline" to devops', () => {
    const result = classifyPrompt('set up CI/CD pipeline');
    assert.equal(result.agentFile, 'devops');
  });

  it('should route "deploy to kubernetes" to devops', () => {
    const result = classifyPrompt('deploy to kubernetes');
    assert.equal(result.agentFile, 'devops');
  });

  it('should route "create github actions workflow" to devops', () => {
    const result = classifyPrompt('create github actions workflow');
    assert.equal(result.agentFile, 'devops');
  });

  it('should route "docker container setup" to devops', () => {
    const result = classifyPrompt('docker container setup');
    assert.equal(result.agentFile, 'devops');
  });

  it('should route "terraform infrastructure" to devops', () => {
    const result = classifyPrompt('set up terraform infrastructure');
    assert.equal(result.agentFile, 'devops');
  });

  it('should route "helm chart configuration" to devops', () => {
    const result = classifyPrompt('configure helm chart for production');
    assert.equal(result.agentFile, 'devops');
  });

  it('should route "create release pipeline" to devops', () => {
    const result = classifyPrompt('create release pipeline');
    assert.equal(result.agentFile, 'devops');
  });

  // --- UX Designer routes -----------------------------------------------

  it('should route "wireframe for the dashboard" to ux-designer', () => {
    const result = classifyPrompt('wireframe for the dashboard');
    assert.equal(result.agentFile, 'ux-designer');
  });

  it('should route "user experience improvements" to ux-designer', () => {
    const result = classifyPrompt('user experience improvements for checkout');
    assert.equal(result.agentFile, 'ux-designer');
  });

  it('should route "create a prototype" to ux-designer', () => {
    const result = classifyPrompt('create a prototype of the login page');
    assert.equal(result.agentFile, 'ux-designer');
  });

  it('should route "accessibility audit" to ux-designer', () => {
    const result = classifyPrompt('run an accessibility audit');
    assert.equal(result.agentFile, 'ux-designer');
  });

  // --- Product Manager routes -------------------------------------------

  it('should route "write a PRD" to product-manager', () => {
    const result = classifyPrompt('write a PRD for the new feature');
    assert.equal(result.agentFile, 'product-manager');
  });

  it('should route "break down the epic" to product-manager', () => {
    const result = classifyPrompt('break down the epic into user stories');
    assert.equal(result.agentFile, 'product-manager');
  });

  it('should route "product roadmap planning" to product-manager', () => {
    const result = classifyPrompt('product roadmap planning for Q3');
    assert.equal(result.agentFile, 'product-manager');
  });

  it('should route "backlog prioritization" to product-manager', () => {
    const result = classifyPrompt('help with backlog prioritization');
    assert.equal(result.agentFile, 'product-manager');
  });

  it('should route "stakeholder requirements" to product-manager', () => {
    const result = classifyPrompt('gather stakeholder requirements');
    assert.equal(result.agentFile, 'product-manager');
  });

  // --- Customer Coach routes --------------------------------------------

  it('should route "research cloud providers" to customer-coach', () => {
    const result = classifyPrompt('research cloud providers for a client');
    assert.equal(result.agentFile, 'customer-coach');
  });

  it('should route "prepare a presentation" to customer-coach', () => {
    const result = classifyPrompt('prepare a presentation on AI trends');
    assert.equal(result.agentFile, 'customer-coach');
  });

  it('should route "vendor comparison" to customer-coach', () => {
    const result = classifyPrompt('vendor comparison for CRM solutions');
    assert.equal(result.agentFile, 'customer-coach');
  });

  it('should route "executive summary" to customer-coach', () => {
    const result = classifyPrompt('write an executive summary');
    assert.equal(result.agentFile, 'customer-coach');
  });

  // --- Engineer routes --------------------------------------------------

  it('should route "implement the login endpoint" to engineer', () => {
    const result = classifyPrompt('implement the login endpoint');
    assert.equal(result.agentFile, 'engineer');
  });

  it('should route "fix the bug in the parser" to engineer', () => {
    const result = classifyPrompt('fix the bug in the parser');
    assert.equal(result.agentFile, 'engineer');
  });

  it('should route "refactor the user service" to engineer', () => {
    const result = classifyPrompt('refactor the user service');
    assert.equal(result.agentFile, 'engineer');
  });

  it('should route "build a REST API" to engineer', () => {
    const result = classifyPrompt('build a REST API for orders');
    assert.equal(result.agentFile, 'engineer');
  });

  it('should route "database migration for users table" to engineer', () => {
    const result = classifyPrompt('create a database migration for the users table');
    assert.equal(result.agentFile, 'engineer');
  });

  // --- Fallback routes --------------------------------------------------

  it('should fall back to agent-x for ambiguous prompts', () => {
    const result = classifyPrompt('hello, how are you?');
    assert.equal(result.agentFile, 'agent-x');
  });

  it('should fall back to agent-x for random text', () => {
    const result = classifyPrompt('xyzzy plugh nothing to see here');
    assert.equal(result.agentFile, 'agent-x');
  });

  // --- Priority / order tests -------------------------------------------

  it('should prefer architect over engineer for "design pattern"', () => {
    // "design pattern" contains "design pattern" (architect) and could match
    // engineer keywords -- architect should win because it comes first
    const result = classifyPrompt('choose a design pattern for the service');
    assert.equal(result.agentFile, 'architect');
  });

  it('should prefer reviewer over engineer for "review the code"', () => {
    // "review" matches reviewer; "code" matches engineer -- reviewer first
    const result = classifyPrompt('review the code changes');
    assert.equal(result.agentFile, 'reviewer');
  });

  // --- Case insensitivity -----------------------------------------------

  it('should be case-insensitive', () => {
    const result = classifyPrompt('CREATE AN ADR FOR PAYMENTS');
    assert.equal(result.agentFile, 'architect');
  });

  // --- Return shape -----------------------------------------------------

  it('should return a description with every route', () => {
    const result = classifyPrompt('implement a new feature');
    assert.ok(result.description.length > 0, 'description should not be empty');
    assert.ok(result.keywords instanceof RegExp, 'keywords should be a RegExp');
  });
});
