export type ProviderSource = 'profile' | 'env' | 'shim' | 'unknown';
export type EnvRecord = Record<string, string | undefined>;
export interface ProfileFile {
  profile: string;
  env: Record<string, string>;
  createdAt: string | null;
}
export interface LaunchWorkspace {
  workspacePath: string | null;
  source: 'active-workspace' | 'first-workspace' | 'none';
}
export interface LaunchWorkspaceInput {
  activeWorkspacePath?: string;
  workspacePaths?: string[];
}
export interface ProviderState {
  label: string;
  detail: string;
  source: ProviderSource;
}
export interface DescribeProviderInput {
  shimEnabled?: boolean;
  env: EnvRecord;
  profile?: ProfileFile | null;
}
export interface FindCommandOptions {
  cwd?: string;
  env?: EnvRecord;
  platform?: NodeJS.Platform;
}
declare function chooseLaunchWorkspace({ activeWorkspacePath, workspacePaths }: LaunchWorkspaceInput): LaunchWorkspace;
declare function parseProfileFile(raw: string): ProfileFile | null;
declare function resolveCommandCheckPath(command: string | null, workspacePath?: string | null): string | null;
declare function findCommandPath(command: string | null, options?: FindCommandOptions): string | null;
declare function isPathInsideWorkspace(filePath: string | null, workspacePath: string | null): boolean;
declare function describeProviderState({ shimEnabled, env, profile }: DescribeProviderInput): ProviderState;
export {
  chooseLaunchWorkspace,
  describeProviderState,
  findCommandPath,
  isPathInsideWorkspace,
  parseProfileFile,
  resolveCommandCheckPath,
};
//# sourceMappingURL=state.d.ts.map
