export interface ElectronAPI {
  selectDirectory: () => Promise<string | null>;
  scanDirectory: (dirPath: string) => Promise<Array<{path: string, content: string}>>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
