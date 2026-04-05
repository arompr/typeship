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

describe('extract – declarationMapping', () => {
  it('preserves kinds by default', () => {
    const sr = buildScanResult(`
      /** @publish */
      export interface UserDto { id: string; }
    `);
    const result = extract([sr]);
    expect(result.files[0]?.content).toMatch(/export interface UserDto/);
  });

  it('mapping "type" converts interface to type alias', () => {
    const sr = buildScanResult(`
      /** @publish */
      export interface UserDto { id: string; }
    `);
    const result = extract([sr], { declarationMapping: 'type' });
    expect(result.files[0]?.content).toMatch(/export type UserDto\s*=/);
    expect(result.files[0]?.content).not.toMatch(/export interface/);
  });

  it('mapping "type" keeps a type alias as-is', () => {
    const sr = buildScanResult(`
      /** @publish */
      export type UserId = string;
    `);
    const result = extract([sr], { declarationMapping: 'type' });
    expect(result.files[0]?.content).toMatch(/export type UserId = string/);
  });

  it('mapping "type" converts class to type alias (public members only)', () => {
    const sr = buildScanResult(`
      /** @publish */
      export class UserDto {
        id: string;
        private secret: string;
        getName(): string { return this.id; }
      }
    `);
    const result = extract([sr], { declarationMapping: 'type' });
    expect(result.files[0]?.content).toMatch(/export type UserDto\s*=/);
    expect(result.files[0]?.content).toContain('id');
    expect(result.files[0]?.content).not.toContain('secret');
    expect(result.files[0]?.content).not.toMatch(/export declare class/);
  });

  it('mapping "interface" converts type alias (object type) to interface', () => {
    const sr = buildScanResult(`
      /** @publish */
      export type UserDto = { id: string; name: string; };
    `);
    const result = extract([sr], { declarationMapping: 'interface' });
    expect(result.files[0]?.content).toMatch(/export interface UserDto/);
    expect(result.files[0]?.content).not.toMatch(/export type/);
  });

  it('mapping "interface" keeps interface as-is', () => {
    const sr = buildScanResult(`
      /** @publish */
      export interface UserDto { id: string; }
    `);
    const result = extract([sr], { declarationMapping: 'interface' });
    expect(result.files[0]?.content).toMatch(/export interface UserDto/);
  });

  it('mapping "interface" converts class to interface (public members only)', () => {
    const sr = buildScanResult(`
      /** @publish */
      export class UserDto {
        id: string;
        private secret: string;
      }
    `);
    const result = extract([sr], { declarationMapping: 'interface' });
    expect(result.files[0]?.content).toMatch(/export interface UserDto/);
    expect(result.files[0]?.content).toContain('id');
    expect(result.files[0]?.content).not.toContain('secret');
    expect(result.files[0]?.content).not.toMatch(/declare class/);
  });

  it('mapping "class" converts interface to declare class', () => {
    const sr = buildScanResult(`
      /** @publish */
      export interface UserDto { id: string; }
    `);
    const result = extract([sr], { declarationMapping: 'class' });
    expect(result.files[0]?.content).toMatch(/export declare class UserDto/);
    expect(result.files[0]?.content).not.toMatch(/export interface/);
  });

  it('mapping "class" converts type alias (object type) to declare class', () => {
    const sr = buildScanResult(`
      /** @publish */
      export type UserDto = { id: string; name: string; };
    `);
    const result = extract([sr], { declarationMapping: 'class' });
    expect(result.files[0]?.content).toMatch(/export declare class UserDto/);
  });

  it('mapping "class" keeps a class as-is (as declare class)', () => {
    const sr = buildScanResult(`
      /** @publish */
      export class UserDto { id: string; }
    `);
    const result = extract([sr], { declarationMapping: 'class' });
    expect(result.files[0]?.content).toMatch(/export declare class UserDto/);
  });

  it('always preserves enums regardless of mapping', () => {
    const sr = buildScanResult(`
      /** @publish */
      export enum Status { Active = 'active', Inactive = 'inactive' }
    `);
    for (const mapping of ['type', 'interface', 'class'] as const) {
      const result = extract([sr], { declarationMapping: mapping });
      expect(result.files[0]?.content).toMatch(/export enum Status/);
    }
  });

  it('mapping "interface" falls back for non-object type alias and adds a warning', () => {
    const sr = buildScanResult(`
      /** @publish */
      export type UserId = string;
    `);
    const result = extract([sr], { declarationMapping: 'interface' });
    // Should still emit something (fallback preserve)
    expect(result.files[0]?.content).toContain('UserId');
    // Warning is added for non-convertible type (not a fatal diagnostic)
    expect(result.warnings.some((w) => w.typeName === 'UserId')).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });
});

describe('extract – decorators and constructors', () => {
  it('strips property decorators from declare class output', () => {
    const sr = buildScanResult(`
      function IsString() { return () => {}; }
      function IsNotEmpty() { return () => {}; }

      /** @publish */
      export class SyncPlayerCommandPayload {
        @IsString()
        @IsNotEmpty()
        token!: string;
      }
    `);
    const result = extract([sr]);
    const content = result.files[0]?.content ?? '';
    expect(content).toMatch(/export declare class SyncPlayerCommandPayload/);
    expect(content).toContain('token');
    expect(content).not.toMatch(/@IsString/);
    expect(content).not.toMatch(/@IsNotEmpty/);
  });

  it('does not emit constructors in declare class output', () => {
    const sr = buildScanResult(`
      interface WsCommand { type: string; }

      /** @publish */
      export class SyncPlayerCommand implements WsCommand {
        readonly type = 'SYNC_PLAYER';
        constructor(public readonly payload: string) {
          this.payload = payload;
        }
      }
    `);
    const result = extract([sr]);
    const content = result.files[0]?.content ?? '';
    expect(content).toMatch(/export declare class SyncPlayerCommand/);
    expect(content).not.toMatch(/constructor/);
  });

  it('promotes constructor parameter properties to class properties in declare class output', () => {
    const sr = buildScanResult(`
      /** @publish */
      export class SyncPlayerCommand {
        readonly type = 'SYNC_PLAYER';
        constructor(public readonly payload: string) {}
      }
    `);
    const result = extract([sr]);
    const content = result.files[0]?.content ?? '';
    expect(content).toContain('payload');
    expect(content).toMatch(/readonly payload: string/);
    expect(content).not.toMatch(/constructor/);
  });

  it('emits inferred type annotation for a property with an initializer in declare class output', () => {
    const sr = buildScanResult(`
      export enum WsLobbyCommandType {
        SYNC_PLAYER = 'SYNC_PLAYER',
      }

      /** @publish */
      export class SyncPlayerCommand {
        readonly type = WsLobbyCommandType.SYNC_PLAYER;
        constructor(public readonly payload: string) {}
      }
    `);
    const result = extract([sr]);
    const content = result.files[0]?.content ?? '';
    expect(content).toMatch(/export declare class SyncPlayerCommand/);
    expect(content).toMatch(/readonly type:.*WsLobbyCommandType\.SYNC_PLAYER/);
  });

  it('emits inferred type annotation for a property with an initializer in type mapping output', () => {
    const sr = buildScanResult(`
      export enum WsLobbyCommandType {
        SYNC_PLAYER = 'SYNC_PLAYER',
      }

      /** @publish */
      export class SyncPlayerCommand {
        readonly type = WsLobbyCommandType.SYNC_PLAYER;
        constructor(public readonly payload: string) {}
      }
    `);
    const result = extract([sr], { declarationMapping: 'type' });
    const content = result.files[0]?.content ?? '';
    expect(content).toMatch(/export type SyncPlayerCommand\s*=/);
    expect(content).toMatch(/\btype:.*WsLobbyCommandType\.SYNC_PLAYER/);
  });

  it('strips decorators and promotes constructor parameter properties together', () => {
    const sr = buildScanResult(`
      function IsString() { return () => {}; }

      /** @publish */
      export class CommandPayload {
        @IsString()
        token!: string;
      }

      /** @publish */
      export class SyncCommand {
        readonly type = 'SYNC';
        constructor(public readonly payload: CommandPayload) {}
      }
    `);
    const result = extract([sr]);
    const content = result.files[0]?.content ?? '';
    expect(content).not.toMatch(/@IsString/);
    expect(content).not.toMatch(/constructor/);
    expect(content).toContain('token');
    expect(content).toMatch(/readonly payload: CommandPayload/);
  });
});

describe('extract – collision detection', () => {
  it('reports no collisions when all type names are unique', () => {
    const sr1 = buildScanResult(`/** @publish */ export interface UserDto { id: string; }`, 'user.ts');
    const sr2 = buildScanResult(`/** @publish */ export interface OrderDto { id: string; }`, 'order.ts');
    const result = extract([sr1, sr2]);
    expect(result.collisions).toHaveLength(0);
  });

  it('detects a collision when the same name is published in two files', () => {
    const sr1 = buildScanResult(`/** @publish */ export interface UserDto { id: string; }`, 'user.ts');
    const sr2 = buildScanResult(`/** @publish */ export interface UserDto { name: string; }`, 'admin.ts');
    const result = extract([sr1, sr2]);
    expect(result.collisions).toHaveLength(1);
    expect(result.collisions[0]?.typeName).toBe('UserDto');
    expect(result.collisions[0]?.filePaths).toHaveLength(2);
  });

  it('detects multiple collisions independently', () => {
    const sr1 = buildScanResult(
      `/** @publish */ export interface Foo { a: string; }\n/** @publish */ export interface Bar { x: number; }`,
      'a.ts',
    );
    const sr2 = buildScanResult(
      `/** @publish */ export interface Foo { b: string; }\n/** @publish */ export interface Bar { y: number; }`,
      'b.ts',
    );
    const result = extract([sr1, sr2]);
    expect(result.collisions).toHaveLength(2);
    const names = result.collisions.map((c) => c.typeName).sort();
    expect(names).toEqual(['Bar', 'Foo']);
  });

  it('includes all conflicting file paths in the collision entry', () => {
    const sr1 = buildScanResult(`/** @publish */ export interface Shared { id: string; }`, 'a.ts');
    const sr2 = buildScanResult(`/** @publish */ export interface Shared { id: string; }`, 'b.ts');
    const sr3 = buildScanResult(`/** @publish */ export interface Shared { id: string; }`, 'c.ts');
    const result = extract([sr1, sr2, sr3]);
    expect(result.collisions).toHaveLength(1);
    expect(result.collisions[0]?.filePaths).toHaveLength(3);
  });
});

describe('extract – JSDoc comment preservation', () => {
  it('preserves declaration-level JSDoc in preserve mode (interface)', () => {
    const sr = buildScanResult(`
      /**
       * Represents a user.
       * @publish
       */
      export interface UserDto {
        id: string;
      }
    `);
    const result = extract([sr]);
    expect(result.files[0]?.content).toContain('Represents a user.');
    expect(result.files[0]?.content).toMatch(/\/\*\*[\s\S]*?Represents a user[\s\S]*?\*\//);
  });

  it('preserves member-level JSDoc in preserve mode (interface)', () => {
    const sr = buildScanResult(`
      /** @publish */
      export interface UserDto {
        /** The user ID. */
        id: string;
        /** The user email. */
        email: string;
      }
    `);
    const result = extract([sr]);
    expect(result.files[0]?.content).toContain('The user ID.');
    expect(result.files[0]?.content).toContain('The user email.');
  });

  it('preserves declaration-level JSDoc when mapping to type alias', () => {
    const sr = buildScanResult(`
      /**
       * Represents a user.
       * @publish
       */
      export interface UserDto {
        id: string;
      }
    `);
    const result = extract([sr], { declarationMapping: 'type' });
    expect(result.files[0]?.content).toContain('Represents a user.');
  });

  it('preserves member-level JSDoc when mapping interface to type alias', () => {
    const sr = buildScanResult(`
      /** @publish */
      export interface UserDto {
        /** The user ID. */
        id: string;
      }
    `);
    const result = extract([sr], { declarationMapping: 'type' });
    expect(result.files[0]?.content).toContain('The user ID.');
  });

  it('preserves declaration-level JSDoc when mapping to interface', () => {
    const sr = buildScanResult(`
      /**
       * A user alias.
       * @publish
       */
      export type UserDto = { id: string; };
    `);
    const result = extract([sr], { declarationMapping: 'interface' });
    expect(result.files[0]?.content).toContain('A user alias.');
  });

  it('preserves member-level JSDoc when mapping type alias to interface', () => {
    const sr = buildScanResult(`
      /** @publish */
      export type UserDto = {
        /** The user ID. */
        id: string;
      };
    `);
    const result = extract([sr], { declarationMapping: 'interface' });
    expect(result.files[0]?.content).toContain('The user ID.');
  });

  it('preserves declaration-level JSDoc on class in preserve mode', () => {
    const sr = buildScanResult(`
      /**
       * A user service class.
       * @publish
       */
      export class UserService {
        id: string;
      }
    `);
    const result = extract([sr]);
    expect(result.files[0]?.content).toContain('A user service class.');
  });

  it('preserves member-level JSDoc on class in preserve mode', () => {
    const sr = buildScanResult(`
      /** @publish */
      export class UserService {
        /** The service ID. */
        id: string;
        /** Gets the ID. */
        getId(): string { return this.id; }
      }
    `);
    const result = extract([sr]);
    expect(result.files[0]?.content).toContain('The service ID.');
    expect(result.files[0]?.content).toContain('Gets the ID.');
  });

  it('preserves declaration-level JSDoc on enum', () => {
    const sr = buildScanResult(`
      /**
       * User roles.
       * @publish
       */
      export enum Role { Admin = 'admin', User = 'user' }
    `);
    const result = extract([sr]);
    expect(result.files[0]?.content).toContain('User roles.');
  });
});
