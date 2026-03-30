/**
 * Performance test for typeship against the extra-large-project fixture.
 *
 * Scale: 7 domain slices (users, products, orders, payments, catalog,
 * notifications, analytics) × ~50–60 types each + shared types = ~398 total
 * published types across 48 source files. Closer to "hundreds of types per
 * slice" as found in real enterprise backends.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { scan } from '../../src/core/scanner.js';
import { extract } from '../../src/core/extractor.js';
import { emit } from '../../src/core/emitter.js';
import { loadConfig } from '../../src/config.js';

const FIXTURE_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../fixtures/extra-large-project',
);
const TSCONFIG = join(FIXTURE_DIR, 'tsconfig.json');

interface PipelineResult {
  scanMs: number;
  extractMs: number;
  emitMs: number;
  totalMs: number;
  fileCount: number;
  typeCount: number;
  outputFileCount: number;
  diagnostics: number;
  warnings: number;
}

let result: PipelineResult;
let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'typeship-perf-xl-'));

  const config = loadConfig(FIXTURE_DIR);
  const outputGrouping = config.outputGrouping;

  const t0 = performance.now();
  const scanResults = scan({ tsConfigFilePath: TSCONFIG });
  const t1 = performance.now();

  const extraction = extract(scanResults);
  const t2 = performance.now();

  const emitResult = emit(extraction, {
    outDir: tmpDir,
    ...(outputGrouping !== undefined && { outputGrouping }),
  });
  const t3 = performance.now();

  result = {
    scanMs: t1 - t0,
    extractMs: t2 - t1,
    emitMs: t3 - t2,
    totalMs: t3 - t0,
    fileCount: scanResults.length,
    typeCount: scanResults.reduce((n, r) => n + r.nodes.length, 0),
    outputFileCount: emitResult.files.length,
    diagnostics: extraction.diagnostics.length,
    warnings: extraction.warnings.length,
  };

  rmSync(tmpDir, { recursive: true, force: true });
}, 60_000);

// ─── correctness ──────────────────────────────────────────────────────────────

describe('extra-large-project fixture – correctness', () => {
  it('scans all source files', () => {
    expect(result.fileCount).toBe(48);
  });

  it('finds all published types (398)', () => {
    expect(result.typeCount).toBe(398);
  });

  it('produces no fatal diagnostics', () => {
    expect(result.diagnostics).toBe(0);
  });

  it('produces no conversion warnings', () => {
    expect(result.warnings).toBe(0);
  });

  it('emits 7 slice files + 5 shared fallbacks + 1 barrel', () => {
    // 7 slice .d.ts + pagination, common, media, i18n, events (per-file) + barrel
    expect(result.outputFileCount).toBe(13);
  });
});

// ─── performance ──────────────────────────────────────────────────────────────

describe('extra-large-project fixture – performance', () => {
  it('scans 48 files in under 15 s', () => {
    console.log(`  scan    : ${result.scanMs.toFixed(0)} ms`);
    expect(result.scanMs).toBeLessThan(15_000);
  });

  it('extracts 398 types in under 10 s', () => {
    console.log(`  extract : ${result.extractMs.toFixed(0)} ms`);
    expect(result.extractMs).toBeLessThan(10_000);
  });

  it('emits output files in under 500 ms', () => {
    console.log(`  emit    : ${result.emitMs.toFixed(0)} ms`);
    expect(result.emitMs).toBeLessThan(500);
  });

  it('total pipeline completes in under 30 s', () => {
    console.log(`  total   : ${result.totalMs.toFixed(0)} ms`);
    console.log(`  types   : ${result.typeCount} across ${result.fileCount} source files → ${result.outputFileCount} output files`);
    expect(result.totalMs).toBeLessThan(30_000);
  });
});
