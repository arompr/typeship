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

describe('extract', () => {
  it('extracts a @publish interface', () => {
    const scanResult = buildScanResult(`
      /** @publish */
      export interface UserDto {
        id: string;
        email: string;
      }
    `);
    const result = extract([scanResult]);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.content).toContain('UserDto');
    expect(result.exportedNames).toContain('UserDto');
  });

  it('includes a local dependency used by the publishable type', () => {
    const scanResult = buildScanResult(`
      export type UserId = string;

      /** @publish */
      export interface UserDto {
        id: UserId;
        email: string;
      }
    `);
    const result = extract([scanResult]);
    expect(result.files[0]?.content).toContain('UserId');
    expect(result.files[0]?.content).toContain('UserDto');
  });

  it('generates a barrel with all file exports', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sf1 = project.createSourceFile('user.dto.ts', `/** @publish */ export interface UserDto { id: string; }`);
    const sf2 = project.createSourceFile('product.dto.ts', `/** @publish */ export interface ProductDto { name: string; }`);

    const result = extract([
      { sourceFile: sf1, nodes: findPublishableNodes(sf1) },
      { sourceFile: sf2, nodes: findPublishableNodes(sf2) },
    ]);

    expect(result.exportedNames).toContain('UserDto');
    expect(result.exportedNames).toContain('ProductDto');
  });

  it('returns empty result when scan results are empty', () => {
    const result = extract([]);
    expect(result.files).toHaveLength(0);
    expect(result.exportedNames).toHaveLength(0);
  });
});
