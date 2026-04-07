import type { Node, SourceFile } from 'ts-morph';

/** Tag names recognized as "publish" markers in JSDoc comments. */
const PUBLISH_TAGS = new Set(['publish', 'typeship']);

interface JsDocNode {
  getJsDocs: () => Array<{ getTags: () => Array<{ getTagName: () => string }> }>;
}

function hasJsDocs(node: Node): node is Node & JsDocNode {
  return (
    node.getKindName().includes('Declaration') &&
    'getJsDocs' in node &&
    typeof (node as unknown as JsDocNode).getJsDocs === 'function'
  );
}

/**
 * Returns `true` if a ts-morph node carries a `@publish` or `@typeship`
 * JSDoc tag.
 */
export function hasPublishJsDoc(node: Node): boolean {
  if (!hasJsDocs(node)) return false;

  for (const doc of node.getJsDocs()) {
    for (const tag of doc.getTags()) {
      if (PUBLISH_TAGS.has(tag.getTagName().toLowerCase())) return true;
    }
  }
  return false;
}

/**
 * Collects all publishable nodes from a source file — every declaration
 * that carries a `@publish` or `@typeship` JSDoc tag.
 */
export function findPublishableNodes(sourceFile: SourceFile): Node[] {
  const results: Node[] = [];

  sourceFile.forEachDescendant((node) => {
    if (hasPublishJsDoc(node)) {
      results.push(node);
    }
  });

  return results;
}
