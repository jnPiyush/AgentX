"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const agentRouter_1 = require("../../chat/agentRouter");
describe('agentRouter - classifyPrompt', () => {
    // --- Architect routes -------------------------------------------------
    it('should route "design the system architecture" to architect', () => {
        const result = (0, agentRouter_1.classifyPrompt)('design the system architecture');
        assert_1.strict.equal(result.agentFile, 'architect');
    });
    it('should route "create an ADR for the new service" to architect', () => {
        const result = (0, agentRouter_1.classifyPrompt)('create an ADR for the new service');
        assert_1.strict.equal(result.agentFile, 'architect');
    });
    it('should route "tech spec for authentication" to architect', () => {
        const result = (0, agentRouter_1.classifyPrompt)('We need a tech spec for authentication');
        assert_1.strict.equal(result.agentFile, 'architect');
    });
    it('should route "spike on caching strategies" to architect', () => {
        const result = (0, agentRouter_1.classifyPrompt)('spike on caching strategies');
        assert_1.strict.equal(result.agentFile, 'architect');
    });
    it('should route "scalability concerns" to architect', () => {
        const result = (0, agentRouter_1.classifyPrompt)('I have scalability concerns about the database');
        assert_1.strict.equal(result.agentFile, 'architect');
    });
    it('should route "microservice boundaries" to architect', () => {
        const result = (0, agentRouter_1.classifyPrompt)('define microservice boundaries');
        assert_1.strict.equal(result.agentFile, 'architect');
    });
    // --- Reviewer routes --------------------------------------------------
    it('should route "review the pull request" to reviewer', () => {
        const result = (0, agentRouter_1.classifyPrompt)('review the pull request');
        assert_1.strict.equal(result.agentFile, 'reviewer');
    });
    it('should route "code review for the login module" to reviewer', () => {
        const result = (0, agentRouter_1.classifyPrompt)('code review for the login module');
        assert_1.strict.equal(result.agentFile, 'reviewer');
    });
    it('should route "security review of the API" to reviewer', () => {
        const result = (0, agentRouter_1.classifyPrompt)('security review of the API');
        assert_1.strict.equal(result.agentFile, 'reviewer');
    });
    // --- DevOps routes ----------------------------------------------------
    it('should route "set up CI/CD pipeline" to devops', () => {
        const result = (0, agentRouter_1.classifyPrompt)('set up CI/CD pipeline');
        assert_1.strict.equal(result.agentFile, 'devops');
    });
    it('should route "deploy to kubernetes" to devops', () => {
        const result = (0, agentRouter_1.classifyPrompt)('deploy to kubernetes');
        assert_1.strict.equal(result.agentFile, 'devops');
    });
    it('should route "create github actions workflow" to devops', () => {
        const result = (0, agentRouter_1.classifyPrompt)('create github actions workflow');
        assert_1.strict.equal(result.agentFile, 'devops');
    });
    it('should route "docker container setup" to devops', () => {
        const result = (0, agentRouter_1.classifyPrompt)('docker container setup');
        assert_1.strict.equal(result.agentFile, 'devops');
    });
    it('should route "terraform infrastructure" to devops', () => {
        const result = (0, agentRouter_1.classifyPrompt)('set up terraform infrastructure');
        assert_1.strict.equal(result.agentFile, 'devops');
    });
    it('should route "helm chart configuration" to devops', () => {
        const result = (0, agentRouter_1.classifyPrompt)('configure helm chart for production');
        assert_1.strict.equal(result.agentFile, 'devops');
    });
    it('should route "create release pipeline" to devops', () => {
        const result = (0, agentRouter_1.classifyPrompt)('create release pipeline');
        assert_1.strict.equal(result.agentFile, 'devops');
    });
    // --- UX Designer routes -----------------------------------------------
    it('should route "wireframe for the dashboard" to ux-designer', () => {
        const result = (0, agentRouter_1.classifyPrompt)('wireframe for the dashboard');
        assert_1.strict.equal(result.agentFile, 'ux-designer');
    });
    it('should route "user experience improvements" to ux-designer', () => {
        const result = (0, agentRouter_1.classifyPrompt)('user experience improvements for checkout');
        assert_1.strict.equal(result.agentFile, 'ux-designer');
    });
    it('should route "create a prototype" to ux-designer', () => {
        const result = (0, agentRouter_1.classifyPrompt)('create a prototype of the login page');
        assert_1.strict.equal(result.agentFile, 'ux-designer');
    });
    it('should route "accessibility audit" to ux-designer', () => {
        const result = (0, agentRouter_1.classifyPrompt)('run an accessibility audit');
        assert_1.strict.equal(result.agentFile, 'ux-designer');
    });
    // --- Product Manager routes -------------------------------------------
    it('should route "write a PRD" to product-manager', () => {
        const result = (0, agentRouter_1.classifyPrompt)('write a PRD for the new feature');
        assert_1.strict.equal(result.agentFile, 'product-manager');
    });
    it('should route "break down the epic" to product-manager', () => {
        const result = (0, agentRouter_1.classifyPrompt)('break down the epic into user stories');
        assert_1.strict.equal(result.agentFile, 'product-manager');
    });
    it('should route "product roadmap planning" to product-manager', () => {
        const result = (0, agentRouter_1.classifyPrompt)('product roadmap planning for Q3');
        assert_1.strict.equal(result.agentFile, 'product-manager');
    });
    it('should route "backlog prioritization" to product-manager', () => {
        const result = (0, agentRouter_1.classifyPrompt)('help with backlog prioritization');
        assert_1.strict.equal(result.agentFile, 'product-manager');
    });
    it('should route "stakeholder requirements" to product-manager', () => {
        const result = (0, agentRouter_1.classifyPrompt)('gather stakeholder requirements');
        assert_1.strict.equal(result.agentFile, 'product-manager');
    });
    // --- Customer Coach routes --------------------------------------------
    it('should route "research cloud providers" to customer-coach', () => {
        const result = (0, agentRouter_1.classifyPrompt)('research cloud providers for a client');
        assert_1.strict.equal(result.agentFile, 'customer-coach');
    });
    it('should route "prepare a presentation" to customer-coach', () => {
        const result = (0, agentRouter_1.classifyPrompt)('prepare a presentation on AI trends');
        assert_1.strict.equal(result.agentFile, 'customer-coach');
    });
    it('should route "vendor comparison" to customer-coach', () => {
        const result = (0, agentRouter_1.classifyPrompt)('vendor comparison for CRM solutions');
        assert_1.strict.equal(result.agentFile, 'customer-coach');
    });
    it('should route "executive summary" to customer-coach', () => {
        const result = (0, agentRouter_1.classifyPrompt)('write an executive summary');
        assert_1.strict.equal(result.agentFile, 'customer-coach');
    });
    // --- Engineer routes --------------------------------------------------
    it('should route "implement the login endpoint" to engineer', () => {
        const result = (0, agentRouter_1.classifyPrompt)('implement the login endpoint');
        assert_1.strict.equal(result.agentFile, 'engineer');
    });
    it('should route "fix the bug in the parser" to engineer', () => {
        const result = (0, agentRouter_1.classifyPrompt)('fix the bug in the parser');
        assert_1.strict.equal(result.agentFile, 'engineer');
    });
    it('should route "refactor the user service" to engineer', () => {
        const result = (0, agentRouter_1.classifyPrompt)('refactor the user service');
        assert_1.strict.equal(result.agentFile, 'engineer');
    });
    it('should route "build a REST API" to engineer', () => {
        const result = (0, agentRouter_1.classifyPrompt)('build a REST API for orders');
        assert_1.strict.equal(result.agentFile, 'engineer');
    });
    it('should route "database migration for users table" to engineer', () => {
        const result = (0, agentRouter_1.classifyPrompt)('create a database migration for the users table');
        assert_1.strict.equal(result.agentFile, 'engineer');
    });
    // --- Fallback routes --------------------------------------------------
    it('should fall back to agent-x for ambiguous prompts', () => {
        const result = (0, agentRouter_1.classifyPrompt)('hello, how are you?');
        assert_1.strict.equal(result.agentFile, 'agent-x');
    });
    it('should fall back to agent-x for random text', () => {
        const result = (0, agentRouter_1.classifyPrompt)('xyzzy plugh nothing to see here');
        assert_1.strict.equal(result.agentFile, 'agent-x');
    });
    // --- Priority / order tests -------------------------------------------
    it('should prefer architect over engineer for "design pattern"', () => {
        // "design pattern" contains "design pattern" (architect) and could match
        // engineer keywords -- architect should win because it comes first
        const result = (0, agentRouter_1.classifyPrompt)('choose a design pattern for the service');
        assert_1.strict.equal(result.agentFile, 'architect');
    });
    it('should prefer reviewer over engineer for "review the code"', () => {
        // "review" matches reviewer; "code" matches engineer -- reviewer first
        const result = (0, agentRouter_1.classifyPrompt)('review the code changes');
        assert_1.strict.equal(result.agentFile, 'reviewer');
    });
    // --- Case insensitivity -----------------------------------------------
    it('should be case-insensitive', () => {
        const result = (0, agentRouter_1.classifyPrompt)('CREATE AN ADR FOR PAYMENTS');
        assert_1.strict.equal(result.agentFile, 'architect');
    });
    // --- Return shape -----------------------------------------------------
    it('should return a description with every route', () => {
        const result = (0, agentRouter_1.classifyPrompt)('implement a new feature');
        assert_1.strict.ok(result.description.length > 0, 'description should not be empty');
        assert_1.strict.ok(result.keywords instanceof RegExp, 'keywords should be a RegExp');
    });
});
//# sourceMappingURL=agentRouter.test.js.map