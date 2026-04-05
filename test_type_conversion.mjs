import { Project } from 'ts-morph';
import { extract } from './dist/core/extractor.js';
import { findPublishableNodes } from './dist/markers/jsdoc.js';

const project = new Project({ useInMemoryFileSystem: true });
const sf = project.createSourceFile('test.ts', `
/** Leading JSDoc @publish */
export interface User {
  /** Field JSDoc: User ID */
  id: string;
  /** Field JSDoc: Email */
  email: string;
}
`);

const nodes = findPublishableNodes(sf);

console.log('=== TYPE MODE (interface → type alias) ===');
let result = extract([{ sourceFile: sf, nodes }], { declarationMapping: 'type' });
console.log(result.files[0].content);

console.log('=== Observation ===');
const output = result.files[0].content;
console.log(`Leading JSDoc: ${output.includes('Leading JSDoc') ? 'PRESERVED' : 'STRIPPED'}`);
console.log(`Field JSDoc: ${output.includes('Field JSDoc') ? 'PRESERVED' : 'STRIPPED'}`);
