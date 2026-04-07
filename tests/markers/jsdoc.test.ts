import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { hasPublishJsDoc, findPublishableNodes } from '../../src/markers/jsdoc';

function createProject(code: string) {
  const project = new Project({ useInMemoryFileSystem: true });
  const sf = project.createSourceFile('test.ts', code);
  return sf;
}

describe('hasPublishJsDoc', () => {
  it('detects @publish JSDoc tag on interface', () => {
    const sf = createProject(`
      /** @publish */
      export interface UserDto { id: string; }
    `);
    const node = sf.getInterfaceOrThrow('UserDto');
    expect(hasPublishJsDoc(node)).toBe(true);
  });

  it('detects @typeship JSDoc tag on type alias', () => {
    const sf = createProject(`
      /** @typeship */
      export type UserId = string;
    `);
    const node = sf.getTypeAliasOrThrow('UserId');
    expect(hasPublishJsDoc(node)).toBe(true);
  });

  it('returns false when no publish tag present', () => {
    const sf = createProject(`
      /** @internal */
      export interface InternalDto { id: string; }
    `);
    const node = sf.getInterfaceOrThrow('InternalDto');
    expect(hasPublishJsDoc(node)).toBe(false);
  });

  it('returns false when no JSDoc at all', () => {
    const sf = createProject(`export interface NoDoc { id: string; }`);
    const node = sf.getInterfaceOrThrow('NoDoc');
    expect(hasPublishJsDoc(node)).toBe(false);
  });
});

describe('findPublishableNodes', () => {
  it('collects JSDoc-tagged nodes', () => {
    const sf = createProject(`
      /** @publish */
      export interface UserDto { id: string; }

      /** @publish */
      export type ProductId = string;

      export interface IgnoredDto { x: number; }
    `);
    const nodes = findPublishableNodes(sf);
    expect(nodes).toHaveLength(2);
  });

  it('returns empty array when no publishable nodes', () => {
    const sf = createProject(`export interface Foo { bar: string; }`);
    expect(findPublishableNodes(sf)).toHaveLength(0);
  });
});
