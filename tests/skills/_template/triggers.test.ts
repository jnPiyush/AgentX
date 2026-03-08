/**
 * Skill Trigger Test Template
 *
 * Copy this file to test a specific skill's trigger routing.
 * Rename to {skill-name}.triggers.test.ts
 *
 * Tests verify that:
 * 1. WHEN: clause in SKILL.md accurately describes trigger conditions
 * 2. The skill loads for matching file patterns
 * 3. The skill does NOT load for non-matching patterns
 */

interface TriggerTestCase {
  description: string;
  filePattern: string;
  keywords: string[];
  shouldMatch: boolean;
}

// -- Configure for your skill --
const SKILL_NAME = 'REPLACE_ME';
const SKILL_PATH = '.github/skills/CATEGORY/SKILL_NAME/SKILL.md';

// Define trigger test cases
const triggerCases: TriggerTestCase[] = [
  {
    description: 'should match primary file pattern',
    filePattern: '*.EXTENSION',
    keywords: ['keyword1', 'keyword2'],
    shouldMatch: true,
  },
  {
    description: 'should match secondary pattern',
    filePattern: 'src/relevant/**',
    keywords: ['keyword3'],
    shouldMatch: true,
  },
  {
    description: 'should NOT match unrelated files',
    filePattern: '*.unrelated',
    keywords: ['unrelated'],
    shouldMatch: false,
  },
];

// Simulated matcher (replace with actual skill router when available)
function matchesSkill(skillKeywords: string[], testKeywords: string[]): boolean {
  return testKeywords.some((kw) =>
    skillKeywords.some((sk) => sk.toLowerCase().includes(kw.toLowerCase()))
  );
}

// Run tests
function runTriggerTests(): void {
  const skillKeywords = SKILL_NAME.split('-'); // Simplified - read from SKILL.md in real impl

  let passed = 0;
  let failed = 0;

  for (const tc of triggerCases) {
    const result = matchesSkill(skillKeywords, tc.keywords);
    const ok = result === tc.shouldMatch;

    if (ok) {
      console.log(`  [PASS] ${tc.description}`);
      passed++;
    } else {
      console.log(`  [FAIL] ${tc.description} (expected ${tc.shouldMatch}, got ${result})`);
      failed++;
    }
  }

  console.log(`\n  Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTriggerTests();
