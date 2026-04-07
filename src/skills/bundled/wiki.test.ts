import { afterEach, test } from 'bun:test'
import assert from 'node:assert/strict'
import { clearBundledSkills, getBundledSkills } from '../bundledSkills.js'
import { registerWikiSkill } from './wiki.js'

afterEach(() => {
  clearBundledSkills()
})

test('registerWikiSkill registers a skill named wiki', () => {
  registerWikiSkill()
  const skills = getBundledSkills()
  const skill = skills.find((s) => s.name === 'wiki')
  assert.ok(skill, 'wiki skill should be registered')
  assert.equal(skill.name, 'wiki')
})

test('wiki skill is user-invocable', () => {
  registerWikiSkill()
  const skill = getBundledSkills().find((s) => s.name === 'wiki')!
  assert.equal(skill.userInvocable, true)
})

test('wiki skill has a description', () => {
  registerWikiSkill()
  const skill = getBundledSkills().find((s) => s.name === 'wiki')!
  assert.ok(skill.description.length > 0)
})

test('wiki skill prompt includes codebase analysis instructions', async () => {
  registerWikiSkill()
  const skill = getBundledSkills().find((s) => s.name === 'wiki')!
  const blocks = await skill.getPromptForCommand('', {} as never)
  const text = blocks.map((b: any) => b.text).join('')
  assert.match(text, /structure|directory|architecture/i)
  assert.match(text, /package\.json|README/i)
})

test('wiki skill prompt specifies output location', async () => {
  registerWikiSkill()
  const skill = getBundledSkills().find((s) => s.name === 'wiki')!
  const blocks = await skill.getPromptForCommand('', {} as never)
  const text = blocks.map((b: any) => b.text).join('')
  assert.match(text, /\.claude\/wiki/)
})

test('wiki skill includes optional focus argument', async () => {
  registerWikiSkill()
  const skill = getBundledSkills().find((s) => s.name === 'wiki')!
  const blocks = await skill.getPromptForCommand('api endpoints', {} as never)
  const text = blocks.map((b: any) => b.text).join('')
  assert.match(text, /api endpoints/)
})
