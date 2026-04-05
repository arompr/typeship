import { Project } from 'ts-morph';
import { extract } from './dist/core/extractor.js';
import { findPublishableNodes } from './dist/markers/jsdoc.js';

const project = new Project({ useInMemoryFileSystem: true });
const sf = project.createSourceFile('test.ts', `
/** 
 * Leading JSDoc: Description of MyDto class
 * @author Me
 * @publish 
 */
export class MyDto {
  /** Field leading JSDoc comment */
  name: string;
  
  constructor(name: string) {
    this.name = name;
  }
}

/** 
 * Leading JSDoc: Description of User interface
 * @publish 
 */
export interface User {
  /** Field leading JSDoc: User ID */
  id: string;
  /** Field leading JSDoc: Email address */
  email: string;
}

/** 
 * Leading JSDoc: Description of Config type
 * @publish 
 */
export type Config = {
  /** Field leading JSDoc: API key */
  apiKey: string;
  /** Field leading JSDoc: API URL */
  url: string;
};
`);

const nodes = findPublishableNodes(sf);
const result = extract([{ sourceFile: sf, nodes }], { declarationMapping: 'preserve' });

console.log('=== GENERATED OUTPUT (PRESERVE MODE) ===');
console.log(result.files[0].content);

console.log('\n=== COMMENT PRESERVATION ANALYSIS ===');
const output = result.files[0].content;

console.log(`\n✓ Leading JSDoc on declarations: ${output.includes('Description of MyDto') ? 'NO - STRIPPED' : 'YES - PRESERVED'}`);
console.log(`✓ Leading JSDoc on interface: ${output.includes('Description of User') ? 'NO - STRIPPED' : 'YES - PRESERVED'}`);
console.log(`✓ Leading JSDoc on type: ${output.includes('Description of Config') ? 'NO - STRIPPED' : 'YES - PRESERVED'}`);

console.log(`\n✓ Member/field JSDoc on class: ${output.includes('Field leading JSDoc comment') ? 'YES - PRESERVED' : 'NO - STRIPPED'}`);
console.log(`✓ Member/field JSDoc on interface: ${output.includes('Field leading JSDoc: User ID') ? 'YES - PRESERVED' : 'NO - STRIPPED'}`);
console.log(`✓ Member/field JSDoc on type: ${output.includes('Field leading JSDoc: API key') ? 'YES - PRESERVED' : 'NO - STRIPPED'}`);
