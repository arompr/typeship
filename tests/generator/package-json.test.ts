import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generatePackageJson, readExistingVersion } from '../../src/generator/package-json';
import { generateTsConfig } from '../../src/generator/tsconfig';

describe('generatePackageJson', () => {
  it('generates a package.json with correct fields', () => {
    const pkg = generatePackageJson({ name: '@my-org/api-types' });
    expect(pkg.name).toBe('@my-org/api-types');
    expect(pkg.version).toBe('0.1.0');
    expect(pkg.types).toBe('./src/index.d.ts');
    expect(pkg.publishConfig.registry).toBe('https://registry.npmjs.org');
  });

  it('uses custom registry', () => {
    const pkg = generatePackageJson({
      name: '@my-org/api-types',
      registry: 'https://npm.pkg.github.com',
    });
    expect(pkg.publishConfig.registry).toBe('https://npm.pkg.github.com');
  });

  it('bumps patch version', () => {
    const pkg = generatePackageJson({ name: '@org/types', version: '1.2.3', bump: 'patch' });
    expect(pkg.version).toBe('1.2.4');
  });

  it('bumps minor version', () => {
    const pkg = generatePackageJson({ name: '@org/types', version: '1.2.3', bump: 'minor' });
    expect(pkg.version).toBe('1.3.0');
  });

  it('bumps major version', () => {
    const pkg = generatePackageJson({ name: '@org/types', version: '1.2.3', bump: 'major' });
    expect(pkg.version).toBe('2.0.0');
  });

  describe('with existing package.json', () => {
    let tmpDir: string;

    beforeEach(() => { tmpDir = mkdtempSync(join(tmpdir(), 'typeship-pkg-')); });
    afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

    it('reads version from existing file', () => {
      const existingPath = join(tmpDir, 'package.json');
      writeFileSync(existingPath, JSON.stringify({ version: '2.5.0' }));
      const pkg = generatePackageJson({
        name: '@org/types',
        existingPackageJsonPath: existingPath,
      });
      expect(pkg.version).toBe('2.5.0');
    });

    it('bumps version read from existing file', () => {
      const existingPath = join(tmpDir, 'package.json');
      writeFileSync(existingPath, JSON.stringify({ version: '2.5.0' }));
      const pkg = generatePackageJson({
        name: '@org/types',
        existingPackageJsonPath: existingPath,
        bump: 'patch',
      });
      expect(pkg.version).toBe('2.5.1');
    });
  });
});

describe('generateTsConfig', () => {
  it('generates a tsconfig with declaration enabled', () => {
    const config = generateTsConfig();
    expect(config.compilerOptions.declaration).toBe(true);
    expect(config.compilerOptions.outDir).toBe('./dist');
    expect(config.compilerOptions.rootDir).toBe('./src');
    expect(config.include).toContain('src/**/*');
    expect(config.compilerOptions).not.toHaveProperty('experimentalDecorators');
  });
});

describe('readExistingVersion', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = mkdtempSync(join(tmpdir(), 'typeship-ver-')); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('returns version from existing file', () => {
    const path = join(tmpDir, 'package.json');
    writeFileSync(path, JSON.stringify({ version: '3.1.4' }));
    expect(readExistingVersion(path)).toBe('3.1.4');
  });

  it('returns undefined when file does not exist', () => {
    expect(readExistingVersion(join(tmpDir, 'nonexistent.json'))).toBeUndefined();
  });
});
