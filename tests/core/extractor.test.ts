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

  it('does not produce false-positive diagnostics for property names matching local type names', () => {
    // Property "id" should not match a local type also named "id"
    const scanResult = buildScanResult(`
      export type id = string;

      /** @publish */
      export interface UserDto {
        id: string;
      }
    `);
    const result = extract([scanResult]);
    // "id" property name must not pull in "id" type alias as a false dependency
    expect(result.diagnostics).toHaveLength(0);
    // "id" type alias should NOT be included (it's not genuinely used as a type reference)
    expect(result.files[0]?.content).not.toMatch(/export type id/);
  });

  it('produces no diagnostics when all types are primitives or built-ins', () => {
    const scanResult = buildScanResult(`
      /** @publish */
      export interface UserDto {
        id: string;
        count: number;
        active: boolean;
        createdAt: Date;
      }
    `);
    const result = extract([scanResult]);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('produces a diagnostic for a cross-file type that is not marked @publish', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile('/address.ts', `
      export interface Address {
        street: string;
        city: string;
      }
    `);
    const userFile = project.createSourceFile('/user.dto.ts', `
      import { Address } from './address.js';

      /** @publish */
      export interface UserDto {
        id: string;
        address: Address;
      }
    `);
    const nodes = findPublishableNodes(userFile);
    const result = extract([{ sourceFile: userFile, nodes }]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.typeName).toBe('Address');
    expect(result.diagnostics[0]?.filePath).toContain('address.ts');
  });

  it('produces no diagnostic when the cross-file type is marked @publish', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile('/address.ts', `
      /** @publish */
      export interface Address {
        street: string;
        city: string;
      }
    `);
    const userFile = project.createSourceFile('/user.dto.ts', `
      import { Address } from './address.js';

      /** @publish */
      export interface UserDto {
        id: string;
        address: Address;
      }
    `);
    const nodes = findPublishableNodes(userFile);
    const result = extract([{ sourceFile: userFile, nodes }]);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('produces no diagnostic for types imported from non-relative (package) imports', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const userFile = project.createSourceFile('/user.dto.ts', `
      import { IsString } from 'class-validator';

      /** @publish */
      export interface UserDto {
        id: IsString;
      }
    `);
    const nodes = findPublishableNodes(userFile);
    const result = extract([{ sourceFile: userFile, nodes }]);
    expect(result.diagnostics).toHaveLength(0);
  });
});
