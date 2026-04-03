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
  // ── interface → type ──────────────────────────────────────────────────────

  it('interface extends → type: emits intersection type', () => {
    const sr = buildScanResult(`
      interface Base { id: string; }

      /** @publish */
      export interface User extends Base {
        name: string;
      }
    `);
    const result = extract([sr], { declarationMapping: 'type' });
    const content = result.files[0]?.content ?? '';
    expect(content).toMatch(/export type User = Base & \{/);
    expect(content).toContain('name: string');
  });

  it('interface extends multiple → type: emits all bases as intersections', () => {
    const sr = buildScanResult(`
      interface A { a: string; }
      interface B { b: number; }

      /** @publish */
      export interface C extends A, B {
        c: boolean;
      }
    `);
    const result = extract([sr], { declarationMapping: 'type' });
    const content = result.files[0]?.content ?? '';
    expect(content).toMatch(/export type C = A & B & \{/);
    expect(content).toContain('c: boolean');
  });

  // ── class → type ──────────────────────────────────────────────────────────

  it('class extends → type: emits intersection with base class', () => {
    const sr = buildScanResult(`
      export class Base { id: string; }

      /** @publish */
      export class User extends Base {
        name: string;
      }
    `);
    const result = extract([sr], { declarationMapping: 'type' });
    const content = result.files[0]?.content ?? '';
    expect(content).toMatch(/export type User = Base & \{/);
    expect(content).toContain('name: string');
  });

  it('class implements → type: drops implements (not member-bearing)', () => {
    const sr = buildScanResult(`
      interface IFoo { foo(): void; }

      /** @publish */
      export class Bar implements IFoo {
        foo() {}
      }
    `);
    const result = extract([sr], { declarationMapping: 'type' });
    const content = result.files[0]?.content ?? '';
    // implements is not included in the intersection — only extends is
    expect(content).toMatch(/export type Bar\s*=/);
    expect(content).not.toContain('implements');
  });

  // ── class → interface ─────────────────────────────────────────────────────

  it('class extends → interface: preserves extends clause', () => {
    const sr = buildScanResult(`
      export class Base { id: string; }

      /** @publish */
      export class User extends Base {
        name: string;
      }
    `);
    const result = extract([sr], { declarationMapping: 'interface' });
    const content = result.files[0]?.content ?? '';
    expect(content).toMatch(/export interface User extends Base/);
    expect(content).toContain('name: string');
  });

  it('class implements → interface: converts implements to extends', () => {
    const sr = buildScanResult(`
      interface IFoo { foo: string; }

      /** @publish */
      export class Bar implements IFoo {
        foo: string;
      }
    `);
    const result = extract([sr], { declarationMapping: 'interface' });
    const content = result.files[0]?.content ?? '';
    // interfaces use `extends`, not `implements`
    expect(content).toMatch(/export interface Bar extends IFoo/);
    expect(content).not.toContain('implements');
  });

  it('class extends + implements → interface: both become extends entries', () => {
    const sr = buildScanResult(`
      export class Base { id: string; }
      interface IFoo { foo: string; }

      /** @publish */
      export class Child extends Base implements IFoo {
        foo: string;
      }
    `);
    const result = extract([sr], { declarationMapping: 'interface' });
    const content = result.files[0]?.content ?? '';
    expect(content).toMatch(/export interface Child extends Base, IFoo/);
    expect(content).not.toContain('implements');
  });

  // ── interface → class ─────────────────────────────────────────────────────

  it('interface extends → class: uses implements clause', () => {
    const sr = buildScanResult(`
      interface Base { id: string; }

      /** @publish */
      export interface User extends Base {
        name: string;
      }
    `);
    const result = extract([sr], { declarationMapping: 'class' });
    const content = result.files[0]?.content ?? '';
    expect(content).toMatch(/export declare class User implements Base/);
    expect(content).toContain('name: string');
  });

  it('interface extends multiple → class: all become implements entries', () => {
    const sr = buildScanResult(`
      interface A { a: string; }
      interface B { b: number; }

      /** @publish */
      export interface C extends A, B {
        c: boolean;
      }
    `);
    const result = extract([sr], { declarationMapping: 'class' });
    const content = result.files[0]?.content ?? '';
    expect(content).toMatch(/export declare class C implements A, B/);
    expect(content).toContain('c: boolean');
  });

  // ── intersection type → interface ─────────────────────────────────────────

  it('intersection type → interface: named parts become extends, object parts become body', () => {
    const sr = buildScanResult(`
      interface Base { id: string; }

      /** @publish */
      export type User = Base & { name: string; };
    `);
    const result = extract([sr], { declarationMapping: 'interface' });
    const content = result.files[0]?.content ?? '';
    expect(content).toMatch(/export interface User extends Base/);
    expect(content).toContain('name: string');
    expect(result.warnings).toHaveLength(0);
  });

  it('intersection type multiple named → interface: all named parts in extends', () => {
    const sr = buildScanResult(`
      interface A { a: string; }
      interface B { b: number; }

      /** @publish */
      export type C = A & B & { c: boolean; };
    `);
    const result = extract([sr], { declarationMapping: 'interface' });
    const content = result.files[0]?.content ?? '';
    expect(content).toMatch(/export interface C extends A, B/);
    expect(content).toContain('c: boolean');
    expect(result.warnings).toHaveLength(0);
  });

  // ── intersection type → class ─────────────────────────────────────────────

  it('intersection type → class: named parts become implements, object parts become body', () => {
    const sr = buildScanResult(`
      interface Base { id: string; }

      /** @publish */
      export type User = Base & { name: string; };
    `);
    const result = extract([sr], { declarationMapping: 'class' });
    const content = result.files[0]?.content ?? '';
    expect(content).toMatch(/export declare class User implements Base/);
    expect(content).toContain('name: string');
    expect(result.warnings).toHaveLength(0);
  });

  it('intersection type multiple named → class: all named parts in implements', () => {
    const sr = buildScanResult(`
      interface A { a: string; }
      interface B { b: number; }

      /** @publish */
      export type C = A & B & { c: boolean; };
    `);
    const result = extract([sr], { declarationMapping: 'class' });
    const content = result.files[0]?.content ?? '';
    expect(content).toMatch(/export declare class C implements A, B/);
    expect(content).toContain('c: boolean');
    expect(result.warnings).toHaveLength(0);
  });
});

