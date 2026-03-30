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
import { hasPublishJsDoc, hasPublishDecorator } from '../markers/jsdoc.js';
import { ScanResult } from './scanner.js';

export interface ExtractedFile {
  /** Original source file path. */
  originalPath: string;
  /** Source file content to write to the output. */
  content: string;
  /** Relative file name (e.g. "user.dto.ts"). */
  fileName: string;
}

export interface ExtractionDiagnostic {
  /** Name of the type that is missing a @publish marker. */
  typeName: string;
  /** Absolute path of the file where the type should be marked. */
  filePath: string;
}

export interface ExtractionResult {
  files: ExtractedFile[];
  /** All exported names, collected for barrel generation. */
  exportedNames: string[];
  /** Types referenced by published types that are not themselves marked @publish. */
  diagnostics: ExtractionDiagnostic[];
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

    // Walk only TypeReference nodes to avoid false-positives from property names
    node.forEachDescendant((child) => {
      if (child.isKind(SyntaxKind.TypeReference)) {
        const text = child.asKindOrThrow(SyntaxKind.TypeReference).getTypeName().getText();
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
 * Checks whether a type name referenced in publishable nodes comes from a
 * relative import that is not itself marked @publish, and collects diagnostics.
 * Also returns the set of cross-file import names that ARE properly marked
 * @publish so the emitter can retain those imports in the generated output.
 */
function collectCrossFileDiagnostics(
  publishableNodes: Node[],
  sourceFile: SourceFile,
  needed: Set<string>,
): { diagnostics: ExtractionDiagnostic[]; validCrossFileImports: Set<string> } {
  const diagnostics: ExtractionDiagnostic[] = [];
  const validCrossFileImports = new Set<string>();
  const seen = new Set<string>();

  // Build a map of import name → source file for all relative imports
  const relativeImportMap = new Map<string, SourceFile>();
  for (const imp of sourceFile
    .getStatements()
    .filter((s): s is ImportDeclaration => s.isKind(SyntaxKind.ImportDeclaration))) {
    const specifier = imp.getModuleSpecifierValue();
    if (!specifier.startsWith('.')) continue; // skip package imports
    const resolved = imp.getModuleSpecifierSourceFile();
    if (!resolved) continue;
    for (const named of imp.getNamedImports()) {
      relativeImportMap.set(named.getName(), resolved);
    }
  }

  for (const node of publishableNodes) {
    node.forEachDescendant((child) => {
      if (!child.isKind(SyntaxKind.TypeReference)) return;
      const typeName = child.asKindOrThrow(SyntaxKind.TypeReference).getTypeName().getText();

      // Already resolved locally or already processed
      if (needed.has(typeName) || seen.has(typeName)) return;
      seen.add(typeName);

      const resolvedFile = relativeImportMap.get(typeName);
      if (!resolvedFile) return; // not a relative import → skip

      // Check if the declaration in the resolved file is marked @publish
      const decl = resolvedFile
        .getStatements()
        .find(
          (s): s is PublishableDeclaration =>
            isPublishableDeclaration(s) && getDeclarationName(s) === typeName,
        );

      if (!decl) return;

      if (hasPublishJsDoc(decl) || hasPublishDecorator(decl)) {
        validCrossFileImports.add(typeName);
      } else {
        diagnostics.push({ typeName, filePath: resolvedFile.getFilePath() });
      }
    });
  }

  return { diagnostics, validCrossFileImports };
}

/**
 * Produces an ambient class declaration suitable for a .d.ts file:
 * property initializers and method bodies are stripped; only type
 * signatures are kept.
 */
function toAmbientClassText(decl: ClassDeclaration): string {
  const name = decl.getName() ?? '';

  const typeParams = decl.getTypeParameters();
  const typeParamsStr = typeParams.length > 0
    ? `<${typeParams.map((p) => p.getText()).join(', ')}>`
    : '';

  const heritageClauses = decl.getHeritageClauses();
  const heritageStr = heritageClauses.length > 0
    ? ` ${heritageClauses.map((h) => h.getText()).join(' ')}`
    : '';

  const members: string[] = [];

  for (const ctor of decl.getConstructors()) {
    const params = ctor.getParameters().map((p) => p.getText()).join(', ');
    members.push(`  constructor(${params});`);
  }

  for (const prop of decl.getProperties()) {
    const modifiers = prop.getModifiers()
      .map((m) => m.getText())
      .filter((m) => m !== 'declare')
      .join(' ');
    const modStr = modifiers ? `${modifiers} ` : '';
    const optional = prop.hasQuestionToken() ? '?' : '';
    const typeNode = prop.getTypeNode();
    const typeStr = typeNode ? `: ${typeNode.getText()}` : '';
    members.push(`  ${modStr}${prop.getName()}${optional}${typeStr};`);
  }

  for (const method of decl.getMethods()) {
    const modifiers = method.getModifiers().map((m) => m.getText()).join(' ');
    const modStr = modifiers ? `${modifiers} ` : '';
    const methodTypeParams = method.getTypeParameters();
    const methodTypeParamsStr = methodTypeParams.length > 0
      ? `<${methodTypeParams.map((p) => p.getText()).join(', ')}>`
      : '';
    const params = method.getParameters().map((p) => p.getText()).join(', ');
    const returnTypeNode = method.getReturnTypeNode();
    const returnStr = returnTypeNode ? `: ${returnTypeNode.getText()}` : '';
    members.push(`  ${modStr}${method.getName()}${methodTypeParamsStr}(${params})${returnStr};`);
  }

  const body = members.length > 0 ? `\n${members.join('\n')}\n` : '';
  return `export declare class ${name}${typeParamsStr}${heritageStr} {${body}}`;
}

/**
 * Extracts publishable declarations from scan results into standalone
 * .d.ts declaration files ready to be written to the output directory.
 */
export function extract(scanResults: ScanResult[]): ExtractionResult {
  const extractedFiles: ExtractedFile[] = [];
  const allExportedNames: string[] = [];
  const allDiagnostics: ExtractionDiagnostic[] = [];

  for (const { sourceFile, nodes } of scanResults) {
    const needed = collectLocalDependencies(nodes, sourceFile);
    const { diagnostics, validCrossFileImports } = collectCrossFileDiagnostics(nodes, sourceFile, needed);
    allDiagnostics.push(...diagnostics);

    const lines: string[] = [
      '// This file was auto-generated by typeship. Do not edit manually.',
      '',
    ];

    // Re-emit only the necessary imports from the original file
    const importDecls = sourceFile
      .getStatements()
      .filter((s): s is ImportDeclaration => s.isKind(SyntaxKind.ImportDeclaration));

    for (const imp of importDecls) {
      const namedImports = imp.getNamedImports().map((n) => n.getName());
      const usedImports = namedImports.filter((n) => needed.has(n) || validCrossFileImports.has(n));
      if (usedImports.length > 0 || imp.getDefaultImport()) {
        // Rewrite the import specifier to reference the .js path (d.ts convention)
        const specifier = imp.getModuleSpecifierValue().replace(/\.js$/, '');
        const names = usedImports.join(', ');
        lines.push(`import type { ${names} } from '${specifier}.js';`);
      }
    }

    if (lines.length > 2) lines.push('');

    // Emit the needed declarations
    for (const stmt of sourceFile.getStatements()) {
      if (!isPublishableDeclaration(stmt)) continue;
      const name = getDeclarationName(stmt);
      if (!name || !needed.has(name)) continue;

      let text: string;
      if (stmt.isKind(SyntaxKind.ClassDeclaration)) {
        text = toAmbientClassText(stmt);
      } else {
        text = stmt.getText();
        if (!text.startsWith('export')) {
          text = `export ${text}`;
        }
      }
      lines.push(text);
      lines.push('');
      allExportedNames.push(name);
    }

    const fileName = sourceFile.getBaseName().replace(/\.ts$/, '.d.ts');
    extractedFiles.push({
      originalPath: sourceFile.getFilePath(),
      content: lines.join('\n').trimEnd() + '\n',
      fileName,
    });
  }

  return { files: extractedFiles, exportedNames: allExportedNames, diagnostics: allDiagnostics };
}
