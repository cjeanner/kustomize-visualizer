export interface KustomizationFile {
  apiVersion?: string;
  kind?: string;
  resources?: string[];
  bases?: string[]; // Obsolète
  components?: string[];
  patches?: Array<{
    path?: string;
    patch?: string;
    target?: {
      group?: string;
      version?: string;
      kind?: string;
      name?: string;
    };
  }>;
  configMapGenerator?: Array<{
    name: string;
    files?: string[];
    literals?: string[];
  }>;
  namespace?: string;
  namePrefix?: string;
  nameSuffix?: string;
  commonLabels?: Record<string, string>;
  commonAnnotations?: Record<string, string>;
}

export interface KustomizeNode {
  id: string;
  path: string;
  type: 'base' | 'overlay' | 'component';
  kustomizationContent: KustomizationFile;
  isRemote: boolean;
  remoteUrl?: string;
  loaded: boolean;
}

export interface DependencyEdge {
  id: string;
  source: string;
  target: string;
  type: 'resource' | 'base' | 'component';
  label?: string;
}

export interface KustomizeGraph {
  nodes: Map<string, KustomizeNode>;
  edges: DependencyEdge[];
  rootPath: string;
}
