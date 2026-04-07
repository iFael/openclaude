import { afterEach, test } from 'bun:test'
import assert from 'node:assert/strict'
import {
  clearBundledSkills,
  registerBundledSkill,
} from './bundledSkills.js'
import { buildMcpToolsFromSkills } from './mcpSkillServer.js'

afterEach(() => {
  clearBundledSkills()
})

test('buildMcpToolsFromSkills returns empty array when no skills registered', () => {
  const tools = buildMcpToolsFromSkills()
  assert.equal(tools.length, 0)
})

test('buildMcpToolsFromSkills creates tool definition for each invocable skill', () => {
  registerBundledSkill({
    name: 'test-skill',
    description: 'A test skill',
    userInvocable: true,
    async getPromptForCommand(args) {
      return [{ type: 'text', text: `prompt: ${args}` }]
    },
  })
  registerBundledSkill({
    name: 'another-skill',
    description: 'Another skill',
    userInvocable: true,
    async getPromptForCommand(args) {
      return [{ type: 'text', text: `another: ${args}` }]
    },
  })
  const tools = buildMcpToolsFromSkills()
  assert.equal(tools.length, 2)
})

test('buildMcpToolsFromSkills excludes non-user-invocable skills', () => {
  registerBundledSkill({
    name: 'hidden-skill',
    description: 'Hidden',
    userInvocable: false,
    async getPromptForCommand() {
      return [{ type: 'text', text: 'hidden' }]
    },
  })
  registerBundledSkill({
    name: 'visible-skill',
    description: 'Visible',
    userInvocable: true,
    async getPromptForCommand() {
      return [{ type: 'text', text: 'visible' }]
    },
  })
  const tools = buildMcpToolsFromSkills()
  assert.equal(tools.length, 1)
  assert.equal(tools[0].tool.name, 'skill_visible-skill')
})

test('skill MCP tool name has skill_ prefix', () => {
  registerBundledSkill({
    name: 'my-skill',
    description: 'Test',
    userInvocable: true,
    async getPromptForCommand() {
      return [{ type: 'text', text: 'test' }]
    },
  })
  const tools = buildMcpToolsFromSkills()
  assert.equal(tools[0].tool.name, 'skill_my-skill')
})

test('skill MCP tool has correct description', () => {
  registerBundledSkill({
    name: 'desc-skill',
    description: 'Detailed description here',
    userInvocable: true,
    async getPromptForCommand() {
      return [{ type: 'text', text: 'test' }]
    },
  })
  const tools = buildMcpToolsFromSkills()
  assert.equal(tools[0].tool.description, 'Detailed description here')
})

test('skill MCP tool input schema accepts string args', () => {
  registerBundledSkill({
    name: 'schema-skill',
    description: 'Test',
    userInvocable: true,
    async getPromptForCommand() {
      return [{ type: 'text', text: 'test' }]
    },
  })
  const tools = buildMcpToolsFromSkills()
  const schema = tools[0].tool.inputSchema as any
  assert.equal(schema.type, 'object')
  assert.ok(schema.properties.args)
  assert.equal(schema.properties.args.type, 'string')
})

test('skill MCP tool handler returns prompt text', async () => {
  registerBundledSkill({
    name: 'handler-skill',
    description: 'Test',
    userInvocable: true,
    async getPromptForCommand(args) {
      return [{ type: 'text', text: `result: ${args}` }]
    },
  })
  const tools = buildMcpToolsFromSkills()
  const result = await tools[0].handler({ args: 'hello' })
  assert.equal(result, 'result: hello')
})

test('skill MCP tool handler defaults to empty string when no args', async () => {
  registerBundledSkill({
    name: 'noargs-skill',
    description: 'Test',
    userInvocable: true,
    async getPromptForCommand(args) {
      return [{ type: 'text', text: `got: [${args}]` }]
    },
  })
  const tools = buildMcpToolsFromSkills()
  const result = await tools[0].handler({})
  assert.equal(result, 'got: []')
})
