import { Project } from 'ts-morph';

const project = new Project({ useInMemoryFileSystem: true });
const sf = project.createSourceFile('test.ts', `
export interface User {
  /** User ID field comment */
  id: string;
  /** User email field comment */
  email: string;
}
`);

const intf = sf.getInterfaces()[0];
console.log('Interface members via getMembers():');
for (const member of intf.getMembers()) {
  console.log('Member getText():', member.getText());
}

console.log('\nComparing getText() vs getFullText():');
const prop = intf.getProperties()[0];
console.log('getText():', prop.getText());
console.log('getFullText():', prop.getFullText());
