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

/** Reported when two or more published types share the same name across different source files. */
export interface CollisionDiagnostic {
  /** The duplicated type name. */
  typeName: string;
  /** Absolute paths of every source file that publishes this name. */
  filePaths: string[];
}

export interface ExtractionResult {
  files: ExtractedFile[];
  /** All exported names, collected for barrel generation. */
  exportedNames: string[];
  /** Types referenced by published types that are not themselves marked @publish. Fatal — generation will be blocked. */
  diagnostics: ExtractionDiagnostic[];
  /** Non-fatal warnings, e.g. declarations that could not be converted to the requested kind and fell back to preserve. */
  warnings: ExtractionDiagnostic[];
  /** Published type names that appear in more than one source file. Causes duplicate declarations when files are merged. */
  collisions: CollisionDiagnostic[];
}

/** Options passed to {@link extract}. */
export interface ExtractOptions {
  /**
   * Controls what TypeScript construct kind each declaration is emitted as.
   * Defaults to `"preserve"`. Enums are always preserved regardless of this setting.
   */
  declarationMapping?: 'preserve' | 'type' | 'interface' | 'class';
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
 * Returns the leftmost identifier text of an entity name node.
 * For a simple name like `Foo` it returns `"Foo"`.
 * For a qualified name like `Foo.Bar` or `Foo.Bar.Baz` it returns `"Foo"`.
 */
function rootTypeName(typeName: Node): string {
  let node = typeName;
  while (node.isKind(SyntaxKind.QualifiedName)) {
    node = node.asKindOrThrow(SyntaxKind.QualifiedName).getLeft();
  }
  return node.getText();
}

/**
 * Strips inline `import('/abs/path/to/module').` prefixes from a type string.
 * These are emitted by TypeScript's type printer when it resolves a cross-module
 * type without a corresponding top-level import in scope (e.g. for class
 * properties that have no explicit type annotation).
 */
function stripInlineImports(text: string): string {
  return text.replace(/import\(['"][^'"]*['"]\)\./g, '');
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
        // For qualified names like Enum.MEMBER, match only the root identifier
        const text = rootTypeName(child.asKindOrThrow(SyntaxKind.TypeReference).getTypeName());
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
      // For qualified names like Enum.MEMBER, check only the root identifier
      const typeName = rootTypeName(child.asKindOrThrow(SyntaxKind.TypeReference).getTypeName());

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
 * Returns the JSDoc comment blocks attached to `node`, with each block prefixed
 * by `indent` and the whole result ending with a newline.
 * Returns an empty string when no JSDoc is present.
 */
function jsDocText(node: Node, indent = ''): string {
  const jsDocs = (node as any).getJsDocs?.() as Array<{ getText(): string }> | undefined;
  if (!jsDocs || jsDocs.length === 0) return '';
  return jsDocs.map((doc) => `${indent}${cleanPublishTag(doc.getText())}`).join('\n') + '\n';
}

/** Tag names that mark a declaration for publication – stripped from the generated output. */
const PUBLISH_TAG_NAMES = new Set(['publish', 'typeship']);

/**
 * Strips @publish / @typeship tags from a JSDoc block and replaces them with
 * @published so consumers know the type was intentionally exported by typeship.
 * Blocks with no publish tag are returned unchanged.
 */
function cleanPublishTag(text: string): string {
  if (!/@(publish|typeship)\b/i.test(text)) return text;

  const lines = text.split('\n');

  if (lines.length === 1) {
    // Single-line block: /** @publish */ → /** @published */
    const stripped = text.replace(/@(?:publish|typeship)\b\s*/gi, '').trimEnd();
    return stripped.replace(/\s*\*\/$/, ' @published */');
  }

  const result: string[] = [];
  for (const line of lines) {
    const inner = line.trimStart().replace(/^\*\s*/, '');
    const tag = inner.match(/^@(\w+)/)?.[1]?.toLowerCase();
    if (tag && PUBLISH_TAG_NAMES.has(tag)) continue;

    if (line.trim() === '*/') {
      const lineIndent = line.match(/^(\s*)/)?.[1] ?? '';
      result.push(`${lineIndent} * @published`);
    }
    result.push(line);
  }
  return result.join('\n');
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

  // Promote constructor parameter properties to class properties; constructors are not emitted.
  for (const ctor of decl.getConstructors()) {
    for (const param of ctor.getParameters()) {
      if (!param.isParameterProperty()) continue;
      const modifiers = param.getModifiers()
        .filter((m) => !m.isKind(SyntaxKind.Decorator))
        .map((m) => m.getText())
        .filter((m) => m !== 'declare')
        .join(' ');
      const modStr = modifiers ? `${modifiers} ` : '';
      const optional = param.hasQuestionToken() ? '?' : '';
      const typeNode = param.getTypeNode();
      const typeStr = typeNode ? `: ${typeNode.getText()}` : '';
      members.push(`  ${modStr}${param.getName()}${optional}${typeStr};`);
    }
  }

  for (const prop of decl.getProperties()) {
    const modifiers = prop.getModifiers()
      .filter((m) => !m.isKind(SyntaxKind.Decorator))
      .map((m) => m.getText())
      .filter((m) => m !== 'declare')
      .join(' ');
    const modStr = modifiers ? `${modifiers} ` : '';
    const optional = prop.hasQuestionToken() ? '?' : '';
    const typeNode = prop.getTypeNode();
    const typeStr = typeNode ? `: ${typeNode.getText()}` : `: ${prop.getType().getText()}`;
    members.push(`${jsDocText(prop, '  ')}  ${modStr}${prop.getName()}${optional}${typeStr};`);
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
    members.push(`${jsDocText(method, '  ')}  ${modStr}${method.getName()}${methodTypeParamsStr}(${params})${returnStr};`);
  }

  const body = members.length > 0 ? `\n${members.join('\n')}\n` : '';
  return `${jsDocText(decl)}export declare class ${name}${typeParamsStr}${heritageStr} {${body}}`;
}

/**
 * Collects the public instance members of a class as `name?: type` property strings,
 * used when converting a class to a type alias or interface.
 */
function classToMemberLines(decl: ClassDeclaration): string[] {
  const lines: string[] = [];
  for (const ctor of decl.getConstructors()) {
    for (const param of ctor.getParameters()) {
      if (!param.isParameterProperty()) continue;
      const mods = param.getModifiers().map((m) => m.getText());
      if (mods.includes('private') || mods.includes('protected') || mods.includes('static')) continue;
      const optional = param.hasQuestionToken() ? '?' : '';
      const typeNode = param.getTypeNode();
      const typeStr = typeNode ? `: ${typeNode.getText()}` : `: ${param.getType().getText()}`;
      lines.push(`  ${param.getName()}${optional}${typeStr};`);
    }
  }
  for (const prop of decl.getProperties()) {
    const mods = prop.getModifiers().map((m) => m.getText());
    if (mods.includes('private') || mods.includes('protected') || mods.includes('static')) continue;
    const optional = prop.hasQuestionToken() ? '?' : '';
    const typeNode = prop.getTypeNode();
    const typeStr = typeNode ? `: ${typeNode.getText()}` : `: ${prop.getType().getText()}`;
    lines.push(`${jsDocText(prop, '  ')}  ${prop.getName()}${optional}${typeStr};`);
  }
  for (const method of decl.getMethods()) {
    const mods = method.getModifiers().map((m) => m.getText());
    if (mods.includes('private') || mods.includes('protected') || mods.includes('static')) continue;
    const methodTypeParams = method.getTypeParameters();
    const methodTypeParamsStr = methodTypeParams.length > 0
      ? `<${methodTypeParams.map((p) => p.getText()).join(', ')}>`
      : '';
    const params = method.getParameters().map((p) => p.getText()).join(', ');
    const returnTypeNode = method.getReturnTypeNode();
    const returnStr = returnTypeNode ? `: ${returnTypeNode.getText()}` : '';
    lines.push(`${jsDocText(method, '  ')}  ${method.getName()}${methodTypeParamsStr}(${params})${returnStr};`);
  }
  return lines;
}

/** Converts any publishable declaration to a type alias text, or `null` if not convertible. */
function toTypeAliasText(
  decl: Exclude<PublishableDeclaration, EnumDeclaration>,
): string | null {
  const name = decl.getName() ?? '';
  const typeParams = decl.getTypeParameters();
  const typeParamsStr = typeParams.length > 0
    ? `<${typeParams.map((p) => p.getText()).join(', ')}>`
    : '';

  if (decl.isKind(SyntaxKind.TypeAliasDeclaration)) {
    // Already a type alias — emit as-is (with export prefix)
    const text = decl.getText();
    const exported = text.startsWith('export') ? text : `export ${text}`;
    return `${jsDocText(decl)}${exported}`;
  }

  if (decl.isKind(SyntaxKind.InterfaceDeclaration)) {
    // Use ts-morph API to avoid fragile regex; express extends as intersection types
    const extendsTypes = decl.getHeritageClauses()
      .flatMap((h) => h.getTypeNodes().map((t) => t.getText()));
    const members = decl.getMembers().map((m) => `${jsDocText(m, '  ')}  ${m.getText()}`);
    const ownBody = members.length > 0 ? `{\n${members.join('\n')}\n}` : '{}';
    const rhs = extendsTypes.length > 0 ? `${extendsTypes.join(' & ')} & ${ownBody}` : ownBody;
    return `${jsDocText(decl)}export type ${name}${typeParamsStr} = ${rhs}`;
  }

  if (decl.isKind(SyntaxKind.ClassDeclaration)) {
    // Only `extends` (not `implements`) carries inherited members worth intersecting
    const extendsTypes = decl.getHeritageClauses()
      .filter((h) => h.getToken() === SyntaxKind.ExtendsKeyword)
      .flatMap((h) => h.getTypeNodes().map((t) => t.getText()));
    const memberLines = classToMemberLines(decl);
    const ownBody = memberLines.length > 0 ? `{\n${memberLines.join('\n')}\n}` : '{}';
    const rhs = extendsTypes.length > 0 ? `${extendsTypes.join(' & ')} & ${ownBody}` : ownBody;
    return `${jsDocText(decl)}export type ${name}${typeParamsStr} = ${rhs}`;
  }

  return null;
}

/** Converts any publishable declaration to an interface text, or `null` if not convertible. */
function toInterfaceText(
  decl: Exclude<PublishableDeclaration, EnumDeclaration>,
): string | null {
  const name = decl.getName() ?? '';
  const typeParams = decl.getTypeParameters();
  const typeParamsStr = typeParams.length > 0
    ? `<${typeParams.map((p) => p.getText()).join(', ')}>`
    : '';

  if (decl.isKind(SyntaxKind.InterfaceDeclaration)) {
    const text = decl.getText();
    const exported = text.startsWith('export') ? text : `export ${text}`;
    return `${jsDocText(decl)}${exported}`;
  }

  if (decl.isKind(SyntaxKind.TypeAliasDeclaration)) {
    const typeNode = decl.getTypeNode();
    if (!typeNode) return null;

    if (typeNode.isKind(SyntaxKind.TypeLiteral)) {
      const members = typeNode.getMembers().map((m) => `${jsDocText(m, '  ')}  ${m.getText()}`);
      const body = members.length > 0 ? `{\n${members.join('\n')}\n}` : '{}';
      return `${jsDocText(decl)}export interface ${name}${typeParamsStr} ${body}`;
    }

    if (typeNode.isKind(SyntaxKind.IntersectionType)) {
      const namedTypes: string[] = [];
      const memberLines: string[] = [];
      for (const part of typeNode.getTypeNodes()) {
        if (part.isKind(SyntaxKind.TypeLiteral)) {
          memberLines.push(...part.getMembers().map((m) => `${jsDocText(m, '  ')}  ${m.getText()}`));
        } else {
          namedTypes.push(part.getText());
        }
      }
      const heritageStr = namedTypes.length > 0 ? ` extends ${namedTypes.join(', ')}` : '';
      const body = memberLines.length > 0 ? `{\n${memberLines.join('\n')}\n}` : '{}';
      return `${jsDocText(decl)}export interface ${name}${typeParamsStr}${heritageStr} ${body}`;
    }

    return null;
  }

  if (decl.isKind(SyntaxKind.ClassDeclaration)) {
    // Flatten both `extends` and `implements` into interface `extends` (interfaces have no `implements`)
    const allBaseTypes = decl.getHeritageClauses()
      .flatMap((h) => h.getTypeNodes().map((t) => t.getText()));
    const heritageStr = allBaseTypes.length > 0 ? ` extends ${allBaseTypes.join(', ')}` : '';
    const memberLines = classToMemberLines(decl);
    const body = memberLines.length > 0 ? `{\n${memberLines.join('\n')}\n}` : '{}';
    return `${jsDocText(decl)}export interface ${name}${typeParamsStr}${heritageStr} ${body}`;
  }

  return null;
}

/** Converts any publishable declaration to a declare class text, or `null` if not convertible. */
function toDeclareClassText(
  decl: Exclude<PublishableDeclaration, EnumDeclaration>,
): string | null {
  if (decl.isKind(SyntaxKind.ClassDeclaration)) {
    return toAmbientClassText(decl);
  }

  const name = decl.getName() ?? '';
  const typeParams = decl.getTypeParameters();
  const typeParamsStr = typeParams.length > 0
    ? `<${typeParams.map((p) => p.getText()).join(', ')}>`
    : '';

  if (decl.isKind(SyntaxKind.InterfaceDeclaration)) {
    // Interface `extends` becomes `implements` on the class (all are interface-shaped)
    const implementsTypes = decl.getHeritageClauses()
      .flatMap((h) => h.getTypeNodes().map((t) => t.getText()));
    const implementsStr = implementsTypes.length > 0 ? ` implements ${implementsTypes.join(', ')}` : '';
    const members = decl.getMembers().map((m) => `${jsDocText(m, '  ')}  ${m.getText()}`);
    const body = members.length > 0 ? `\n${members.join('\n')}\n` : '';
    return `${jsDocText(decl)}export declare class ${name}${typeParamsStr}${implementsStr} {${body}}`;
  }

  if (decl.isKind(SyntaxKind.TypeAliasDeclaration)) {
    const typeNode = decl.getTypeNode();
    if (!typeNode) return null;

    if (typeNode.isKind(SyntaxKind.TypeLiteral)) {
      const memberLines = typeNode.getMembers().map((m) => `${jsDocText(m, '  ')}  ${m.getText()}`);
      const classBody = memberLines.length > 0 ? `\n${memberLines.join('\n')}\n` : '';
      return `${jsDocText(decl)}export declare class ${name}${typeParamsStr} {${classBody}}`;
    }

    if (typeNode.isKind(SyntaxKind.IntersectionType)) {
      const namedTypes: string[] = [];
      const memberLines: string[] = [];
      for (const part of typeNode.getTypeNodes()) {
        if (part.isKind(SyntaxKind.TypeLiteral)) {
          memberLines.push(...part.getMembers().map((m) => `${jsDocText(m, '  ')}  ${m.getText()}`));
        } else {
          namedTypes.push(part.getText());
        }
      }
      const implementsStr = namedTypes.length > 0 ? ` implements ${namedTypes.join(', ')}` : '';
      const classBody = memberLines.length > 0 ? `\n${memberLines.join('\n')}\n` : '';
      return `${jsDocText(decl)}export declare class ${name}${typeParamsStr}${implementsStr} {${classBody}}`;
    }

    return null;
  }

  return null;
}

/**
 * Applies `declarationMapping` to a single publishable declaration.
 * Returns `{ text, warned }` where `warned` is true if the conversion
 * was not possible and the declaration was emitted as-is.
 */
function applyDeclarationMapping(
  stmt: PublishableDeclaration,
  mapping: 'preserve' | 'type' | 'interface' | 'class',
): { text: string; warned: boolean } {
  // Enums are always preserved as-is.
  if (stmt.isKind(SyntaxKind.EnumDeclaration)) {
    const raw = stmt.getText();
    const exported = raw.startsWith('export') ? raw : `export ${raw}`;
    return { text: `${jsDocText(stmt)}${exported}`, warned: false };
  }

  // Classes in preserve mode still need ambient-class conversion (strip bodies).
  if (mapping === 'preserve') {
    if (stmt.isKind(SyntaxKind.ClassDeclaration)) {
      return { text: stripInlineImports(toAmbientClassText(stmt)), warned: false };
    }
    const raw = stmt.getText();
    const exported = raw.startsWith('export') ? raw : `export ${raw}`;
    return { text: stripInlineImports(`${jsDocText(stmt)}${exported}`), warned: false };
  }

  const declForConversion = stmt as Exclude<PublishableDeclaration, EnumDeclaration>;

  let converted: string | null = null;
  if (mapping === 'type') {
    converted = toTypeAliasText(declForConversion);
  } else if (mapping === 'interface') {
    converted = toInterfaceText(declForConversion);
  } else if (mapping === 'class') {
    converted = toDeclareClassText(declForConversion);
  }

  if (converted !== null) {
    return { text: stripInlineImports(converted), warned: false };
  }

  // Fallback — emit as-is with a warning
  const raw = stmt.getText();
  const exported = raw.startsWith('export') ? raw : `export ${raw}`;
  return { text: stripInlineImports(`${jsDocText(stmt)}${exported}`), warned: true };
}

/**
 * Extracts publishable declarations from scan results into standalone
 * .d.ts declaration files ready to be written to the output directory.
 */
export function extract(scanResults: ScanResult[], options: ExtractOptions = {}): ExtractionResult {
  const mapping = options.declarationMapping ?? 'preserve';
  const extractedFiles: ExtractedFile[] = [];
  const allExportedNames: string[] = [];
  const allDiagnostics: ExtractionDiagnostic[] = [];
  const allWarnings: ExtractionDiagnostic[] = [];
  /** Tracks every source file that publishes a given name, for collision detection. */
  const nameToFilePaths = new Map<string, string[]>();

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

    // Emit the needed declarations with optional kind mapping
    for (const stmt of sourceFile.getStatements()) {
      if (!isPublishableDeclaration(stmt)) continue;
      const name = getDeclarationName(stmt);
      if (!name || !needed.has(name)) continue;

      const { text, warned } = applyDeclarationMapping(stmt, mapping);
      if (warned) {
        allWarnings.push({
          typeName: name,
          filePath: sourceFile.getFilePath(),
        });
      }
      lines.push(text);
      lines.push('');
      allExportedNames.push(name);

      // Track which files publish each name for collision detection
      const filePath = sourceFile.getFilePath();
      const existing = nameToFilePaths.get(name);
      if (existing) {
        existing.push(filePath);
      } else {
        nameToFilePaths.set(name, [filePath]);
      }
    }

    const fileName = sourceFile.getBaseName().replace(/\.ts$/, '.d.ts');
    extractedFiles.push({
      originalPath: sourceFile.getFilePath(),
      content: lines.join('\n').trimEnd() + '\n',
      fileName,
    });
  }

  const collisions: CollisionDiagnostic[] = [];
  for (const [typeName, filePaths] of nameToFilePaths) {
    if (filePaths.length > 1) {
      collisions.push({ typeName, filePaths });
    }
  }

  return { files: extractedFiles, exportedNames: allExportedNames, diagnostics: allDiagnostics, warnings: allWarnings, collisions };
}
