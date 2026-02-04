/// <reference types="vite/client" />

interface Window {
  electron?: {
    chooseDirectory: () => Promise<string | null>;
    scanDirectory: (path: string) => Promise<any>;
    readFile: (path: string) => Promise<string>;
    listFiles: (path: string) => Promise<string[]>;
  };
  electronAPI?: {
    selectDirectory: () => Promise<string | null>;
    scanDirectory: (dirPath: string) => Promise<Array<{path: string, content: string}>>;
  };
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
  }) => Promise<FileSystemDirectoryHandle>;
}

// Types pour FileSystemDirectoryHandle
interface FileSystemDirectoryHandle {
  values(): AsyncIterableIterator<FileSystemHandle>;
  getFileHandle(name: string): Promise<FileSystemFileHandle>;
  [Symbol.asyncIterator](): AsyncIterableIterator<FileSystemHandle>;
}

interface FileSystemFileHandle {
  getFile(): Promise<File>;
}

interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
}

// Déclarer le module cytoscape-dagre
declare module 'cytoscape-dagre' {
  import { Ext } from 'cytoscape';
  const dagre: Ext;
  export = dagre;
}
