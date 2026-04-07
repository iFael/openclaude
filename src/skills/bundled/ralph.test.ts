import { afterEach, test } from 'bun:test'
import assert from 'node:assert/strict'
import { clearBundledSkills, getBundledSkills } from '../bundledSkills.js'
import { registerRalphSkill } from './ralph.js'

afterEach(() => {
  clearBundledSkills()
})

test('registerRalphSkill registers a skill named ralph', () => {
  registerRalphSkill()
  const skills = getBundledSkills()
  const skill = skills.find((s) => s.name === 'ralph')
  assert.ok(skill, 'ralph skill should be registered')
  assert.equal(skill.name, 'ralph')
})

test('ralph skill is user-invocable', () => {
  registerRalphSkill()
  const skill = getBundledSkills().find((s) => s.name === 'ralph')!
  assert.equal(skill.userInvocable, true)
})

test('ralph skill has a description', () => {
  registerRalphSkill()
  const skill = getBundledSkills().find((s) => s.name === 'ralph')!
  assert.ok(skill.description.length > 0)
})

test('ralph prompt contains verify-fix loop protocol', async () => {
  registerRalphSkill()
  const skill = getBundledSkills().find((s) => s.name === 'ralph')!
  const blocks = await skill.getPromptForCommand('add user auth', {} as never)
  const text = blocks.map((b: any) => b.text).join('')
  assert.match(text, /verify/i)
  assert.match(text, /fix/i)
  assert.match(text, /loop|repeat|cycle/i)
})

test('ralph prompt includes the task argument', async () => {
  registerRalphSkill()
  const skill = getBundledSkills().find((s) => s.name === 'ralph')!
  const blocks = await skill.getPromptForCommand('refactor database layer', {} as never)
  const text = blocks.map((b: any) => b.text).join('')
  assert.match(text, /refactor database layer/)
})

test('ralph returns usage message when no args provided', async () => {
  registerRalphSkill()
  const skill = getBundledSkills().find((s) => s.name === 'ralph')!
  const blocks = await skill.getPromptForCommand('', {} as never)
  const text = blocks.map((b: any) => b.text).join('')
  assert.match(text, /usage/i)
})
