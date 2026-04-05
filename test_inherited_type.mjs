import { Project } from 'ts-morph';
import { mkdirSync, writeFileSync } from 'fs';

const tmpDir = '/tmp/typeship_test2';
mkdirSync(tmpDir, { recursive: true });

writeFileSync(`${tmpDir}/types.ts`, `
export interface BaseType {
  id: string;
}
`);

writeFileSync(`${tmpDir}/user.ts`, `
import { BaseType } from './types.js';

export class User {
  baseData: BaseType;  // Property uses inherited type WITHOUT annotation
}
`);

const project = new Project({ 
  useInMemoryFileSystem: false,
  skipAddingFilesFromTsConfig: true,
});

const userFile = project.addSourceFileAtPath(`${tmpDir}/user.ts`);
const cls = userFile.getClasses()[0];

console.log('=== Class Properties ===');
for (const prop of cls.getProperties()) {
  const typeNode = prop.getTypeNode();
  console.log(`Property: ${prop.getName()}`);
  console.log(`  Has typeNode: ${!!typeNode}`);
  if (typeNode) {
    console.log(`  typeNode.getText(): "${typeNode.getText()}"`);
  }
  const typeStr = prop.getType().getText();
  console.log(`  prop.getType().getText(): "${typeStr}"`);
  if (typeStr.includes('import(')) {
    console.log(`  ⚠️ ISSUE FOUND: Contains import()`);
  }
  console.log('');
}
