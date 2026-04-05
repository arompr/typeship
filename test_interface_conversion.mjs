import { Project } from 'ts-morph';
import { extract } from './dist/core/extractor.js';
import { findPublishableNodes } from './dist/markers/jsdoc.js';

const project = new Project({ useInMemoryFileSystem: true });
const sf = project.createSourceFile('test.ts', `
/** @publish */
export interface User {
  /** User ID field comment */
  id: string;
  /** User email field comment */
  email: string;
}
`);

const nodes = findPublishableNodes(sf);

// Test with preserve mode (default)
console.log('=== PRESERVE MODE (uses getText()) ===');
let result = extract([{ sourceFile: sf, nodes }], { declarationMapping: 'preserve' });
console.log(result.files[0].content);

// Test with interface mode
console.log('\n=== INTERFACE MODE (converts to interface, uses getText()) ===');
result = extract([{ sourceFile: sf, nodes }], { declarationMapping: 'interface' });
console.log(result.files[0].content);

// Test with type mode
console.log('\n=== TYPE MODE (converts to type alias, uses getText()) ===');
result = extract([{ sourceFile: sf, nodes }], { declarationMapping: 'type' });
console.log(result.files[0].content);
