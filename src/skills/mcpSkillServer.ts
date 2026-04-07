import { getBundledSkills } from './bundledSkills.js'

interface McpToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
  }
}

interface McpSkillTool {
  tool: McpToolDefinition
  handler: (args: Record<string, unknown>) => Promise<string>
}

/**
 * Convert bundled skills to MCP tool definitions.
 * Only user-invocable skills are exposed.
 * Tool names use the prefix "skill_" to avoid conflicts with built-in tools.
 */
export function buildMcpToolsFromSkills(): McpSkillTool[] {
  const skills = getBundledSkills().filter((s) => s.userInvocable !== false)

  return skills.map((skill) => ({
    tool: {
      name: `skill_${skill.name}`,
      description: skill.description,
      inputSchema: {
        type: 'object' as const,
        properties: {
          args: {
            type: 'string',
            description: 'Arguments to pass to the skill',
          },
        },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const blocks = await skill.getPromptForCommand(
        String(args.args ?? ''),
        {} as never,
      )
      return blocks
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n')
    },
  }))
}
