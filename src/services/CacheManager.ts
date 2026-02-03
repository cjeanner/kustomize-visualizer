import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { KustomizeGraph } from '../types/kustomize.types';

interface KustomizeDB extends DBSchema {
  graphs: {
    key: string;
    value: {
      path: string;
      graph: string; // JSON stringifié
      timestamp: number;
    };
  };
  remoteResources: {
    key: string;
    value: {
      url: string;
      content: string;
      timestamp: number;
    };
  };
}

export class CacheManager {
  private db: IDBPDatabase<KustomizeDB> | null = null;

  async init(): Promise<void> {
    this.db = await openDB<KustomizeDB>('kustomize-visualizer', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('graphs')) {
          db.createObjectStore('graphs', { keyPath: 'path' });
        }
        if (!db.objectStoreNames.contains('remoteResources')) {
          db.createObjectStore('remoteResources', { keyPath: 'url' });
        }
      },
    });
  }

  async cacheGraph(repoPath: string, graph: KustomizeGraph): Promise<void> {
    if (!this.db) await this.init();
    
    // Convertir Map en Array pour la sérialisation
    const serializedGraph = {
      nodes: Array.from(graph.nodes.entries()),
      edges: graph.edges,
      rootPath: graph.rootPath
    };

    await this.db!.put('graphs', {
      path: repoPath,
      graph: JSON.stringify(serializedGraph),
      timestamp: Date.now()
    });
  }

  async getCachedGraph(repoPath: string): Promise<KustomizeGraph | null> {
    if (!this.db) await this.init();
    
    const cached = await this.db!.get('graphs', repoPath);
    if (!cached) return null;

    // Vérifier si le cache est trop vieux (24h)
    const age = Date.now() - cached.timestamp;
    if (age > 24 * 60 * 60 * 1000) {
      return null;
    }

    const parsed = JSON.parse(cached.graph);
    return {
      nodes: new Map(parsed.nodes),
      edges: parsed.edges,
      rootPath: parsed.rootPath
    };
  }

  async cacheRemoteResource(url: string, content: string): Promise<void> {
    if (!this.db) await this.init();
    
    await this.db!.put('remoteResources', {
      url,
      content,
      timestamp: Date.now()
    });
  }

  async getCachedRemoteResource(url: string): Promise<string | null> {
    if (!this.db) await this.init();
    
    const cached = await this.db!.get('remoteResources', url);
    if (!cached) return null;

    // Cache valide 1 heure
    const age = Date.now() - cached.timestamp;
    if (age > 60 * 60 * 1000) {
      return null;
    }

    return cached.content;
  }

  async clearCache(): Promise<void> {
    if (!this.db) await this.init();
    
    await this.db!.clear('graphs');
    await this.db!.clear('remoteResources');
  }
}

