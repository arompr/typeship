import type { Node, SourceFile } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';

/** Tag names recognized as "publish" markers in JSDoc comments. */
const PUBLISH_TAGS = new Set(['publish', 'typeship']);

/**
 * Returns true if a ts-morph node carries a @publish or @typeship JSDoc tag.
 */
export function hasPublishJsDoc(node: Node): boolean {
  if (!node.getKindName().includes('Declaration')) return false;

  // Nodes that support JSDoc expose getJsDocs()
  const jsDocs =
    'getJsDocs' in node && typeof (node as never as { getJsDocs: () => unknown[] }).getJsDocs === 'function'
      ? (node as never as { getJsDocs: () => Array<{ getTags: () => Array<{ getTagName: () => string }> }> }).getJsDocs()
      : [];

  for (const doc of jsDocs) {
    for (const tag of doc.getTags()) {
      if (PUBLISH_TAGS.has(tag.getTagName().toLowerCase())) return true;
    }
  }
  return false;
}

/**
 * Returns true if a ts-morph node has a @Publish() decorator applied.
 * Works for class declarations.
 */
export function hasPublishDecorator(node: Node): boolean {
  if (node.getKind() !== SyntaxKind.ClassDeclaration) return false;
  const cls = node.asKindOrThrow(SyntaxKind.ClassDeclaration);
  return cls
    .getDecorators()
    .some((d) => d.getName() === 'Publish');
}

/**
 * Collects all publishable nodes from a source file using both JSDoc
 * and decorator strategies.
 */
export function findPublishableNodes(sourceFile: SourceFile): Node[] {
  const results: Node[] = [];

  sourceFile.forEachDescendant((node) => {
    if (hasPublishJsDoc(node) || hasPublishDecorator(node)) {
      results.push(node);
    }
  });

  return results;
}
