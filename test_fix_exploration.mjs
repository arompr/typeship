import { Project } from 'ts-morph';
import { mkdirSync, writeFileSync } from 'fs';

const tmpDir = '/tmp/typeship_test3';
mkdirSync(tmpDir, { recursive: true });

writeFileSync(`${tmpDir}/types.ts`, `
export interface BaseType {
  id: string;
}
`);

writeFileSync(`${tmpDir}/user.ts`, `
import { BaseType } from './types.js';

export class User {
  /** With explicit annotation */
  explicit: BaseType;
  
  /** Without explicit annotation - inferred */
  inferred = {} as BaseType;
}
`);

const project = new Project({ 
  useInMemoryFileSystem: false,
  skipAddingFilesFromTsConfig: true,
});

const userFile = project.addSourceFileAtPath(`${tmpDir}/user.ts`);
const cls = userFile.getClasses()[0];

console.log('=== COMPARISON: getTypeNode vs getType ===\n');
for (const prop of cls.getProperties()) {
  const typeNode = prop.getTypeNode();
  const inferredType = prop.getType().getText();
  
  console.log(`Property: ${prop.getName()}`);
  console.log(`  getTypeNode(): ${typeNode ? `"${typeNode.getText()}"` : 'null'}`);
  console.log(`  getType().getText(): "${inferredType}"`);
  console.log(`  Issue: ${inferredType.includes('import(') ? '❌ YES' : '✓ NO'}`);
  console.log('');
}

console.log('\n=== SOLUTION OPTIONS ===');
console.log('Option 1: Always prefer getTypeNode().getText() when available');
console.log('Option 2: Parse/clean up getType().getText() to remove import() wrappers');
console.log('Option 3: Require explicit type annotations on class properties');
