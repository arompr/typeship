import { Project } from 'ts-morph';
import { extract } from './dist/core/extractor.js';
import { findPublishableNodes } from './dist/markers/jsdoc.js';

function testConversionMode(code, mode) {
  const project = new Project({ useInMemoryFileSystem: true });
  const sf = project.createSourceFile('test.ts', code);
  
  // Mark all interfaces/types as publishable
  for (const stmt of sf.getStatements()) {
    if (stmt.getKind?.() === 249 || stmt.getKind?.() === 250 || stmt.getKind?.() === 254) {
      const existing = stmt.getJsDocs?.();
      if (existing?.length > 0) {
        existing[0].setDescription('@publish\n' + existing[0].getDescription());
      } else {
        stmt.addJsDoc?.({ description: '@publish' });
      }
    }
  }
  
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

/** JSDoc comment on MyType */
export type MyType = { field: string; };

/** JSDoc comment on MyEnum */
export enum MyEnum { A = "a" }

/** JSDoc comment on MyClass */
export class MyClass {
  /** Field comment */
  field: string;
}
`;

console.log('=== PRESERVE MODE ===');
console.log(testConversionMode(testCode, 'preserve'));

console.log('\n=== TYPE MODE ===');
console.log(testConversionMode(testCode, 'type'));

console.log('\n=== INTERFACE MODE ===');
console.log(testConversionMode(testCode, 'interface'));

console.log('\n=== CLASS MODE ===');
console.log(testConversionMode(testCode, 'class'));
