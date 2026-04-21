/**
 * Commitlint config — Conventional Commits for hospitality-agents.
 *
 * Note: imperative mood is a project convention but not enforced here —
 * commitlint cannot reliably detect it. See CLAUDE.md for the full style rules.
 */
/** @type {import('@commitlint/types').UserConfig} */
const config = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'refactor', 'perf', 'test', 'chore', 'ci', 'revert'],
    ],
    'subject-max-length': [2, 'always', 50],
    'subject-full-stop': [2, 'never', '.'],
    'subject-empty': [2, 'never'],
    'type-empty': [2, 'never'],
    'type-case': [2, 'always', 'lower-case'],
  },
}

export default config
