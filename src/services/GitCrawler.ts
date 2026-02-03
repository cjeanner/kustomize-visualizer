import * as yaml from 'yaml';
import type { KustomizeNode, KustomizationFile } from '../types/kustomize.types';
import { GitService } from './GitService';
import { LocalFileService } from './LocalFileService';

export class GitCrawler {
  private nodeCounter = 0;
  private gitService = new GitService();
  private localService = new LocalFileService();

  /**
   * Scan un repository distant (GitHub ou GitLab)
   */
  async scanRemoteRepository(url: string): Promise<KustomizeNode[]> {
    return await this.gitService.scanRemoteRepository(url, this.parseKustomization.bind(this));
  }

  /**
   * Scan un dossier local
   */
  async scanLocalDirectory(): Promise<KustomizeNode[]> {
    const nodes: KustomizeNode[] = [];
    
    try {
      console.log('🚀 Démarrage du scan local...');
      
      const files = await this.localService.selectAndScanDirectory();
      
      if (files.length === 0) {
        throw new Error('Aucun fichier kustomization.yaml trouvé');
      }
      
      for (const {path, content} of files) {
        try {
          const kustomization = await this.parseKustomization(content);
          
          const node: KustomizeNode = {
            id: `node-${this.nodeCounter++}`,
            path,
            type: this.determineNodeType(path),
            kustomizationContent: kustomization,
            isRemote: false,
            loaded: true
          };
          
          nodes.push(node);
          console.log(`✅ Nœud créé: ${path}`);
        } catch (error) {
          console.error(`⚠️ Erreur parsing ${path}:`, error);
        }
      }
      
      console.log(`🎉 Scan terminé: ${nodes.length} nœud(s)`);
      
    } catch (error) {
      console.error('❌ Erreur scan local:', error);
      throw error;
    }
    
    return nodes;
  }


  async parseKustomization(content: string): Promise<KustomizationFile> {
    try {
      const parsed = yaml.parse(content) as KustomizationFile;

      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Le fichier ne contient pas un objet YAML valide');
      }

      return parsed;
    } catch (error) {
      console.error('Erreur de parsing YAML:', error);
      throw new Error('Fichier kustomization.yaml invalide');
    }
  }

  private determineNodeType(path: string): 'base' | 'overlay' | 'component' {
    const lowerPath = path.toLowerCase();

    if (lowerPath.includes('/base') || lowerPath === 'base' || lowerPath.endsWith('/bases')) {
      return 'base';
    }

    if (lowerPath.includes('/overlay') ||
        lowerPath.includes('/overlays') ||
        lowerPath.includes('/env') ||
        lowerPath.includes('/envs') ||
        lowerPath.includes('prod') ||
        lowerPath.includes('dev') ||
        lowerPath.includes('staging')) {
      return 'overlay';
    }

    if (lowerPath.includes('/component') || lowerPath.includes('/components')) {
      return 'component';
    }

    return 'base';
  }
}

