import type { UserConfig } from '@commitlint/types';

export default {
  extends: ['@commitlint/config-conventional'],
  parserPreset: {
    name: 'conventional-changelog-conventionalcommits',
    presetConfig: {
      types: [
        { type: 'feat', section: 'Features' },
        { type: 'fix', section: 'Bug Fixes' },
        { type: 'chore', hidden: true },
      ],
    },
  },
  rules: {
    'scope-enum': [2, 'always', ['api', 'web', 'shared', 'docs']],
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'test',
        'build',
        'ci',
        'chore',
      ],
    ],
    'header-max-length': [2, 'always', 72],
  },
} satisfies UserConfig;
