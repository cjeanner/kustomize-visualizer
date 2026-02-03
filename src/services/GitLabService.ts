interface GitLabRepoInfo {
  host: string; // gitlab.com ou votre instance
  owner: string; // ou namespace
  repo: string;
  branch: string;
  path: string;
}

interface GitLabTreeItem {
  id: string;
  name: string;
  type: 'tree' | 'blob';
  path: string;
  mode: string;
}

export class GitLabService {
  private cache = new Map<string, string>();

  /**
   * Parse une URL GitLab pour extraire les composants
   * Supporte: https://gitlab.com/owner/repo/-/tree/branch/path
   * Et: https://gitlab.instance.com/group/subgroup/repo/-/tree/branch/path
   */
  async parseGitLabUrl(url: string): Promise<GitLabRepoInfo> {
    const cleanUrl = url.replace(/\/$/, '');

    // Pattern GitLab: https://HOST/NAMESPACE/PROJECT/-/tree/BRANCH/PATH
    // ou: https://HOST/NAMESPACE/PROJECT/-/blob/BRANCH/PATH
    const match = cleanUrl.match(
      /^https?:\/\/([^\/]+)\/(.+?)\/-\/(tree|blob)\/(.+)/
    );

    if (!match) {
      throw new Error('URL GitLab invalide. Format attendu: https://gitlab.com/owner/repo/-/tree/branch/path');
    }

    const host = match[1];
    const projectPath = match[2]; // peut contenir des groupes/sous-groupes
    const branchAndPath = match[4];

    // Pour GitLab, on doit tester les branches via l'API
    return await this.parseBranchAndPathWithValidation(host, projectPath, branchAndPath);
  }

  /**
   * Sépare la branche du chemin en testant via l'API
   */
  private async parseBranchAndPathWithValidation(
    host: string,
    projectPath: string,
    branchAndPath: string
  ): Promise<GitLabRepoInfo> {
    const parts = branchAndPath.split('/');

    // Le projectPath peut contenir des "/", on doit l'encoder pour l'API
    const encodedProjectPath = encodeURIComponent(projectPath);

    // Essayer du plus long au plus court
    for (let i = parts.length; i > 0; i--) {
      const branch = parts.slice(0, i).join('/');
      const path = parts.slice(i).join('/');

      console.log(`🔍 Test GitLab: branche="${branch}", path="${path}"`);

      try {
        // Tester si la branche existe
        const branchUrl = `https://${host}/api/v4/projects/${encodedProjectPath}/repository/branches/${encodeURIComponent(branch)}`;
        const response = await fetch(branchUrl);

        if (response.ok) {
          console.log(`✅ Branche GitLab trouvée: ${branch}`);

          // Extraire owner et repo du projectPath
          const pathParts = projectPath.split('/');
          const repo = pathParts.pop() || projectPath;
          const owner = pathParts.join('/') || projectPath;

          return {
            host,
            owner,
            repo,
            branch,
            path
          };
        }
      } catch (error) {
        console.log(`❌ Erreur test branche "${branch}":`, error);
      }
    }

    // Fallback
    console.warn(`⚠️ Impossible de valider la branche GitLab`);
    const pathParts = projectPath.split('/');
    const repo = pathParts.pop() || projectPath;
    const owner = pathParts.join('/') || projectPath;

    return {
      host,
      owner,
      repo,
      branch: branchAndPath,
      path: ''
    };
  }

  /**
   * Récupère l'arbre du repository via l'API GitLab
   */
  async getRepositoryTree(repoInfo: GitLabRepoInfo): Promise<GitLabTreeItem[]> {
    console.log(`🌳 Récupération de l'arbre GitLab pour ${repoInfo.owner}/${repoInfo.repo}@${repoInfo.branch}`);

    const projectPath = repoInfo.owner ? `${repoInfo.owner}/${repoInfo.repo}` : repoInfo.repo;
    const encodedProjectPath = encodeURIComponent(projectPath);

    try {
      // GitLab API pour lister l'arbre récursivement
      const treeUrl = `https://${repoInfo.host}/api/v4/projects/${encodedProjectPath}/repository/tree?ref=${encodeURIComponent(repoInfo.branch)}&recursive=true&per_page=100`;

      console.log(`📡 Requête: ${treeUrl}`);

      const response = await this.fetchWithRetry(treeUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const tree: GitLabTreeItem[] = await response.json();

      console.log(`✓ ${tree.length} fichiers/dossiers trouvés`);

      // Filtrer selon le path si spécifié
      let filteredTree = tree;
      if (repoInfo.path) {
        const pathPrefix = repoInfo.path.endsWith('/') ? repoInfo.path : repoInfo.path + '/';
        filteredTree = tree.filter(item =>
          item.path === repoInfo.path || item.path.startsWith(pathPrefix)
        );
        console.log(`✓ ${filteredTree.length} fichiers dans ${repoInfo.path}`);
      }

      return filteredTree;

    } catch (error) {
      console.error('❌ Erreur lors de la récupération de l\'arbre GitLab:', error);
      throw error;
    }
  }

  /**
   * Récupère le contenu d'un fichier depuis GitLab
   */
  async getFileContent(repoInfo: GitLabRepoInfo, filePath: string): Promise<string> {
    const cacheKey = `${repoInfo.host}/${repoInfo.owner}/${repoInfo.repo}/${repoInfo.branch}/${filePath}`;

    if (this.cache.has(cacheKey)) {
      console.log(`📦 Cache hit: ${filePath}`);
      return this.cache.get(cacheKey)!;
    }

    const projectPath = repoInfo.owner ? `${repoInfo.owner}/${repoInfo.repo}` : repoInfo.repo;
    const encodedProjectPath = encodeURIComponent(projectPath);
    const encodedFilePath = encodeURIComponent(filePath);

    try {
      // API GitLab pour récupérer le contenu raw
      const fileUrl = `https://${repoInfo.host}/api/v4/projects/${encodedProjectPath}/repository/files/${encodedFilePath}/raw?ref=${encodeURIComponent(repoInfo.branch)}`;

      console.log(`📥 Téléchargement GitLab: ${filePath}`);

      const response = await this.fetchWithRetry(fileUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();
      this.cache.set(cacheKey, content);

      return content;
    } catch (error) {
      console.error(`❌ Erreur téléchargement ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Trouve tous les fichiers kustomization.yaml
   */
  findKustomizationFiles(tree: GitLabTreeItem[], basePath: string = ''): string[] {
    const kustomizationFiles: string[] = [];

    console.log(`🔍 Recherche kustomization.yaml dans GitLab (basePath: "${basePath}")`);
    console.log(`📊 ${tree.length} fichiers dans l'arbre`);

    for (const item of tree) {
      if (item.type === 'blob') {
        const fileName = item.path.split('/').pop() || '';

        if (fileName === 'kustomization.yaml' || fileName === 'kustomization.yml') {
          console.log(`  ✓ Trouvé: ${item.path}`);

          if (!basePath) {
            kustomizationFiles.push(item.path);
            continue;
          }

          if (item.path === `${basePath}/kustomization.yaml` ||
              item.path === `${basePath}/kustomization.yml` ||
              item.path.startsWith(basePath + '/')) {
            kustomizationFiles.push(item.path);
            console.log(`    → Dans le dossier cible`);
          }
        }
      }
    }

    console.log(`✓ ${kustomizationFiles.length} fichier(s) kustomization trouvé(s)`);
    return kustomizationFiles;
  }

  private async fetchWithRetry(url: string, retries = 3): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            // Si vous avez un token GitLab:
            // 'PRIVATE-TOKEN': 'your-gitlab-token'
          }
        });

        return response;
      } catch (error) {
        if (i === retries - 1) throw error;

        const delay = Math.pow(2, i) * 1000;
        console.log(`⏳ Retry ${i + 1}/${retries} après ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Échec après plusieurs tentatives');
  }

  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Cache GitLab vidé');
  }
}

