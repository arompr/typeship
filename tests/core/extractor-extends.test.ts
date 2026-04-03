import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { extract } from '../../src/core/extractor.js';
import { findPublishableNodes } from '../../src/markers/jsdoc.js';

function buildScanResult(code: string, fileName = 'types.ts') {
  const project = new Project({ useInMemoryFileSystem: true });
  const sf = project.createSourceFile(fileName, code);
  const nodes = findPublishableNodes(sf);
  return { sourceFile: sf, nodes };
}

describe('extends handling with declarationMapping', () => {
  it('interface extends: type mapping produces syntax with extends clause in RHS', () => {
    const sr = buildScanResult(`
      interface Base { id: string; }
      
      /** @publish */
      export interface User extends Base {
        name: string;
      }
    `);
    const result = extract([sr], { declarationMapping: 'type' });
    const content = result.files[0]?.content ?? '';
    // The regex at line 305 only strips "interface UserName" but NOT the "extends Base" clause
    // So the result is: export type User = extends Base { name: string; }
    expect(content).toContain('export type User');
    expect(content).toContain('extends Base');
  });

  it('class extends: type mapping produces type alias with flattened members (NO extends)', () => {
    const sr = buildScanResult(`
      export class Base { id: string; }
      
      /** @publish */
      export class User extends Base {
        name: string;
      }
    `);
    const result = extract([sr], { declarationMapping: 'type' });
    const content = result.files[0]?.content ?? '';
    // Class members are extracted via classToMemberLines (line 310)
    // The extends clause is NOT consulted at all
    // Result flattens members: export type User = { id: string; name: string; }
    expect(content).toMatch(/export type User\s*=/);
    expect(content).not.toContain('extends');
  });

  it('class extends: interface mapping preserves extends clause', () => {
    const sr = buildScanResult(`
      export class Base { id: string; }
      
      /** @publish */
      export class User extends Base {
        name: string;
      }
    `);
    const result = extract([sr], { declarationMapping: 'interface' });
    const content = result.files[0]?.content ?? '';
    // toInterfaceText extracts heritageClauses (line 340-343)
    // Result preserves extends: export interface User extends Base { ... }
    expect(content).toMatch(/export interface User\s+extends Base/);
  });
});
