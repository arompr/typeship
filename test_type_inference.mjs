import { Project } from 'ts-morph';

const project = new Project({ useInMemoryFileSystem: true });
const sf = project.createSourceFile('test.ts', `
export class MyClass {
  name = "test";  // No type annotation, inferred
  email: string;  // With type annotation
}
`);

const cls = sf.getClasses()[0];
for (const prop of cls.getProperties()) {
  const typeNode = prop.getTypeNode();
  console.log(`Property: ${prop.getName()}`);
  console.log(`  Has typeNode: ${!!typeNode}`);
  if (typeNode) {
    console.log(`  typeNode.getText(): ${typeNode.getText()}`);
  }
  console.log(`  prop.getType().getText(): ${prop.getType().getText()}`);
  console.log('');
}
