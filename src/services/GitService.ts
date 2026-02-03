import { GitHubService } from './GitHubService';
import { GitLabService } from './GitLabService';
import type { KustomizeNode, KustomizationFile } from '../types/kustomize.types';

type GitProvider = 'github' | 'gitlab' | 'local';

interface RepoInfo {
  provider: GitProvider;
  data: any; // GitHubRepoInfo ou GitLabRepoInfo
}

export class GitService {
  private githubService = new GitHubService();
  private gitlabService = new GitLabService();
  private nodeCounter = 0;

  /**
   * Détecte le provider depuis l'URL
   */
  detectProvider(url: string): GitProvider {
    if (url.includes('github.com')) {
      return 'github';
    }
    if (url.includes('gitlab.com') || url.includes('/-/tree/') || url.includes('/-/blob/')) {
      return 'gitlab';
    }
    return 'local';
  }

  /**
   * Parse l'URL selon le provider
   */
  async parseUrl(url: string): Promise<RepoInfo> {
    const provider = this.detectProvider(url);
    
    console.log(`🔍 Provider détecté: ${provider}`);
    
    switch (provider) {
      case 'github':
        return {
          provider: 'github',
          data: await this.githubService.parseGitHubUrl(url)
        };
      
      case 'gitlab':
        return {
          provider: 'gitlab',
          data: await this.gitlabService.parseGitLabUrl(url)
        };
      
      default:
        throw new Error('Provider non supporté');
    }
  }

  /**
   * Scan un repository distant (GitHub ou GitLab)
   */
  async scanRemoteRepository(url: string, parseKustomization: (content: string) => Promise<KustomizationFile>): Promise<KustomizeNode[]> {
    const nodes: KustomizeNode[] = [];
  
    try {
      console.log('🚀 Démarrage du scan distant...');
      console.log(`📍 URL: ${url}`);
  
      const repoInfo = await this.parseUrl(url);
  
      console.log('📦 Informations du repo:', repoInfo);
  
      let tree: any[];
      let kustomizationPaths: string[];
  
      if (repoInfo.provider === 'github') {
        tree = await this.githubService.getRepositoryTree(repoInfo.data);
        kustomizationPaths = this.githubService.findKustomizationFiles(tree, repoInfo.data.path);
      } else if (repoInfo.provider === 'gitlab') {
        tree = await this.gitlabService.getRepositoryTree(repoInfo.data);
        kustomizationPaths = this.gitlabService.findKustomizationFiles(tree, repoInfo.data.path);
      } else {
        throw new Error('Provider non supporté');
      }
  
      if (kustomizationPaths.length === 0) {
        throw new Error(`Aucun fichier kustomization.yaml trouvé dans ${repoInfo.data.path || 'la racine'}`);
      }
  
      console.log(`📄 ${kustomizationPaths.length} fichiers à traiter:`, kustomizationPaths);
  
      // Charger chaque fichier
      for (const kustPath of kustomizationPaths) {
        try {
          console.log(`\n📄 Traitement: ${kustPath}`);
  
          // Le chemin complet du fichier dans le repo
          const fullPath = kustPath;
  
          // Le chemin du dossier (sans le nom du fichier)
          const dirPath = fullPath.replace(/\/kustomization\.ya?ml$/, '');
  
          console.log(`  📁 Dossier: ${dirPath}`);
          console.log(`  🏷️  basePath du repo: ${repoInfo.data.path}`);
  
          // Calculer le chemin d'affichage relatif au basePath
          let displayPath = dirPath;
          if (repoInfo.data.path) {
            if (dirPath === repoInfo.data.path) {
              displayPath = '.';
            } else if (dirPath.startsWith(repoInfo.data.path + '/')) {
              displayPath = dirPath.substring(repoInfo.data.path.length + 1);
            }
          }
  
          if (displayPath === '') displayPath = '.';
  
          console.log(`  🏷️  Affichage: ${displayPath}`);
  
          // Télécharger le contenu avec le chemin COMPLET
          let content: string;
          if (repoInfo.provider === 'github') {
            content = await this.githubService.getFileContent(repoInfo.data, fullPath);
          } else {
            content = await this.gitlabService.getFileContent(repoInfo.data, fullPath);
          }
  
          // Parser
          const kustomization = await parseKustomization(content);
  
          // Créer le nœud
          const node: KustomizeNode = {
            id: `node-${this.nodeCounter++}`,
            path: displayPath,
            type: this.determineNodeType(displayPath),
            kustomizationContent: kustomization,
            isRemote: true,
            remoteUrl: url,
            loaded: true
          };
  
          nodes.push(node);
          console.log(`✅ Nœud créé: ${displayPath}`);
  
        } catch (error) {
          console.error(`⚠️ Erreur traitement ${kustPath}:`, error);
        }
      }
  
      console.log(`\n🎉 Scan terminé: ${nodes.length} nœud(s)`);
  
    } catch (error) {
      console.error('❌ Erreur scan distant:', error);
      throw error;
    }
  
    return nodes;
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
