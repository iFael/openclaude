import * as vscode from 'vscode';
import { renderControlCenterHtml } from './renderer';
interface LaunchTargetOptions {
  activeFilePath?: string | null;
  workspacePath?: string | null;
  workspaceSourceLabel?: string;
  executable?: string;
}
interface LaunchTargets {
  projectAwareCwd: string | null;
  projectAwareCwdLabel: string;
  projectAwareSourceLabel: string;
  workspaceRootCwd: string | null;
  workspaceRootCwdLabel: string;
  launchActionsShareTarget: boolean;
  launchActionsShareTargetReason: string | null;
}
interface LaunchOptions {
  requireWorkspace?: boolean;
}
declare function isCommandAvailable(command: string, launchCwd: string | null): Promise<boolean>;
declare function getExecutableFromCommand(command: string): string;
declare function getWorkspacePaths(): string[];
declare function getActiveWorkspacePath(): string | null;
declare function getActiveFilePath(): string | null;
declare function resolveLaunchTargets({
  activeFilePath,
  workspacePath,
  workspaceSourceLabel,
  executable,
}?: LaunchTargetOptions): LaunchTargets;
declare function resolveLaunchWorkspace(): import('./state').LaunchWorkspace;
declare function getWorkspaceSourceLabel(source: string): string;
declare function getProviderSourceLabel(source: string): string;
declare function readWorkspaceProfile(profilePath: string | null):
  | {
      profile: null;
      statusLabel: string;
      statusHint: string;
      filePath: null;
    }
  | {
      profile: null;
      statusLabel: string;
      statusHint: string;
      filePath: string;
    }
  | {
      profile: import('./state').ProfileFile;
      statusLabel: string;
      statusHint: string;
      filePath: string;
    };
declare function collectControlCenterState(): Promise<{
  installed: boolean;
  executable: string;
  launchCommand: string;
  terminalName: string;
  shimEnabled: boolean;
  workspaceFolder: string | null;
  workspaceSourceLabel: string;
  launchCwd: string | null;
  launchCwdLabel: string;
  launchCwdSourceLabel: string;
  workspaceRootCwd: string | null;
  workspaceRootCwdLabel: string;
  launchActionsShareTarget: boolean;
  launchActionsShareTargetReason: string | null;
  canLaunchInWorkspaceRoot: boolean;
  profileStatusLabel: string;
  profileStatusHint: string;
  workspaceProfilePath: string | null;
  providerState: import('./state').ProviderState;
  providerSourceLabel: string;
}>;
declare function launchOpenClaude(options?: LaunchOptions): Promise<void>;
declare function openWorkspaceProfile(): Promise<void>;
declare class OpenClaudeControlCenterProvider implements vscode.WebviewViewProvider {
  webviewView: vscode.WebviewView | null;
  constructor();
  resolveWebviewView(webviewView: vscode.WebviewView): Promise<void>;
  refresh(): Promise<void>;
  getHtml(status: Awaited<ReturnType<typeof collectControlCenterState>>): string;
}
/**
 * Read proxy credentials from the file written by the SessionStart hook.
 */
declare function readCredentialsFile(): {
  baseUrl: string;
  apiKey: string;
} | null;
/**
 * Verify that the proxy is alive by hitting GET /.
 */
declare function verifySdkProxy(baseUrl: string): Promise<boolean>;
/**
 * Poll for credentials: read the file, verify proxy liveness, and
 * inject into terminals via environmentVariableCollection.
 */
declare function syncSdkProxyCredentials(): Promise<void>;
declare function activate(context: vscode.ExtensionContext): void;
declare function deactivate(): void;
export declare const _internal: {
  isCommandAvailable: typeof isCommandAvailable;
  getWorkspacePaths: typeof getWorkspacePaths;
  getActiveWorkspacePath: typeof getActiveWorkspacePath;
  getActiveFilePath: typeof getActiveFilePath;
  resolveLaunchWorkspace: typeof resolveLaunchWorkspace;
  collectControlCenterState: typeof collectControlCenterState;
  launchOpenClaude: typeof launchOpenClaude;
  openWorkspaceProfile: typeof openWorkspaceProfile;
  readCredentialsFile: typeof readCredentialsFile;
  verifySdkProxy: typeof verifySdkProxy;
  syncSdkProxyCredentials: typeof syncSdkProxyCredentials;
  readonly _credPath: string;
  _lastBaseUrl: string;
  _lastApiKey: string;
  _envCollection: vscode.GlobalEnvironmentVariableCollection | null;
};
export {
  activate,
  deactivate,
  getExecutableFromCommand,
  getProviderSourceLabel,
  getWorkspaceSourceLabel,
  OpenClaudeControlCenterProvider,
  readWorkspaceProfile,
  renderControlCenterHtml,
  resolveLaunchTargets,
};
//# sourceMappingURL=extension.d.ts.map
