import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { buildActionModel, buildControlCenterViewModel, truncateMiddle } from './presentation';

test('truncateMiddle keeps the profile filename visible', () => {
  assert.equal(
    truncateMiddle('/Users/example/projects/openclaude/workspace/.openclaude-profile.json', 30),
    '.../.openclaude-profile.json',
  );
});

test('truncateMiddle keeps the filename visible for Windows-style paths', () => {
  assert.equal(
    truncateMiddle('C:\\Users\\example\\openclaude\\workspace\\.openclaude-profile.json', 30),
    '...\\.openclaude-profile.json',
  );
});

test('buildActionModel disables workspace-root launch without a workspace', () => {
  const model = buildActionModel({
    canLaunchInWorkspaceRoot: false,
    workspaceProfilePath: null,
  });

  assert.deepEqual(model.launchRoot, {
    id: 'launchRoot',
    label: 'Launch in Workspace Root',
    detail: 'Open a workspace folder to enable workspace-root launch',
    tone: 'neutral',
    disabled: true,
  });
});

test('buildActionModel hides workspace-profile action when no profile exists', () => {
  const model = buildActionModel({
    canLaunchInWorkspaceRoot: true,
    workspaceProfilePath: null,
  });

  assert.deepEqual(model.primary, {
    id: 'launch',
    label: 'Launch OpenClaude',
    detail: 'Use the resolved project-aware launch directory',
    tone: 'accent',
    disabled: false,
  });
  assert.equal(model.openProfile, null);
});

test('buildActionModel includes workspace-profile action when a profile exists', () => {
  const model = buildActionModel({
    canLaunchInWorkspaceRoot: true,
    workspaceProfilePath: 'C:\\Users\\example\\openclaude\\workspace\\.openclaude-profile.json',
  });

  assert.deepEqual(model.openProfile, {
    id: 'openProfile',
    label: 'Open Workspace Profile',
    detail: 'Inspect ...\\.openclaude-profile.json',
    tone: 'neutral',
    disabled: false,
  });
});

function createStatus(overrides: Record<string, unknown> = {}) {
  return {
    installed: true,
    executable: 'openclaude',
    launchCommand: 'openclaude --project-aware',
    terminalName: 'OpenClaude',
    shimEnabled: false,
    workspaceFolder: '/workspace/openclaude',
    workspaceSourceLabel: 'active editor workspace',
    launchCwd: '/workspace/openclaude',
    launchCwdLabel: '/workspace/openclaude',
    canLaunchInWorkspaceRoot: true,
    profileStatusLabel: 'Found',
    profileStatusHint: '/workspace/openclaude/.openclaude-profile.json',
    workspaceProfilePath: '/workspace/openclaude/.openclaude-profile.json',
    providerState: {
      label: 'Codex',
      detail: 'gpt-5.4',
      source: 'profile',
    },
    providerSourceLabel: 'saved profile',
    ...overrides,
  };
}

test('buildControlCenterViewModel keeps header badges and summary cards non-redundant', () => {
  const viewModel = buildControlCenterViewModel(createStatus());
  const headerKeys = new Set(viewModel.headerBadges.map((badge) => badge.key));
  const summaryKeys = new Set(viewModel.summaryCards.map((card) => card.key));

  assert.deepEqual([...headerKeys].sort(), ['profileStatus', 'provider', 'runtime']);
  assert.deepEqual([...summaryKeys].sort(), ['launchCommand', 'launchCwd', 'workspace']);

  for (const key of headerKeys) {
    assert.equal(summaryKeys.has(key), false);
  }
});

test('buildControlCenterViewModel uses stable semantic tones for badges and actions', () => {
  const viewModel = buildControlCenterViewModel(
    createStatus({
      installed: false,
      profileStatusLabel: 'Invalid',
      providerState: {
        label: 'OpenAI-compatible (provider unknown)',
        detail: 'launch shim enabled',
        source: 'shim',
      },
      providerSourceLabel: 'launch setting',
    }),
  );

  assert.deepEqual(viewModel.headerBadges, [
    {
      key: 'runtime',
      label: 'Runtime',
      value: 'Missing',
      tone: 'critical',
    },
    {
      key: 'provider',
      label: 'Provider',
      value: 'OpenAI-compatible (provider unknown)',
      tone: 'warning',
    },
    {
      key: 'profileStatus',
      label: 'Profile',
      value: 'Invalid',
      tone: 'warning',
    },
  ]);

  assert.equal(viewModel.actions.primary.tone, 'accent');
  assert.equal(viewModel.actions.launchRoot.tone, 'neutral');
});

test('buildControlCenterViewModel uses a concise project summary before full path detail', () => {
  const viewModel = buildControlCenterViewModel(createStatus());

  assert.deepEqual(viewModel.detailSections, [
    {
      title: 'Project',
      rows: [
        {
          key: 'workspace',
          label: 'Workspace folder',
          summary: 'openclaude',
          detail: '/workspace/openclaude · active editor workspace',
        },
        {
          key: 'profileStatus',
          label: 'Workspace profile',
          summary: 'Found',
          detail: '/workspace/openclaude/.openclaude-profile.json',
          tone: 'neutral',
        },
      ],
    },
    {
      title: 'Runtime',
      rows: [
        {
          key: 'runtime',
          label: 'OpenClaude executable',
          summary: 'Installed',
          detail: 'openclaude',
          tone: 'positive',
        },
        {
          key: 'provider',
          label: 'Detected provider',
          summary: 'Codex',
          detail: 'gpt-5.4 · saved profile',
          tone: 'neutral',
        },
      ],
    },
  ]);
});

test('buildControlCenterViewModel keeps launch command only in summary cards', () => {
  const viewModel = buildControlCenterViewModel(createStatus());

  assert.deepEqual(
    viewModel.summaryCards.find((card) => card.key === 'launchCommand'),
    {
      key: 'launchCommand',
      label: 'Launch command',
      value: 'openclaude --project-aware',
      detail: 'Integrated terminal: OpenClaude',
    },
  );

  assert.equal(
    viewModel.detailSections.some((section) => section.rows.some((row) => row.key === 'launchCommand')),
    false,
  );
});

test('buildControlCenterViewModel keeps env-backed provider detail non-redundant', () => {
  const viewModel = buildControlCenterViewModel(
    createStatus({
      providerState: {
        label: 'Gemini',
        detail: 'from environment',
        source: 'env',
      },
      providerSourceLabel: 'environment',
    }),
  );

  assert.deepEqual(
    viewModel.detailSections[1].rows.find((row) => row.key === 'provider'),
    {
      key: 'provider',
      label: 'Detected provider',
      summary: 'Gemini',
      detail: 'from environment',
      tone: 'neutral',
    },
  );
});

test('buildControlCenterViewModel keeps shim-backed provider detail honest', () => {
  const viewModel = buildControlCenterViewModel(
    createStatus({
      providerState: {
        label: 'OpenAI-compatible (provider unknown)',
        detail: 'launch shim enabled',
        source: 'shim',
      },
      providerSourceLabel: 'launch setting',
    }),
  );

  assert.deepEqual(
    viewModel.detailSections[1].rows.find((row) => row.key === 'provider'),
    {
      key: 'provider',
      label: 'Detected provider',
      summary: 'OpenAI-compatible (provider unknown)',
      detail: 'launch shim enabled',
      tone: 'warning',
    },
  );
});

test('buildControlCenterViewModel keeps unknown provider detail honest', () => {
  const viewModel = buildControlCenterViewModel(
    createStatus({
      providerState: {
        label: 'Unknown',
        detail: 'no saved profile or provider env detected',
        source: 'unknown',
      },
      providerSourceLabel: 'unknown',
    }),
  );

  assert.deepEqual(
    viewModel.detailSections[1].rows.find((row) => row.key === 'provider'),
    {
      key: 'provider',
      label: 'Detected provider',
      summary: 'Unknown',
      detail: 'no saved profile or provider env detected',
      tone: 'warning',
    },
  );
});

test('buildControlCenterViewModel carries forward the existing action model', () => {
  const status = createStatus();
  const viewModel = buildControlCenterViewModel(status);

  assert.deepEqual(viewModel.actions, buildActionModel(status));
});

// ---------------------------------------------------------------------------
// truncateMiddle — uncovered branches (maxLength <= 3, general truncation)
// ---------------------------------------------------------------------------

test('truncateMiddle falls back to general truncation when basename does not fit', () => {
  // basename = 'abcdefghijklmnop' (16 chars), 16 + 4 = 20 > 8
  // available = 8 - 3 = 5, startLength = 3, endLength = 2
  assert.equal(truncateMiddle('abcdefghijklmnop', 8), 'abc...op');
});

test('truncateMiddle returns dots when maxLength is 3 or less', () => {
  assert.equal(truncateMiddle('abcdefghij', 3), '...');
  assert.equal(truncateMiddle('abcdefghij', 2), '..');
  assert.equal(truncateMiddle('abcdefghij', 1), '.');
});

test('truncateMiddle returns empty string when maxLength is 0', () => {
  assert.equal(truncateMiddle('abcdefghij', 0), '');
});

// ---------------------------------------------------------------------------
// buildControlCenterViewModel — uncovered getProviderDetail branch (empty detail)
// ---------------------------------------------------------------------------

test('buildControlCenterViewModel falls back to providerSourceLabel when provider detail is absent', () => {
  const viewModel = buildControlCenterViewModel(
    createStatus({
      providerState: { label: 'CustomProvider', source: 'env' },
      providerSourceLabel: 'custom source',
    }),
  );

  const providerRow = viewModel.detailSections[1].rows.find((row) => row.key === 'provider');
  assert.equal(providerRow?.detail, 'custom source');
});

test('buildControlCenterViewModel returns empty provider detail when both detail and source label are absent', () => {
  const viewModel = buildControlCenterViewModel(
    createStatus({
      providerState: { label: 'SomeProvider' },
      providerSourceLabel: undefined,
    }),
  );

  const providerRow = viewModel.detailSections[1].rows.find((row) => row.key === 'provider');
  assert.equal(providerRow?.detail, '');
});
