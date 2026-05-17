import * as fs from 'fs';
import * as path from 'path';
import { FileParser } from '../utils/parser';
import { logger } from '../utils/logger';
import {
  DependencyMap,
  DependencyNode,
  DependencyRelation,
  ComponentInfo,
  RepositoryInfo,
  IssueInfo,
} from '../types';

export class DependencyMapper {
  private repoInfo: RepositoryInfo;
  private dependencyMap: Map<string, DependencyNode>;

  constructor(repoInfo: RepositoryInfo) {
    this.repoInfo = repoInfo;
    this.dependencyMap = new Map();
  }

  /**
   * Build a complete dependency map for the repository
   */
  async buildDependencyMap(): Promise<DependencyMap> {
    logger.progress('Building dependency map');

    // Initialize nodes from key components
    for (const component of this.repoInfo.structure.keyComponents) {
      this.addNode(component);
    }

    // Build relationships
    for (const component of this.repoInfo.structure.keyComponents) {
      this.buildRelationships(component);
    }

    // Calculate metrics
    const nodes = Array.from(this.dependencyMap.values());
    const relations = this.extractRelations();

    logger.success('Dependency map built successfully');

    return {
      nodes,
      relations,
      metrics: this.calculateMetrics(nodes, relations),
    };
  }

  /**
   * Add a node to the dependency map
   */
  private addNode(component: ComponentInfo): void {
    const node: DependencyNode = {
      id: component.path,
      path: component.path,
      type: component.type,
      dependencies: component.dependencies,
      dependents: [],
      exports: component.exports,
      complexity: this.calculateNodeComplexity(component),
      changeImpact: 'low',
    };

    this.dependencyMap.set(component.path, node);
  }

  /**
   * Build relationships between nodes
   */
  private buildRelationships(component: ComponentInfo): void {
    const node = this.dependencyMap.get(component.path);
    if (!node) return;

    // Find dependents (files that import this component)
    for (const [otherPath, otherNode] of this.dependencyMap.entries()) {
      if (otherPath === component.path) continue;

      // Check if other component imports this one
      const imports = otherNode.dependencies;
      const isDependent = imports.some(imp => 
        this.resolvesTo(imp, component.path)
      );

      if (isDependent) {
        node.dependents.push(otherPath);
      }
    }

    // Calculate change impact based on dependents
    node.changeImpact = this.calculateChangeImpact(node);
  }

  /**
   * Check if an import path resolves to a target file
   */
  private resolvesTo(importPath: string, targetPath: string): boolean {
    // Remove file extension from target
    const targetWithoutExt = targetPath.replace(/\.(ts|tsx|js|jsx)$/, '');
    
    // Handle relative imports
    if (importPath.startsWith('.')) {
      return importPath.includes(path.basename(targetWithoutExt));
    }

    // Handle absolute imports
    return importPath.includes(targetWithoutExt) || 
           targetPath.includes(importPath);
  }

  /**
   * Calculate node complexity
   */
  private calculateNodeComplexity(component: ComponentInfo): number {
    let complexity = 1;

    // More dependencies = higher complexity
    complexity += component.dependencies.length * 0.5;

    // More exports = higher complexity
    complexity += component.exports.length * 0.3;

    // Certain file types are inherently more complex
    if (component.type === 'service' || component.type === 'api') {
      complexity += 2;
    } else if (component.type === 'component') {
      complexity += 1;
    }

    return Math.round(complexity * 10) / 10;
  }

  /**
   * Calculate change impact
   */
  private calculateChangeImpact(node: DependencyNode): 'low' | 'medium' | 'high' | 'critical' {
    const dependentCount = node.dependents.length;

    if (dependentCount === 0) return 'low';
    if (dependentCount <= 2) return 'medium';
    if (dependentCount <= 5) return 'high';
    return 'critical';
  }

  /**
   * Extract all relations from the dependency map
   */
  private extractRelations(): DependencyRelation[] {
    const relations: DependencyRelation[] = [];

    for (const [sourcePath, node] of this.dependencyMap.entries()) {
      for (const dep of node.dependencies) {
        // Find the target node
        const targetNode = Array.from(this.dependencyMap.values()).find(n =>
          this.resolvesTo(dep, n.path)
        );

        if (targetNode) {
          relations.push({
            from: sourcePath,
            to: targetNode.path,
            type: 'imports',
            strength: this.calculateRelationStrength(node, targetNode),
          });
        }
      }
    }

    return relations;
  }

  /**
   * Calculate relation strength
   */
  private calculateRelationStrength(
    source: DependencyNode,
    target: DependencyNode
  ): 'weak' | 'moderate' | 'strong' {
    // Count how many times source imports from target
    const importCount = source.dependencies.filter(dep =>
      this.resolvesTo(dep, target.path)
    ).length;

    if (importCount >= 3) return 'strong';
    if (importCount >= 2) return 'moderate';
    return 'weak';
  }

  /**
   * Calculate overall metrics
   */
  private calculateMetrics(
    nodes: DependencyNode[],
    relations: DependencyRelation[]
  ): {
    totalNodes: number;
    totalRelations: number;
    averageComplexity: number;
    highImpactNodes: number;
    circularDependencies: number;
  } {
    const totalNodes = nodes.length;
    const totalRelations = relations.length;
    const averageComplexity =
      nodes.reduce((sum, n) => sum + n.complexity, 0) / totalNodes || 0;
    const highImpactNodes = nodes.filter(
      n => n.changeImpact === 'high' || n.changeImpact === 'critical'
    ).length;
    const circularDependencies = this.detectCircularDependencies(nodes, relations);

    return {
      totalNodes,
      totalRelations,
      averageComplexity: Math.round(averageComplexity * 10) / 10,
      highImpactNodes,
      circularDependencies,
    };
  }

  /**
   * Detect circular dependencies
   */
  private detectCircularDependencies(
    nodes: DependencyNode[],
    relations: DependencyRelation[]
  ): number {
    let circularCount = 0;
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const outgoingRelations = relations.filter(r => r.from === nodeId);

      for (const relation of outgoingRelations) {
        if (!visited.has(relation.to)) {
          if (hasCycle(relation.to)) {
            return true;
          }
        } else if (recursionStack.has(relation.to)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        if (hasCycle(node.id)) {
          circularCount++;
        }
      }
    }

    return circularCount;
  }

  /**
   * Find files affected by changes to a specific file
   */
  findAffectedFiles(filePath: string): string[] {
    const node = this.dependencyMap.get(filePath);
    if (!node) return [];

    const affected = new Set<string>();
    const queue = [filePath];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const currentNode = this.dependencyMap.get(current);
      if (!currentNode) continue;

      for (const dependent of currentNode.dependents) {
        affected.add(dependent);
        queue.push(dependent);
      }
    }

    return Array.from(affected);
  }

  /**
   * Find all dependencies of a file (recursive)
   */
  findAllDependencies(filePath: string): string[] {
    const node = this.dependencyMap.get(filePath);
    if (!node) return [];

    const dependencies = new Set<string>();
    const queue = [filePath];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const currentNode = this.dependencyMap.get(current);
      if (!currentNode) continue;

      for (const dep of currentNode.dependencies) {
        // Find the actual node for this dependency
        const depNode = Array.from(this.dependencyMap.values()).find(n =>
          this.resolvesTo(dep, n.path)
        );

        if (depNode) {
          dependencies.add(depNode.path);
          queue.push(depNode.path);
        }
      }
    }

    return Array.from(dependencies);
  }

  /**
   * Map dependencies for an issue
   */
  mapIssueDependencies(issue: IssueInfo): {
    directlyAffected: string[];
    indirectlyAffected: string[];
    requiredChanges: string[];
    testFiles: string[];
  } {
    logger.progress('Mapping issue dependencies');

    const directlyAffected = issue.affectedComponents;
    const indirectlyAffected = new Set<string>();
    const requiredChanges = new Set<string>();
    const testFiles = new Set<string>();

    // Find all files affected by changes to directly affected components
    for (const component of directlyAffected) {
      const affected = this.findAffectedFiles(component);
      affected.forEach(f => indirectlyAffected.add(f));

      // Find dependencies that might need changes
      const deps = this.findAllDependencies(component);
      deps.forEach(d => {
        const node = this.dependencyMap.get(d);
        if (node && node.type === 'utility') {
          requiredChanges.add(d);
        }
      });

      // Find test files
      const testFile = component.replace(/\.(ts|tsx|js|jsx)$/, '.test.$1');
      if (fs.existsSync(path.join(this.repoInfo.path, testFile))) {
        testFiles.add(testFile);
      }

      const specFile = component.replace(/\.(ts|tsx|js|jsx)$/, '.spec.$1');
      if (fs.existsSync(path.join(this.repoInfo.path, specFile))) {
        testFiles.add(specFile);
      }
    }

    logger.success('Issue dependencies mapped');

    return {
      directlyAffected,
      indirectlyAffected: Array.from(indirectlyAffected),
      requiredChanges: Array.from(requiredChanges),
      testFiles: Array.from(testFiles),
    };
  }

  /**
   * Suggest implementation order based on dependencies
   */
  suggestImplementationOrder(files: string[]): string[] {
    const ordered: string[] = [];
    const remaining = new Set(files);
    const processed = new Set<string>();

    while (remaining.size > 0) {
      let addedInThisRound = false;

      for (const file of remaining) {
        const node = this.dependencyMap.get(file);
        if (!node) {
          ordered.push(file);
          remaining.delete(file);
          addedInThisRound = true;
          continue;
        }

        // Check if all dependencies are already processed
        const deps = this.findAllDependencies(file);
        const unprocessedDeps = deps.filter(d => 
          remaining.has(d) && !processed.has(d)
        );

        if (unprocessedDeps.length === 0) {
          ordered.push(file);
          remaining.delete(file);
          processed.add(file);
          addedInThisRound = true;
        }
      }

      // Prevent infinite loop in case of circular dependencies
      if (!addedInThisRound && remaining.size > 0) {
        const next = Array.from(remaining)[0];
        ordered.push(next);
        remaining.delete(next);
        processed.add(next);
      }
    }

    return ordered;
  }

  /**
   * Generate dependency graph visualization (DOT format)
   */
  generateDotGraph(files?: string[]): string {
    const nodes = files
      ? Array.from(this.dependencyMap.values()).filter(n => files.includes(n.path))
      : Array.from(this.dependencyMap.values());

    const lines: string[] = [];
    lines.push('digraph Dependencies {');
    lines.push('  rankdir=LR;');
    lines.push('  node [shape=box, style=rounded];');
    lines.push('');

    // Add nodes
    for (const node of nodes) {
      const color = this.getNodeColor(node.changeImpact);
      const label = path.basename(node.path);
      lines.push(`  "${node.id}" [label="${label}", fillcolor="${color}", style="filled,rounded"];`);
    }

    lines.push('');

    // Add edges
    for (const node of nodes) {
      for (const dep of node.dependencies) {
        const targetNode = nodes.find(n => this.resolvesTo(dep, n.path));
        if (targetNode) {
          lines.push(`  "${node.id}" -> "${targetNode.id}";`);
        }
      }
    }

    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Get node color based on change impact
   */
  private getNodeColor(impact: string): string {
    switch (impact) {
      case 'critical': return '#ff6b6b';
      case 'high': return '#ffa500';
      case 'medium': return '#ffd93d';
      case 'low': return '#6bcf7f';
      default: return '#e0e0e0';
    }
  }

  /**
   * Generate dependency report
   */
  generateReport(dependencyMap: DependencyMap): string {
    const lines: string[] = [];

    lines.push('# Dependency Analysis Report');
    lines.push('');
    lines.push('## Overview');
    lines.push(`- Total Components: ${dependencyMap.metrics.totalNodes}`);
    lines.push(`- Total Dependencies: ${dependencyMap.metrics.totalRelations}`);
    lines.push(`- Average Complexity: ${dependencyMap.metrics.averageComplexity}`);
    lines.push(`- High Impact Components: ${dependencyMap.metrics.highImpactNodes}`);
    lines.push(`- Circular Dependencies: ${dependencyMap.metrics.circularDependencies}`);
    lines.push('');

    // Critical components
    const criticalNodes = dependencyMap.nodes.filter(n => n.changeImpact === 'critical');
    if (criticalNodes.length > 0) {
      lines.push('## Critical Components (High Change Impact)');
      for (const node of criticalNodes) {
        lines.push(`- **${node.path}**`);
        lines.push(`  - Dependents: ${node.dependents.length}`);
        lines.push(`  - Complexity: ${node.complexity}`);
      }
      lines.push('');
    }

    // Most complex components
    const complexNodes = [...dependencyMap.nodes]
      .sort((a, b) => b.complexity - a.complexity)
      .slice(0, 5);

    lines.push('## Most Complex Components');
    for (const node of complexNodes) {
      lines.push(`- **${node.path}** (Complexity: ${node.complexity})`);
      lines.push(`  - Dependencies: ${node.dependencies.length}`);
      lines.push(`  - Dependents: ${node.dependents.length}`);
    }
    lines.push('');

    // Isolated components
    const isolatedNodes = dependencyMap.nodes.filter(
      n => n.dependencies.length === 0 && n.dependents.length === 0
    );

    if (isolatedNodes.length > 0) {
      lines.push('## Isolated Components');
      for (const node of isolatedNodes) {
        lines.push(`- ${node.path}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
