import { Project } from 'ts-morph';
import { extract } from './dist/core/extractor.js';
import { findPublishableNodes } from './dist/markers/jsdoc.js';

const project = new Project({ useInMemoryFileSystem: true });
const sf = project.createSourceFile('test.ts', `
/** This is a JSDoc comment for UserDto */
export interface UserDto {
  /** User ID field */
  id: string;
  /** User email field */
  email: string;
}

/** Another commented type */
export type UserId = string;
`);

const nodesInitial = findPublishableNodes(sf);
const userDtoNode = sf.getInterfaces()[0];
const userIdNode = sf.getTypeAliases()[0];

// Add @publish marker
if (userDtoNode) {
  const existing = userDtoNode.getJsDocs();
  if (existing.length > 0) {
    existing[0].setDescription(existing[0].getDescription() + '\n@publish');
  } else {
    userDtoNode.addJsDoc({ description: '@publish' });
  }
}

if (userIdNode) {
  const existing = userIdNode.getJsDocs();
  if (existing.length > 0) {
    existing[0].setDescription(existing[0].getDescription() + '\n@publish');
  } else {
    userIdNode.addJsDoc({ description: '@publish' });
  }
}

const nodesAfter = findPublishableNodes(sf);
const result = extract([{ sourceFile: sf, nodes: nodesAfter }]);

console.log('=== Generated Content ===');
console.log(result.files[0].content);
