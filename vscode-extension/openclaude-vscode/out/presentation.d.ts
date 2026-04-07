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
declare function truncateMiddle(value: unknown, maxLength: number): string;
declare function buildActionModel({
  canLaunchInWorkspaceRoot,
  workspaceProfilePath,
}?: BuildActionModelOptions): ActionModel;
declare function buildControlCenterViewModel(status?: ControlCenterStatus): ControlCenterViewModel;
export { buildActionModel, buildControlCenterViewModel, truncateMiddle };
//# sourceMappingURL=presentation.d.ts.map
