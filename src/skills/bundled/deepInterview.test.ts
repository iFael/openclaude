import { afterEach, test } from 'bun:test'
import assert from 'node:assert/strict'
import { clearBundledSkills, getBundledSkills } from '../bundledSkills.js'
import { registerDeepInterviewSkill } from './deepInterview.js'

afterEach(() => {
  clearBundledSkills()
})

test('registerDeepInterviewSkill registers a skill named deep-interview', () => {
  registerDeepInterviewSkill()
  const skills = getBundledSkills()
  const skill = skills.find((s) => s.name === 'deep-interview')
  assert.ok(skill, 'deep-interview skill should be registered')
  assert.equal(skill.name, 'deep-interview')
})

test('deep-interview skill is user-invocable', () => {
  registerDeepInterviewSkill()
  const skill = getBundledSkills().find((s) => s.name === 'deep-interview')!
  assert.equal(skill.userInvocable, true)
})

test('deep-interview skill has a description', () => {
  registerDeepInterviewSkill()
  const skill = getBundledSkills().find((s) => s.name === 'deep-interview')!
  assert.ok(skill.description.length > 0)
})

test('deep-interview prompt contains ambiguity scoring protocol', async () => {
  registerDeepInterviewSkill()
  const skill = getBundledSkills().find((s) => s.name === 'deep-interview')!
  const blocks = await skill.getPromptForCommand('build auth system', {} as never)
  const text = blocks.map((b: any) => b.text).join('')
  assert.match(text, /ambiguity/i)
  assert.match(text, /score/i)
  assert.match(text, /threshold/i)
})

test('deep-interview prompt includes the task argument', async () => {
  registerDeepInterviewSkill()
  const skill = getBundledSkills().find((s) => s.name === 'deep-interview')!
  const blocks = await skill.getPromptForCommand('implement caching layer', {} as never)
  const text = blocks.map((b: any) => b.text).join('')
  assert.match(text, /implement caching layer/)
})

test('deep-interview returns usage message when no args provided', async () => {
  registerDeepInterviewSkill()
  const skill = getBundledSkills().find((s) => s.name === 'deep-interview')!
  const blocks = await skill.getPromptForCommand('', {} as never)
  const text = blocks.map((b: any) => b.text).join('')
  assert.match(text, /usage/i)
})
