import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emit } from '../../src/core/emitter.js';
import type { ExtractionResult } from '../../src/core/extractor.js';

function mockExtraction(fileNames: string[]): ExtractionResult {
  return {
    files: fileNames.map((fileName) => ({
      originalPath: `/project/src/${fileName}`,
      fileName,
      content: `export interface Foo { id: string; }\n`,
    })),
    exportedNames: ['Foo'],
    diagnostics: [],
  };
}

describe('emit', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'typeship-emit-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes source files and barrel to outDir/src/', () => {
    const result = emit(mockExtraction(['user.dto.d.ts']), { outDir: tmpDir });
    expect(result.files.length).toBe(2); // 1 file + barrel
    expect(result.files.some((f) => f.path.endsWith('index.d.ts'))).toBe(true);
    expect(result.files.some((f) => f.path.endsWith('user.dto.d.ts'))).toBe(true);
  });

  it('barrel contains export for each file', () => {
    const result = emit(mockExtraction(['user.dto.d.ts', 'product.dto.d.ts']), { outDir: tmpDir });
    const barrel = result.files.find((f) => f.path.endsWith('index.d.ts'));
    expect(barrel?.content).toContain("export * from './user.dto.js'");
    expect(barrel?.content).toContain("export * from './product.dto.js'");
  });

  it('dry run does not write files', () => {
    const result = emit(mockExtraction(['user.dto.ts']), { outDir: tmpDir, dryRun: true });
    // Should return files list without throwing
    expect(result.files.length).toBeGreaterThan(0);
    // outDir/src should not exist (nothing written)
    expect(existsSync(join(tmpDir, 'src'))).toBe(false);
  });
});
