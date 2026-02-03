import type {
  KustomizeNode,
  KustomizeGraph,
  DependencyEdge
} from '../types/kustomize.types';

export class DependencyResolver {
  private edgeCounter = 0;

  buildGraph(nodes: KustomizeNode[]): KustomizeGraph {
    const nodeMap = new Map<string, KustomizeNode>();
    const edges: DependencyEdge[] = [];

    // Indexer les nœuds par chemin
    for (const node of nodes) {
      nodeMap.set(node.path, node);
    }

    console.log(`\n🔗 Construction du graphe de dépendances...`);
    console.log(`📊 ${nodes.length} nœuds à analyser`);

    // Construire les arêtes
    for (const node of nodes) {
      this.buildEdgesForNode(node, nodeMap, edges);
    }

    console.log(`✓ ${edges.length} arête(s) créée(s)`);

    return {
      nodes: nodeMap,
      edges,
      rootPath: nodes[0]?.path || ''
    };
  }

  private buildEdgesForNode(
    node: KustomizeNode,
    nodeMap: Map<string, KustomizeNode>,
    edges: DependencyEdge[]
  ): void {
    const kustomization = node.kustomizationContent;

    console.log(`\n  🔍 Analyse du nœud: ${node.path}`);

    // Traiter resources
    if (kustomization.resources && kustomization.resources.length > 0) {
      console.log(`    📦 Resources: ${kustomization.resources.length}`);
      for (const resource of kustomization.resources) {
        this.processReference(node, resource, 'resource', nodeMap, edges);
      }
    }

    // Traiter bases (obsolète mais encore utilisé)
    if (kustomization.bases && kustomization.bases.length > 0) {
      console.log(`    📦 Bases: ${kustomization.bases.length}`);
      for (const base of kustomization.bases) {
        this.processReference(node, base, 'base', nodeMap, edges);
      }
    }

    // Traiter components
    if (kustomization.components && kustomization.components.length > 0) {
      console.log(`    📦 Components: ${kustomization.components.length}`);
      for (const component of kustomization.components) {
        this.processReference(node, component, 'component', nodeMap, edges);
      }
    }
  }

  private processReference(
    sourceNode: KustomizeNode,
    reference: string,
    type: 'resource' | 'base' | 'component',
    nodeMap: Map<string, KustomizeNode>,
    edges: DependencyEdge[]
  ): void {
    console.log(`      → ${type}: ${reference}`);

    if (this.isRemoteUrl(reference)) {
      // C'est une URL distante (GitHub, etc.)
      console.log(`        ℹ️  URL distante détectée`);

      // Créer un nœud virtuel pour cette dépendance distante
      const remoteNodeId = `remote-${this.edgeCounter}`;
      const remoteDisplayName = this.extractDisplayNameFromUrl(reference);

      // Vérifier si on a déjà un nœud pour cette URL
      let targetNodeId = remoteNodeId;

      // Chercher si un nœud existe déjà avec cette URL
      for (const [, node] of nodeMap) {
        if (node.remoteUrl === reference) {
          targetNodeId = node.id;
          console.log(`        ✓ Nœud existant trouvé: ${node.path}`);
          break;
        }
      }

      // Si pas de nœud existant, en créer un virtuel
      if (targetNodeId === remoteNodeId) {
        const virtualNode: KustomizeNode = {
          id: remoteNodeId,
          path: remoteDisplayName,
          type: type === 'component' ? 'component' : 'base',
          kustomizationContent: {},
          isRemote: true,
          remoteUrl: reference,
          loaded: false
        };

        nodeMap.set(virtualNode.path, virtualNode);
        console.log(`        + Nœud virtuel créé: ${remoteDisplayName}`);
      }

      // Créer l'arête
      edges.push({
        id: `edge-${this.edgeCounter++}`,
        source: sourceNode.id,
        target: targetNodeId,
        type,
        label: this.extractLabelFromUrl(reference)
      });

      console.log(`        ✓ Arête créée`);

    } else if (this.isLocalPath(reference)) {
      // C'est un chemin local relatif
      const resolvedPath = this.resolvePath(sourceNode.path, reference);
      console.log(`        📂 Chemin local: ${reference} → ${resolvedPath}`);

      const targetNode = nodeMap.get(resolvedPath);

      if (targetNode) {
        edges.push({
          id: `edge-${this.edgeCounter++}`,
          source: sourceNode.id,
          target: targetNode.id,
          type,
          label: reference
        });
        console.log(`        ✓ Arête créée vers: ${targetNode.path}`);
      } else {
        console.log(`        ⚠️  Nœud cible non trouvé: ${resolvedPath}`);

        // Créer un nœud "manquant" pour visualiser la dépendance cassée
        const missingNodeId = `missing-${this.edgeCounter}`;
        const missingNode: KustomizeNode = {
          id: missingNodeId,
          path: resolvedPath,
          type: 'base',
          kustomizationContent: {},
          isRemote: false,
          loaded: false
        };

        nodeMap.set(missingNode.path, missingNode);

        edges.push({
          id: `edge-${this.edgeCounter++}`,
          source: sourceNode.id,
          target: missingNodeId,
          type,
          label: reference
        });

        console.log(`        + Nœud "manquant" créé`);
      }
    }
  }

  private isRemoteUrl(path: string): boolean {
    return path.startsWith('http://') || path.startsWith('https://');
  }

  private isLocalPath(path: string): boolean {
    return !this.isRemoteUrl(path);
  }

  private extractDisplayNameFromUrl(url: string): string {
    // Extraire un nom d'affichage depuis une URL GitHub
    // Ex: https://github.com/org/repo/components/argocd/annotations?ref=cleaning
    // → argocd/annotations

    try {
      // Retirer le ?ref=... si présent
      const cleanUrl = url.split('?')[0];

      // Pattern GitHub
      const match = cleanUrl.match(/github\.com\/[^\/]+\/[^\/]+\/(.+)/);
      if (match) {
        return match[1];
      }

      // Fallback: prendre la dernière partie de l'URL
      const parts = cleanUrl.split('/');
      return parts.slice(-2).join('/'); // Les 2 derniers segments
    } catch {
      return url;
    }
  }

  private extractLabelFromUrl(url: string): string {
    // Extraire un label court pour l'arête
    try {
      const parts = url.split('/');
      const lastPart = parts[parts.length - 1].split('?')[0];
      return lastPart || 'remote';
    } catch {
      return 'remote';
    }
  }

  private resolvePath(basePath: string, relativePath: string): string {
    // Normaliser les chemins
    const parts = basePath === '.' ? [] : basePath.split('/').filter(p => p !== '');
    const relParts = relativePath.split('/').filter(p => p !== '');

    for (const part of relParts) {
      if (part === '..') {
        parts.pop();
      } else if (part !== '.') {
        parts.push(part);
      }
    }

    const result = parts.join('/') || '.';
    return result;
  }

  detectCycles(graph: KustomizeGraph): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): void => {
      visited.add(nodeId);
      recStack.add(nodeId);
      path.push(nodeId);

      const outEdges = graph.edges.filter(e => e.source === nodeId);

      for (const edge of outEdges) {
        if (!visited.has(edge.target)) {
          dfs(edge.target, [...path]);
        } else if (recStack.has(edge.target)) {
          const cycleStart = path.indexOf(edge.target);
          cycles.push([...path.slice(cycleStart), edge.target]);
        }
      }

      recStack.delete(nodeId);
    };

    for (const [, node] of graph.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }

    return cycles;
  }
}
