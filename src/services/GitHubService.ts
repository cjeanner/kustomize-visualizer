interface GitHubRepoInfo {
  owner: string;
  repo: string;
  branch: string;
  path: string;
}

interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

export class GitHubService {
  private baseApiUrl = 'https://api.github.com';
  private cache = new Map<string, string>();

  /**
   * Parse une URL GitHub pour extraire owner, repo, branch et path
   * Gère correctement les branches avec des "/" dans leur nom en essayant de les valider
   */
  async parseGitHubUrl(url: string): Promise<GitHubRepoInfo> {
    // Normaliser l'URL
    const cleanUrl = url.replace(/\/$/, '');

    // Pattern: https://github.com/:owner/:repo/(tree|blob)/:branch_and_path
    const match = cleanUrl.match(
      /github\.com\/([^\/]+)\/([^\/]+)\/(tree|blob)\/(.+)/
    );

    if (!match) {
      // Pattern simple: https://github.com/:owner/:repo
      const simpleMatch = cleanUrl.match(/github\.com\/([^\/]+)\/([^\/]+)$/);
      if (simpleMatch) {
        return {
          owner: simpleMatch[1],
          repo: simpleMatch[2],
          branch: 'main', // Par défaut
          path: ''
        };
      }

      throw new Error('URL GitHub invalide. Format attendu: https://github.com/owner/repo/tree/branch/path');
    }

    const owner = match[1];
    const repo = match[2];
    const branchAndPath = match[4];

    // Essayer de déterminer la branche et le path en validant via l'API
    return await this.parseBranchAndPathWithValidation(owner, repo, branchAndPath);
  }

  /**
   * Sépare la branche du chemin en testant via l'API
   */
  private async parseBranchAndPathWithValidation(
    owner: string,
    repo: string,
    branchAndPath: string
  ): Promise<GitHubRepoInfo> {
    const parts = branchAndPath.split('/');
  
    console.log(`🔍 Parsing GitHub: owner=${owner}, repo=${repo}, branchAndPath=${branchAndPath}`);
  
    // Essayer du plus long au plus court pour la branche
    for (let i = parts.length; i > 0; i--) {
      const potentialBranch = parts.slice(0, i).join('/');
      const potentialPath = parts.slice(i).join('/');
  
      console.log(`  Test: branche="${potentialBranch}", path="${potentialPath}"`);
  
      try {
        // Tester si la branche existe
        const branchUrl = `https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(potentialBranch)}`;
        const response = await fetch(branchUrl);
  
        if (response.ok) {
          console.log(`✅ Branche GitHub trouvée: ${potentialBranch}`);
          console.log(`📁 Chemin: ${potentialPath || '(racine)'}`);
  
          return {
            owner,
            repo,
            branch: potentialBranch,
            path: potentialPath  // ← Garder le chemin complet !
          };
        } else if (response.status === 404) {
          console.log(`  ❌ Branche "${potentialBranch}" n'existe pas`);
        } else {
          console.log(`  ⚠️ Status ${response.status} pour "${potentialBranch}"`);
        }
      } catch (error) {
        console.log(`  ❌ Erreur test branche "${potentialBranch}":`, error);
      }
    }
  
    // Fallback : considérer que tout est la branche
    console.warn(`⚠️ Impossible de valider la branche, fallback sur "${branchAndPath}"`);
    return {
      owner,
      repo,
      branch: branchAndPath,
      path: ''
    };
  }


  /**
   * Récupère l'arbre complet d'un repository GitHub de manière récursive
   */
  async getRepositoryTree(repoInfo: GitHubRepoInfo): Promise<GitHubTreeItem[]> {
    console.log(`🌳 Récupération de l'arbre pour ${repoInfo.owner}/${repoInfo.repo}@${repoInfo.branch}`);

    try {
      // Étape 1: Récupérer le SHA du commit de la branche
      const branchUrl = `${this.baseApiUrl}/repos/${repoInfo.owner}/${repoInfo.repo}/git/ref/heads/${repoInfo.branch}`;

      console.log(`📡 Requête: ${branchUrl}`);

      const branchResponse = await this.fetchWithRetry(branchUrl);

      if (!branchResponse.ok) {
        throw new Error(`Branche "${repoInfo.branch}" non trouvée (HTTP ${branchResponse.status})`);
      }

      const branchData = await branchResponse.json();

      if (!branchData.object?.sha) {
        throw new Error(`Impossible de trouver le SHA de la branche ${repoInfo.branch}`);
      }

      const commitSha = branchData.object.sha;
      console.log(`✓ SHA du commit: ${commitSha}`);

      // Étape 2: Récupérer l'arbre récursif
      const treeUrl = `${this.baseApiUrl}/repos/${repoInfo.owner}/${repoInfo.repo}/git/trees/${commitSha}?recursive=1`;
      const treeResponse = await this.fetchWithRetry(treeUrl);
      const treeData: GitHubTreeResponse = await treeResponse.json();

      if (treeData.truncated) {
        console.warn('⚠️ L\'arbre est tronqué (trop de fichiers). Certains fichiers peuvent être manquants.');
      }

      console.log(`✓ ${treeData.tree.length} fichiers/dossiers trouvés`);

      // Filtrer selon le path si spécifié
      let filteredTree = treeData.tree;
      if (repoInfo.path) {
        const pathPrefix = repoInfo.path.endsWith('/') ? repoInfo.path : repoInfo.path + '/';
        filteredTree = treeData.tree.filter(item =>
          item.path === repoInfo.path || item.path.startsWith(pathPrefix)
        );
        console.log(`✓ ${filteredTree.length} fichiers dans le sous-dossier ${repoInfo.path}`);
      }

      return filteredTree;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération de l\'arbre:', error);
      throw error;
    }
  }

  /**
   * Récupère le contenu d'un fichier depuis GitHub
   */
  async getFileContent(repoInfo: GitHubRepoInfo, filePath: string): Promise<string> {
    const cacheKey = `${repoInfo.owner}/${repoInfo.repo}/${repoInfo.branch}/${filePath}`;

    // Vérifier le cache
    if (this.cache.has(cacheKey)) {
      console.log(`📦 Cache hit: ${filePath}`);
      return this.cache.get(cacheKey)!;
    }

    try {
      // Utiliser raw.githubusercontent.com pour obtenir le contenu brut
      const rawUrl = `https://raw.githubusercontent.com/${repoInfo.owner}/${repoInfo.repo}/${repoInfo.branch}/${filePath}`;
      console.log(`📥 Téléchargement: ${filePath}`);

      const response = await this.fetchWithRetry(rawUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();

      // Mettre en cache
      this.cache.set(cacheKey, content);

      return content;
    } catch (error) {
      console.error(`❌ Erreur lors du téléchargement de ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Trouve tous les fichiers kustomization.yaml dans l'arbre
   */
  findKustomizationFiles(tree: GitHubTreeItem[], basePath: string = ''): string[] {
    const kustomizationFiles: string[] = [];
  
    console.log(`🔍 Recherche kustomization.yaml (basePath: "${basePath}")`);
    console.log(`📊 ${tree.length} fichiers dans l'arbre`);
  
    for (const item of tree) {
      if (item.type === 'blob') {
        const fileName = item.path.split('/').pop() || '';
  
        if (fileName === 'kustomization.yaml' || fileName === 'kustomization.yml') {
          console.log(`  ✓ Trouvé: ${item.path}`);
  
          // Si pas de basePath, prendre tous les kustomization.yaml
          if (!basePath) {
            kustomizationFiles.push(item.path);
            continue;
          }
  
          // Si basePath spécifié, filtrer
          // Accepter : basePath/kustomization.yaml OU basePath/*/kustomization.yaml
          if (item.path === `${basePath}/kustomization.yaml` ||
              item.path === `${basePath}/kustomization.yml`) {
            kustomizationFiles.push(item.path);
            console.log(`    → Exactement dans le basePath`);
          } else if (item.path.startsWith(basePath + '/')) {
            kustomizationFiles.push(item.path);
            console.log(`    → Sous-dossier du basePath`);
          }
        }
      }
    }
  
    console.log(`✓ ${kustomizationFiles.length} fichier(s) kustomization trouvé(s)`);
    return kustomizationFiles;
  }


  /**
   * Fetch avec retry et gestion du rate limiting GitHub
   */
  private async fetchWithRetry(url: string, retries = 3): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            // Si vous avez un token GitHub, ajoutez-le ici pour augmenter les limites
            // 'Authorization': 'token YOUR_GITHUB_TOKEN'
          }
        });

        // Vérifier le rate limiting
        const remaining = response.headers.get('X-RateLimit-Remaining');
        const resetTime = response.headers.get('X-RateLimit-Reset');

        if (remaining === '0') {
          const resetDate = new Date(parseInt(resetTime || '0') * 1000);
          console.warn(`⚠️ Rate limit GitHub atteint. Réinitialisation à ${resetDate.toLocaleTimeString()}`);
        }

        if (response.status === 403 && remaining === '0') {
          throw new Error(`Rate limit GitHub dépassé. Réessayez après ${new Date(parseInt(resetTime || '0') * 1000).toLocaleTimeString()}`);
        }

        if (!response.ok && response.status >= 500) {
          throw new Error(`Erreur serveur GitHub: ${response.status}`);
        }

        return response;
      } catch (error) {
        if (i === retries - 1) throw error;

        const delay = Math.pow(2, i) * 1000; // Backoff exponentiel
        console.log(`⏳ Retry ${i + 1}/${retries} après ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Échec après plusieurs tentatives');
  }

  /**
   * Vider le cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Cache vidé');
  }
}

