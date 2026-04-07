import { registerBundledSkill } from '../bundledSkills.js'

const WIKI_PROMPT = `# Wiki: Auto-Generated Codebase Documentation

Generate structured documentation for this project and write it to \`.claude/wiki/\`.

## Phase 1: Analyze Project Structure

1. Read \`package.json\` (or equivalent) to understand the project name, dependencies, and scripts.
2. Read \`README.md\` if it exists for high-level context.
3. Read \`CLAUDE.md\` if it exists for project conventions.
4. List the top-level directory structure and key subdirectories.

## Phase 2: Generate Documentation

Create the following files under \`.claude/wiki/\`:

### \`ARCHITECTURE.md\`
- Project overview (1-2 paragraphs)
- Directory structure with descriptions
- Module dependency graph (which modules import which)
- Entry points and their purposes

### \`API.md\`
- Public API surface (exported functions, classes, types)
- Key interfaces and their contracts
- Configuration options and environment variables

### \`PATTERNS.md\`
- Coding patterns used in the project (naming conventions, error handling, testing)
- Utilities and helpers available for reuse
- Common anti-patterns to avoid

### \`QUICK-REF.md\`
- Build and test commands
- Key file paths for common tasks
- Frequently referenced constants and types

## Phase 3: Verify

Re-read the generated files and ensure:
- No hallucinated function names or file paths
- All referenced files actually exist
- Documentation is concise and actionable (not verbose)

## Guidelines

- Keep each file under 200 lines. Concise > comprehensive.
- Use code examples from the actual codebase, not invented ones.
- Link between wiki files using relative markdown links.
- If a section would be empty, omit it entirely.
`

export function registerWikiSkill(): void {
  registerBundledSkill({
    name: 'wiki',
    description:
      'Generate structured codebase documentation from project analysis.',
    userInvocable: true,
    async getPromptForCommand(args) {
      const trimmed = args.trim()
      if (trimmed) {
        return [
          {
            type: 'text',
            text: `${WIKI_PROMPT}\n\n## Additional Focus\n\nConcentrate on: ${trimmed}`,
          },
        ]
      }
      return [{ type: 'text', text: WIKI_PROMPT }]
    },
  })
}
