import { Project } from 'ts-morph';
import { extract } from './dist/core/extractor.js';
import { findPublishableNodes } from './dist/markers/jsdoc.js';

const project = new Project({ useInMemoryFileSystem: true });
const sf = project.createSourceFile('test.ts', `
/** 
 * This is the leading JSDoc for MyType
 * It describes what MyType does
 * @publish 
 */
export type MyType = {
  /** This is JSDoc for the field1 member */
  field1: string;
  /** This is JSDoc for the field2 member */
  field2: number;
};

/** 
 * This is the leading JSDoc for UserInterface
 * @publish 
 */
export interface UserInterface {
  /** User ID documentation */
  id: string;
  /** User email documentation */
  email: string;
  /** Optional description field */
  description?: string;
}
`);

const nodes = findPublishableNodes(sf);
const result = extract([{ sourceFile: sf, nodes }]);

console.log('=== Generated Output ===');
console.log(result.files[0].content);
console.log('\n=== Analysis ===');
console.log('- Leading JSDoc on type: YES (preserved) or NO (stripped)?');
console.log('- Member JSDoc comments: YES (preserved) or NO (stripped)?');
