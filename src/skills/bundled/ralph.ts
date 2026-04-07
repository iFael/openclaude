import { registerBundledSkill } from '../bundledSkills.js'

const RALPH_PROMPT = `# Ralph: Persistent Completion Loop

You are in completion-loop mode. Do NOT declare the task done until ALL verifications pass.

## Protocol

### Phase 1: Execute
Implement the task fully. Follow existing patterns in the codebase.

### Phase 2: Verify
Run ALL applicable checks in this order:
1. **Build**: Run the project build command. Zero errors required.
2. **Tests**: Run the test suite. 100% pass rate required.
3. **Lint**: Run the linter. Zero violations required.
4. **Manual check**: Re-read the changed files. Confirm the implementation matches the task requirements.

### Phase 3: Fix Loop
If ANY check in Phase 2 fails:
1. Diagnose the root cause (do not guess — read error output carefully).
2. Fix the issue with a targeted change (minimum diff).
3. Return to Phase 2. Repeat until ALL checks pass.

**Maximum iterations**: 5 fix cycles. If still failing after 5, report the remaining issues and stop.

### Phase 4: Anti-Slop Pass
After all checks pass, review the changes for LLM code smells:
- Unnecessary comments that narrate obvious code
- Over-abstraction (wrapper functions for single-use logic)
- Verbose error messages that could be concise
- Type annotations the compiler already infers

Remove any slop found, then re-run Phase 2 one final time.

### Phase 5: Report
Summarize:
- What was implemented
- Which verifications passed
- Number of fix cycles required
- Any slop cleaned up
`

export function registerRalphSkill(): void {
  registerBundledSkill({
    name: 'ralph',
    description:
      'Persistent verify-fix loop: execute, verify, fix, repeat until truly done.',
    argumentHint: '<task>',
    userInvocable: true,
    async getPromptForCommand(args) {
      const trimmed = args.trim()
      if (!trimmed) {
        return [
          {
            type: 'text',
            text: 'Usage: /ralph <task>\n\nProvide a task to execute with persistent verification.',
          },
        ]
      }
      return [
        {
          type: 'text',
          text: `${RALPH_PROMPT}\n\n## Task\n\n${trimmed}`,
        },
      ]
    },
  })
}
