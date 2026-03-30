/**
 * Performance test for typeship against the large-project fixture.
 *
 * Exercises the full scan → extract → emit pipeline in-process so we can
 * measure each phase individually and get a reliable wall-clock total.
 *
 * The fixture has ~261 published types across 50 source files in 10 vertical
 * slices, cross-referencing shared types (realistic enterprise scale).
 *
 * Assertions are generous: the goal is to catch catastrophic regressions, not
 * to enforce microsecond budgets.
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
  '../fixtures/large-project',
);
const TSCONFIG = join(FIXTURE_DIR, 'tsconfig.json');

// ─── shared pipeline result ────────────────────────────────────────────────

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
  tmpDir = mkdtempSync(join(tmpdir(), 'typeship-perf-'));

  const config = loadConfig(FIXTURE_DIR);
  const outputGrouping = config.outputGrouping;

  // ── Scan ──────────────────────────────────────────────────────────────────
  const t0 = performance.now();
  const scanResults = scan({ tsConfigFilePath: TSCONFIG });
  const t1 = performance.now();

  // ── Extract ───────────────────────────────────────────────────────────────
  const extraction = extract(scanResults);
  const t2 = performance.now();

  // ── Emit ──────────────────────────────────────────────────────────────────
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

  // Cleanup temp output
  rmSync(tmpDir, { recursive: true, force: true });
}, 60_000);

// ─── correctness ──────────────────────────────────────────────────────────

describe('large-project fixture – correctness', () => {
  it('scans all source files', () => {
    expect(result.fileCount).toBe(50);
  });

  it('finds all published types (261)', () => {
    expect(result.typeCount).toBe(261);
  });

  it('produces no fatal diagnostics', () => {
    expect(result.diagnostics).toBe(0);
  });

  it('produces no conversion warnings', () => {
    expect(result.warnings).toBe(0);
  });

  it('emits 10 slice files + 4 shared fallbacks + 1 barrel', () => {
    // 10 slice .d.ts + pagination, common, media, i18n (per-file fallback) + barrel
    expect(result.outputFileCount).toBe(15);
  });
});

// ─── performance ──────────────────────────────────────────────────────────

describe('large-project fixture – performance', () => {
  it('scans 50 files in under 15 s', () => {
    console.log(`  scan    : ${result.scanMs.toFixed(0)} ms`);
    expect(result.scanMs).toBeLessThan(15_000);
  });

  it('extracts 288 types in under 5 s', () => {
    console.log(`  extract : ${result.extractMs.toFixed(0)} ms`);
    expect(result.extractMs).toBeLessThan(5_000);
  });

  it('emits output files in under 500 ms', () => {
    console.log(`  emit    : ${result.emitMs.toFixed(0)} ms`);
    expect(result.emitMs).toBeLessThan(500);
  });

  it('total pipeline completes in under 20 s', () => {
    console.log(`  total   : ${result.totalMs.toFixed(0)} ms`);
    console.log(`  types   : ${result.typeCount} across ${result.fileCount} source files → ${result.outputFileCount} output files`);
    expect(result.totalMs).toBeLessThan(20_000);
  });
});
