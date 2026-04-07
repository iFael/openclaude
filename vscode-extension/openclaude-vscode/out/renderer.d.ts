export type Tone = 'accent' | 'positive' | 'warning' | 'critical' | 'neutral';
export interface HeaderBadge {
  key: string;
  label: string;
  value: string;
  tone: Tone;
}
export interface SummaryCard {
  key: string;
  label: string;
  value: string;
  detail?: string;
}
export interface DetailRow {
  key?: string;
  label: string;
  summary: string;
  detail?: string;
  tone?: Tone;
}
export interface DetailSection {
  title: string;
  rows: DetailRow[];
}
export interface ActionButton {
  id: string;
  label: string;
  detail: string;
  tone?: string;
  disabled?: boolean;
}
export interface ViewModelHeader {
  eyebrow: string;
  title: string;
  subtitle: string;
}
export interface ViewModelActions {
  primary: ActionButton;
  launchRoot: ActionButton;
  openProfile: ActionButton | null;
}
export interface ControlCenterViewModel {
  header: ViewModelHeader;
  headerBadges: HeaderBadge[];
  summaryCards: SummaryCard[];
  detailSections: DetailSection[];
  actions: ViewModelActions;
}
export interface ProviderState {
  label?: string;
  source?: string;
  detail?: string;
}
export interface ControlCenterStatus {
  installed?: boolean;
  executable?: string;
  providerState?: ProviderState;
  providerSourceLabel?: string;
  workspaceFolder?: string | null;
  workspaceSourceLabel?: string;
  launchCwdLabel?: string;
  launchCwd?: string | null;
  launchCwdSourceLabel?: string;
  launchCommand?: string;
  terminalName?: string;
  profileStatusLabel?: string;
  profileStatusHint?: string;
  workspaceProfilePath?: string | null;
  canLaunchInWorkspaceRoot?: boolean;
  workspaceRootCwdLabel?: string;
  launchActionsShareTargetReason?: string | null;
}
export interface RenderOptions {
  nonce?: string;
  platform?: string;
}
declare function escapeHtml(value: unknown): string;
declare function getToneClass(tone?: Tone): string;
declare function renderControlCenterHtml(status: ControlCenterStatus, options?: RenderOptions): string;
declare function renderErrorHtml(error: unknown): string;
export { escapeHtml, getToneClass, renderControlCenterHtml, renderErrorHtml };
//# sourceMappingURL=renderer.d.ts.map
