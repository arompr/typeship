import {
  Node,
  SourceFile,
  SyntaxKind,
  TypeAliasDeclaration,
  InterfaceDeclaration,
  ClassDeclaration,
  EnumDeclaration,
  ImportDeclaration,
} from 'ts-morph';
import { ScanResult } from './scanner.js';

export interface ExtractedFile {
  /** Original source file path. */
  originalPath: string;
  /** Source file content to write to the output. */
  content: string;
  /** Relative file name (e.g. "user.dto.ts"). */
  fileName: string;
}

export interface ExtractionResult {
  files: ExtractedFile[];
  /** All exported names, collected for barrel generation. */
  exportedNames: string[];
}

type PublishableDeclaration =
  | TypeAliasDeclaration
  | InterfaceDeclaration
  | ClassDeclaration
  | EnumDeclaration;

function isPublishableDeclaration(node: Node): node is PublishableDeclaration {
  return (
    node.isKind(SyntaxKind.TypeAliasDeclaration) ||
    node.isKind(SyntaxKind.InterfaceDeclaration) ||
    node.isKind(SyntaxKind.ClassDeclaration) ||
    node.isKind(SyntaxKind.EnumDeclaration)
  );
}

/** Returns the name of a publishable declaration node. */
function getDeclarationName(node: PublishableDeclaration): string | undefined {
  return node.getName();
}

/**
 * Collects all named exports that are referenced (directly or transitively)
 * by the publishable nodes, within the same source file.
 */
function collectLocalDependencies(
  publishableNodes: Node[],
  sourceFile: SourceFile,
): Set<string> {
  const needed = new Set<string>();

  function collectFromNode(node: Node): void {
    if (!isPublishableDeclaration(node)) return;
    const name = getDeclarationName(node);
    if (name) needed.add(name);

    // Walk the type references inside this node to find local deps
    node.forEachDescendant((child) => {
      if (child.isKind(SyntaxKind.Identifier)) {
        const text = child.getText();
        const localDecl = sourceFile
          .getStatements()
          .find(
            (s): s is PublishableDeclaration =>
              isPublishableDeclaration(s) &&
              getDeclarationName(s) === text,
          );
        if (localDecl && !needed.has(text)) {
          needed.add(text);
          collectFromNode(localDecl);
        }
      }
    });
  }

  for (const node of publishableNodes) {
    collectFromNode(node);
  }

  return needed;
}

/**
 * Extracts publishable declarations from scan results into standalone
 * TypeScript source files ready to be written to the output directory.
 */
export function extract(scanResults: ScanResult[]): ExtractionResult {
  const extractedFiles: ExtractedFile[] = [];
  const allExportedNames: string[] = [];

  for (const { sourceFile, nodes } of scanResults) {
    const needed = collectLocalDependencies(nodes, sourceFile);
    const lines: string[] = [];

    // Re-emit only the necessary imports from the original file
    const importDecls = sourceFile
      .getStatements()
      .filter((s): s is ImportDeclaration => s.isKind(SyntaxKind.ImportDeclaration));

    for (const imp of importDecls) {
      const namedImports = imp.getNamedImports().map((n) => n.getName());
      const usedImports = namedImports.filter((n) => needed.has(n));
      if (usedImports.length > 0 || imp.getDefaultImport()) {
        lines.push(imp.getText());
      }
    }

    if (lines.length > 0) lines.push('');

    // Emit the needed declarations (with export keyword)
    for (const stmt of sourceFile.getStatements()) {
      if (!isPublishableDeclaration(stmt)) continue;
      const name = getDeclarationName(stmt);
      if (!name || !needed.has(name)) continue;

      let text = stmt.getText();
      // Ensure the declaration is exported
      if (!text.startsWith('export')) {
        text = `export ${text}`;
      }
      lines.push(text);
      lines.push('');
      allExportedNames.push(name);
    }

    const fileName = sourceFile.getBaseName();
    extractedFiles.push({
      originalPath: sourceFile.getFilePath(),
      content: lines.join('\n').trimEnd() + '\n',
      fileName,
    });
  }

  return { files: extractedFiles, exportedNames: allExportedNames };
}
