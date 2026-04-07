import { afterEach, test } from 'bun:test'
import assert from 'node:assert/strict'
import { clearBundledSkills, getBundledSkills } from '../bundledSkills.js'
import { registerAntiSlopSkill } from './antiSlop.js'

afterEach(() => {
  clearBundledSkills()
})

test('registerAntiSlopSkill registers a skill named anti-slop', () => {
  registerAntiSlopSkill()
  const skills = getBundledSkills()
  const skill = skills.find((s) => s.name === 'anti-slop')
  assert.ok(skill, 'anti-slop skill should be registered')
  assert.equal(skill.name, 'anti-slop')
})

test('anti-slop skill is user-invocable', () => {
  registerAntiSlopSkill()
  const skill = getBundledSkills().find((s) => s.name === 'anti-slop')!
  assert.equal(skill.userInvocable, true)
})

test('anti-slop skill has a description', () => {
  registerAntiSlopSkill()
  const skill = getBundledSkills().find((s) => s.name === 'anti-slop')!
  assert.ok(skill.description.length > 0)
})

test('anti-slop prompt contains cleanup instructions', async () => {
  registerAntiSlopSkill()
  const skill = getBundledSkills().find((s) => s.name === 'anti-slop')!
  const blocks = await skill.getPromptForCommand('', {} as never)
  const text = blocks.map((b: any) => b.text).join('')
  assert.match(text, /comment/i)
  assert.match(text, /verbose|redundant|unnecessary/i)
})

test('anti-slop prompt includes optional focus argument', async () => {
  registerAntiSlopSkill()
  const skill = getBundledSkills().find((s) => s.name === 'anti-slop')!
  const blocks = await skill.getPromptForCommand('src/utils/', {} as never)
  const text = blocks.map((b: any) => b.text).join('')
  assert.match(text, /src\/utils\//)
})

test('anti-slop works without arguments (reviews git diff)', async () => {
  registerAntiSlopSkill()
  const skill = getBundledSkills().find((s) => s.name === 'anti-slop')!
  const blocks = await skill.getPromptForCommand('', {} as never)
  const text = blocks.map((b: any) => b.text).join('')
  assert.match(text, /git diff/i)
})
