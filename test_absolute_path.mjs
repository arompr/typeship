import { Project } from 'ts-morph';
import path from 'path';

const project = new Project({ 
  useInMemoryFileSystem: false,
  skipAddingFilesFromTsConfig: true,
});

// Create a real temp directory structure
const tmpDir = '/tmp/typeship_test';
import { mkdirSync, writeFileSync } from 'fs';
mkdirSync(tmpDir, { recursive: true });

// Create two files with cross-file types
writeFileSync(`${tmpDir}/types.ts`, `
export interface BaseType {
  id: string;
}
`);

writeFileSync(`${tmpDir}/user.ts`, `
import { BaseType } from './types.js';

export class User extends BaseType {
  name: string;
}
`);

// Load with ts-morph
const userFile = project.addSourceFileAtPath(`${tmpDir}/user.ts`);
const cls = userFile.getClasses()[0];

console.log('=== Class Members ===');
for (const prop of cls.getProperties()) {
  const typeNode = prop.getTypeNode();
  console.log(`Property: ${prop.getName()}`);
  console.log(`  Has typeNode: ${!!typeNode}`);
  if (typeNode) {
    console.log(`  typeNode.getText(): ${typeNode.getText()}`);
  }
  const typeStr = prop.getType().getText();
  console.log(`  prop.getType().getText(): ${typeStr}`);
  if (typeStr.includes('import(')) {
    console.log(`  ⚠️ ISSUE FOUND: Contains import()`);
  }
  console.log('');
}
