import { Project, SourceFile, Node } from 'ts-morph';
import { findPublishableNodes } from '../markers/jsdoc';

export interface ScanResult {
  /** Source file that contains at least one publishable node. */
  sourceFile: SourceFile;
  /** The publishable nodes found in this file. */
  nodes: Node[];
}

export interface ScannerOptions {
  /** Absolute path to the tsconfig.json of the project being scanned. */
  tsConfigFilePath: string;
  /** Skip declaration files (.d.ts). Defaults to true. */
  skipDeclarationFiles?: boolean;
}

/**
 * Loads a TypeScript project and returns all source files that contain
 * at least one publishable node (tagged with `@publish` in JSDoc).
 */
export function scan(options: ScannerOptions): ScanResult[] {
  const project = new Project({
    tsConfigFilePath: options.tsConfigFilePath,
    skipAddingFilesFromTsConfig: false,
    skipFileDependencyResolution: false,
  });

  const skipDecls = options.skipDeclarationFiles ?? true;
  const results: ScanResult[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    if (skipDecls && sourceFile.isDeclarationFile()) continue;

    const nodes = findPublishableNodes(sourceFile);
    if (nodes.length > 0) {
      results.push({ sourceFile, nodes });
    }
  }

  return results;
}
