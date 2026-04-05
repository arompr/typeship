import { Project } from 'ts-morph';

const project = new Project({ useInMemoryFileSystem: true });
const sf = project.createSourceFile('test.ts', `
/** This is a JSDoc comment for UserDto */
export interface UserDto {
  /** User ID field */
  id: string;
  /** User email field */
  email: string;
}
`);

const userDtoNode = sf.getInterfaces()[0];
console.log('=== getText() output ===');
console.log(userDtoNode.getText());

console.log('\n=== getFullText() output ===');
console.log(userDtoNode.getFullText());
