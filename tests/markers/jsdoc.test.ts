import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { hasPublishJsDoc, hasPublishDecorator, findPublishableNodes } from '../../src/markers/jsdoc.js';

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

describe('hasPublishDecorator', () => {
  it('detects @Publish() decorator on class', () => {
    const sf = createProject(`
      function Publish(): ClassDecorator { return () => {}; }
      @Publish()
      export class UserDto { id!: string; }
    `);
    const node = sf.getClassOrThrow('UserDto');
    expect(hasPublishDecorator(node)).toBe(true);
  });

  it('returns false for class without @Publish()', () => {
    const sf = createProject(`export class UserDto { id!: string; }`);
    const node = sf.getClassOrThrow('UserDto');
    expect(hasPublishDecorator(node)).toBe(false);
  });

  it('returns false for non-class nodes', () => {
    const sf = createProject(`
      /** @publish */
      export interface UserDto { id: string; }
    `);
    const node = sf.getInterfaceOrThrow('UserDto');
    expect(hasPublishDecorator(node)).toBe(false);
  });
});

describe('findPublishableNodes', () => {
  it('collects both JSDoc-tagged and decorator-marked nodes', () => {
    const sf = createProject(`
      function Publish(): ClassDecorator { return () => {}; }

      /** @publish */
      export interface UserDto { id: string; }

      @Publish()
      export class ProductDto { name!: string; }

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
