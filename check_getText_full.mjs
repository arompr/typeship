import { Project } from 'ts-morph';

const project = new Project({ useInMemoryFileSystem: true });
const sf = project.createSourceFile('test.ts', `
/** Interface leading comment */
export interface User {
  /** User ID field comment */
  id: string;
  /** User email field comment */
  email: string;
}
`);

const intf = sf.getInterfaces()[0];
console.log('=== Interface getText() ===');
console.log(intf.getText());

console.log('\n=== Interface getFullText() ===');
console.log(intf.getFullText());
