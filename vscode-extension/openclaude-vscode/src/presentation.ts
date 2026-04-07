// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface Badge {
  key: string;
  label: string;
  value: string;
  tone: string;
}

export interface SummaryCard {
  key: string;
  label: string;
  value: string;
  detail?: string;
}

export interface DetailRow {
  key: string;
  label: string;
  summary: string;
  detail: string;
  tone?: string;
}

export interface DetailSection {
  title: string;
  rows: DetailRow[];
}

interface ActionItem {
  id: string;
  label: string;
  detail: string;
  tone: string;
  disabled: boolean;
}

export interface ActionModel {
  primary: ActionItem;
  launchRoot: ActionItem;
  openProfile: ActionItem | null;
}

export interface ControlCenterViewModel {
  header: {
    eyebrow: string;
    title: string;
    subtitle: string;
  };
  headerBadges: Badge[];
  summaryCards: SummaryCard[];
  detailSections: DetailSection[];
  actions: ActionModel;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

interface ProviderState {
  source?: string;
  label?: string;
  detail?: string;
}

interface BuildActionModelOptions {
  canLaunchInWorkspaceRoot?: boolean;
  workspaceProfilePath?: string | null;
}

interface ControlCenterStatus {
  installed?: boolean;
  executable?: string;
  providerState?: ProviderState;
  providerSourceLabel?: string;
  workspaceFolder?: string | null;
  workspaceSourceLabel?: string;
  launchCwdLabel?: string;
  launchCommand?: string;
  terminalName?: string;
  profileStatusLabel?: string;
  profileStatusHint?: string;
  canLaunchInWorkspaceRoot?: boolean;
  workspaceProfilePath?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateMiddle(value: unknown, maxLength: number): string {
  const text: string = String(value || '');
  if (!text || text.length <= maxLength) {
    return text;
  }

  const basename: string = text.split(/[\\/]/).filter(Boolean).pop() || '';
  if (basename && basename.length + 4 <= maxLength) {
    const separator: string = text.includes('\\') ? '\\' : '/';
    return `...${separator}${basename}`;
  }

  if (maxLength <= 3) {
    return '.'.repeat(Math.max(maxLength, 0));
  }

  const available: number = maxLength - 3;
  const startLength: number = Math.ceil(available / 2);
  const endLength: number = Math.floor(available / 2);
  return `${text.slice(0, startLength)}...${text.slice(text.length - endLength)}`;
}

function getPathTail(value: unknown): string {
  const text: string = String(value || '');
  if (!text) {
    return '';
  }

  return text.split(/[\\/]/).filter(Boolean).pop() || text;
}

function buildActionModel({
  canLaunchInWorkspaceRoot,
  workspaceProfilePath,
}: BuildActionModelOptions = {}): ActionModel {
  return {
    primary: {
      id: 'launch',
      label: 'Launch OpenClaude',
      detail: 'Use the resolved project-aware launch directory',
      tone: 'accent',
      disabled: false,
    },
    launchRoot: {
      id: 'launchRoot',
      label: 'Launch in Workspace Root',
      detail: canLaunchInWorkspaceRoot
        ? 'Launch directly from the resolved workspace root'
        : 'Open a workspace folder to enable workspace-root launch',
      tone: 'neutral',
      disabled: !canLaunchInWorkspaceRoot,
    },
    openProfile: workspaceProfilePath
      ? {
          id: 'openProfile',
          label: 'Open Workspace Profile',
          detail: `Inspect ${truncateMiddle(workspaceProfilePath, 40)}`,
          tone: 'neutral',
          disabled: false,
        }
      : null,
  };
}

function getRuntimeTone(installed: boolean | undefined): string {
  return installed ? 'positive' : 'critical';
}

function getProfileTone(profileStatusLabel: string | undefined): string {
  return profileStatusLabel === 'Invalid' || profileStatusLabel === 'Unreadable' ? 'warning' : 'neutral';
}

function getProviderTone(providerState: ProviderState | undefined): string {
  return providerState?.source === 'shim' || providerState?.source === 'unknown' ? 'warning' : 'neutral';
}

function getProviderDetail(providerState: ProviderState | undefined, providerSourceLabel: string | undefined): string {
  const detail: string = providerState?.detail || '';
  if (!detail) {
    return providerSourceLabel || '';
  }

  switch (providerState?.source) {
    case 'profile':
      return [detail, providerSourceLabel].filter(Boolean).join(' · ');
    case 'env':
      return /^from environment$/i.test(detail) ? detail : [detail, providerSourceLabel].filter(Boolean).join(' · ');
    case 'shim':
    case 'unknown':
      return detail;
    default:
      return [detail, providerSourceLabel].filter(Boolean).join(' · ');
  }
}

function buildControlCenterViewModel(status: ControlCenterStatus = {}): ControlCenterViewModel {
  const runtimeSummary: string = status.installed ? 'Installed' : 'Missing';
  const runtimeDetail: string = status.executable || 'Unknown command';
  const providerDetail: string = getProviderDetail(status.providerState, status.providerSourceLabel);
  const providerTone: string = getProviderTone(status.providerState);
  const workspaceSummary: string = status.workspaceFolder ? getPathTail(status.workspaceFolder) : 'No workspace open';
  const workspaceDetail: string =
    [status.workspaceFolder, status.workspaceSourceLabel].filter(Boolean).join(' · ') || 'no workspace open';

  return {
    header: {
      eyebrow: 'OpenClaude Control Center',
      title: 'Project-aware OpenClaude companion',
      subtitle: 'Useful local status, predictable launch behavior, and quick access to the workflows you actually use.',
    },
    headerBadges: [
      {
        key: 'runtime',
        label: 'Runtime',
        value: runtimeSummary,
        tone: getRuntimeTone(status.installed),
      },
      {
        key: 'provider',
        label: 'Provider',
        value: status.providerState?.label || 'Unknown',
        tone: providerTone,
      },
      {
        key: 'profileStatus',
        label: 'Profile',
        value: status.profileStatusLabel || 'Unknown',
        tone: getProfileTone(status.profileStatusLabel),
      },
    ],
    summaryCards: [
      {
        key: 'workspace',
        label: 'Workspace',
        value: status.workspaceFolder || 'No workspace open',
        detail: status.workspaceSourceLabel || 'no workspace open',
      },
      {
        key: 'launchCwd',
        label: 'Launch cwd',
        value: status.launchCwdLabel || 'VS Code default terminal cwd',
      },
      {
        key: 'launchCommand',
        label: 'Launch command',
        value: status.launchCommand || '',
        detail: status.terminalName ? `Integrated terminal: ${status.terminalName}` : '',
      },
    ],
    detailSections: [
      {
        title: 'Project',
        rows: [
          {
            key: 'workspace',
            label: 'Workspace folder',
            summary: workspaceSummary,
            detail: workspaceDetail,
          },
          {
            key: 'profileStatus',
            label: 'Workspace profile',
            summary: status.profileStatusLabel || 'Unknown',
            detail: status.profileStatusHint || '',
            tone: getProfileTone(status.profileStatusLabel),
          },
        ],
      },
      {
        title: 'Runtime',
        rows: [
          {
            key: 'runtime',
            label: 'OpenClaude executable',
            summary: runtimeSummary,
            detail: runtimeDetail,
            tone: getRuntimeTone(status.installed),
          },
          {
            key: 'provider',
            label: 'Detected provider',
            summary: status.providerState?.label || 'Unknown',
            detail: providerDetail,
            tone: providerTone,
          },
        ],
      },
    ],
    actions: buildActionModel(status),
  };
}

export { buildActionModel, buildControlCenterViewModel, truncateMiddle };
