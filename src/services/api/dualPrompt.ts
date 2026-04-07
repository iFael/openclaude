export type ProviderHint = 'openai' | 'gemini' | 'generic'

const OPENAI_ADDENDUM = `
## Provider-Specific Notes (OpenAI)

- When calling tools, use the \`tool_calls\` format with strict JSON arguments.
- Prefer concise tool arguments — avoid unnecessary whitespace in JSON.
- For multi-step tasks, report partial progress between tool calls.
- When producing code edits, match the exact indentation of the target file.
`

const GEMINI_ADDENDUM = `
## Provider-Specific Notes (Gemini)

- Maintain context across multi-turn conversations by referencing prior tool results explicitly.
- When grounding responses in code, quote the relevant lines before making changes.
- For long tool call sequences, summarize intermediate results to stay within context limits.
- Prefer single, complete edits over multiple small incremental changes.
`

/**
 * Adapt a system prompt with provider-specific hints.
 * Appends a small addendum tailored to the target provider's strengths
 * and conventions. The original prompt is always preserved unchanged.
 */
export function adaptPromptForProvider(
  prompt: string,
  provider: ProviderHint,
): string {
  if (provider === 'openai') {
    return prompt + OPENAI_ADDENDUM
  }
  if (provider === 'gemini') {
    return prompt + GEMINI_ADDENDUM
  }
  return prompt
}
