import { Project } from 'ts-morph';
import { extract } from './dist/core/extractor.js';
import { findPublishableNodes } from './dist/markers/jsdoc.js';

function testConversionMode(code, mode) {
  const project = new Project({ useInMemoryFileSystem: true });
  const sf = project.createSourceFile('test.ts', code);
  
  const nodes = findPublishableNodes(sf);
  const result = extract([{ sourceFile: sf, nodes }], { declarationMapping: mode });
  return result.files[0]?.content || '';
}

const testCode = `
/** JSDoc comment on MyInterface */
export interface MyInterface {
  /** Field comment */
  field: string;
}

/** JSDoc comment on MyType 
 * @publish 
 */
export type MyType = { field: string; };

/** JSDoc comment on MyEnum 
 * @publish 
 */
export enum MyEnum { A = "a" }

/** JSDoc comment on MyClass 
 * @publish 
 */
export class MyClass {
  /** Field comment */
  field: string;
}

/** @publish */
export interface PublishedInterface {
  /** Field doc */
  value: number;
}
`;

console.log('=== PRESERVE MODE ===');
console.log(testConversionMode(testCode, 'preserve'));

console.log('\n=== TYPE MODE ===');
console.log(testConversionMode(testCode, 'type'));

console.log('\n=== INTERFACE MODE ===');
console.log(testConversionMode(testCode, 'interface'));
