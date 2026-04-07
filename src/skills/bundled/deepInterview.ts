import { registerBundledSkill } from '../bundledSkills.js'

const DEEP_INTERVIEW_PROMPT = `# Deep Interview: Quantitative Ambiguity Scoring

Before executing the task below, evaluate it for ambiguity and ask clarifying questions.

## Ambiguity Scoring Protocol

Rate the task on these dimensions (0 = crystal clear, 10 = completely ambiguous):

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Scope** | ? | What exactly is included/excluded? |
| **Behavior** | ? | What should happen in each scenario? |
| **Constraints** | ? | Performance, compatibility, security requirements? |
| **Integration** | ? | How does this connect to existing code? |
| **Acceptance** | ? | How will we know it is done? |

**Overall Ambiguity Score** = average of all dimensions.

## Rules

1. Compute the ambiguity score BEFORE doing anything else.
2. **Threshold: 3.0** — if the overall score is >= 3.0, you MUST ask clarifying questions before proceeding.
3. Ask ONE question per round, targeting the dimension with the highest score.
4. Pressure-test every answer — do not accept vague responses.
5. After each answer, recompute the score. Repeat until score < 3.0.
6. Once score < 3.0, summarize the clarified requirements and begin execution.

## Non-Goals

Explicitly state what this task does NOT include to prevent scope creep.

## Decision Boundaries

For every "it depends" situation, define the exact condition and the action for each branch.
`

export function registerDeepInterviewSkill(): void {
  registerBundledSkill({
    name: 'deep-interview',
    description:
      'Score task ambiguity quantitatively and ask clarifying questions before execution.',
    argumentHint: '<task description>',
    userInvocable: true,
    async getPromptForCommand(args) {
      const trimmed = args.trim()
      if (!trimmed) {
        return [
          {
            type: 'text',
            text: 'Usage: /deep-interview <task description>\n\nProvide a task to evaluate for ambiguity before execution.',
          },
        ]
      }
      return [
        {
          type: 'text',
          text: `${DEEP_INTERVIEW_PROMPT}\n\n## Task to Evaluate\n\n${trimmed}`,
        },
      ]
    },
  })
}
