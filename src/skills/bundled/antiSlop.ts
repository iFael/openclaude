import { registerBundledSkill } from '../bundledSkills.js'

const ANTI_SLOP_PROMPT = `# Anti-Slop: Clean LLM-Generated Code

Review recent changes for common LLM code smells and fix them automatically.

## Phase 1: Identify Changes

Run \`git diff\` (or \`git diff HEAD\` if there are staged changes) to see what changed. If there are no git changes, review the most recently modified files mentioned in this conversation.

## Phase 2: Detect Slop Patterns

For each changed file, scan for these categories:

### 2.1 Unnecessary Comments
- Comments that describe WHAT the code does (the code itself already says that)
- Comments narrating the change or referencing the task
- Trailing \`// end of function\` or \`// end of if\` markers
- JSDoc on private/internal functions that are self-explanatory

### 2.2 Over-Engineering
- Wrapper functions that add no value (just forward arguments)
- Abstractions used only once
- Configuration objects for things that never change
- Generic type parameters where a concrete type suffices
- Feature flags for non-optional behavior

### 2.3 Verbosity
- Redundant type annotations the compiler infers
- Explicit \`=== undefined\` or \`=== null\` when \`??\` or \`?.\` suffices
- \`if (x) { return true } else { return false }\` instead of \`return x\`
- Multi-line expressions that fit clearly on one line
- Unnecessary destructuring or spreading

### 2.4 Defensive Over-Coding
- Error handling for impossible cases (internal code, not system boundaries)
- Null checks on values that are never null in practice
- Fallback defaults that duplicate the actual default
- Validation of trusted internal data

## Phase 3: Fix

For each detected issue, fix it directly. Apply the minimum change needed. Do NOT refactor surrounding code that was not changed.

## Phase 4: Verify

Run tests and build to confirm the cleanup did not break anything.

## Phase 5: Report

Briefly list what was cleaned, grouped by category. If nothing was found, confirm the code was already clean.
`

export function registerAntiSlopSkill(): void {
  registerBundledSkill({
    name: 'anti-slop',
    description:
      'Clean up verbose, redundant, and over-engineered LLM-generated code.',
    userInvocable: true,
    async getPromptForCommand(args) {
      const trimmed = args.trim()
      if (trimmed) {
        return [
          {
            type: 'text',
            text: `${ANTI_SLOP_PROMPT}\n\n## Focus Area\n\nConcentrate on: ${trimmed}`,
          },
        ]
      }
      return [{ type: 'text', text: ANTI_SLOP_PROMPT }]
    },
  })
}
