export class LocalFileService {
  private isElectron(): boolean {
    return typeof window !== 'undefined' && !!window.electronAPI;
  }

  /**
   * Sélectionner et scanner un dossier (web ou Electron)
   */
  async selectAndScanDirectory(): Promise<Array<{path: string, content: string}>> {
    if (this.isElectron()) {
      return await this.scanWithElectron();
    } else {
      return await this.scanWithWebAPI();
    }
  }

  /**
   * Utiliser l'API Electron
   */
  private async scanWithElectron(): Promise<Array<{path: string, content: string}>> {
    if (!window.electronAPI) {
      throw new Error('API Electron non disponible');
    }

    const dirPath = await window.electronAPI.selectDirectory();

    if (!dirPath) {
      throw new Error('Sélection de dossier annulée');
    }

    console.log(`📁 Dossier sélectionné: ${dirPath}`);

    const results = await window.electronAPI.scanDirectory(dirPath);

    console.log(`✓ ${results.length} fichier(s) kustomization trouvé(s)`);

    return results;
  }

  /**
   * Utiliser l'API File System Access (web)
   */
  private async scanWithWebAPI(): Promise<Array<{path: string, content: string}>> {
    if (!('showDirectoryPicker' in window)) {
      throw new Error('L\'API File System Access n\'est pas supportée par ce navigateur. Veuillez utiliser Chrome, Edge, Opera, ou la version Electron.');
    }

    const dirHandle = await window.showDirectoryPicker({
      id: 'kustomize-repo',
      mode: 'read'
    });

    const results: Array<{path: string, content: string}> = [];
    await this.scanDirectoryRecursive(dirHandle, '', results);

    return results;
  }

  private async scanDirectoryRecursive(
    dirHandle: FileSystemDirectoryHandle,
    currentPath: string,
    results: Array<{path: string, content: string}>
  ): Promise<void> {
    // Chercher kustomization.yaml
    try {
      const yamlFile = await dirHandle.getFileHandle('kustomization.yaml');
      const file = await yamlFile.getFile();
      const content = await file.text();

      results.push({
        path: currentPath || '.',
        content
      });

      console.log(`✓ Trouvé: ${currentPath || '.'}/kustomization.yaml`);
    } catch {
      try {
        const ymlFile = await dirHandle.getFileHandle('kustomization.yml');
        const file = await ymlFile.getFile();
        const content = await file.text();

        results.push({
          path: currentPath || '.',
          content
        });

        console.log(`✓ Trouvé: ${currentPath || '.'}/kustomization.yml`);
      } catch {
        // Pas de kustomization
      }
    }

    // Scanner les sous-dossiers
    try {
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'directory') {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') {
            continue;
          }

          const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
          await this.scanDirectoryRecursive(
            entry as FileSystemDirectoryHandle,
            newPath,
            results
          );
        }
      }
    } catch (error) {
      console.error(`Erreur énumération ${currentPath}:`, error);
    }
  }
}
