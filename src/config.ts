import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface TypeshipConfig {
  /** Output directory for the generated package. Default: "./generated". */
  outDir?: string;
  /** Package name for the generated package, e.g. "@my-org/api-types". */
  packageName?: string;
  /** npm/GitHub Packages registry URL. */
  registry?: string;
  /** Semver bump to apply on each generation: patch | minor | major. */
  bump?: 'patch' | 'minor' | 'major';
  /** Absolute or relative path to the project tsconfig.json to scan. */
  tsConfig?: string;
  /**
   * Controls how extracted declarations are grouped into output .d.ts files.
   *
   * - `"per-file"` (default): one .d.ts per source file — matches the original 1:1 layout.
   * - `"single"`: all declarations merged into a single `index.d.ts`; no separate barrel.
   * - `Record<string, string[]>`: custom map of output filename → array of minimatch glob
   *   patterns matched against each source file's absolute path.
   *   Source files that match no pattern are emitted per-file as a fallback.
   *
   * @example
   * // Vertical-slice layout: one .d.ts per domain
   * { "users.d.ts": ["**\/users\/**"], "orders.d.ts": ["**\/orders\/**"] }
   */
  outputGrouping?: 'per-file' | 'single' | Record<string, string[]>;
  /**
   * Normalizes all exported declarations to a single TypeScript construct kind.
   *
   * - `"preserve"` (default): each declaration is emitted in its original form.
   * - `"type"`: interfaces and classes are converted to type aliases.
   * - `"interface"`: type aliases (object types) and classes are converted to interfaces.
   * - `"class"`: interfaces and type aliases (object types) are converted to `declare class`.
   *
   * Enums are always preserved regardless of this setting.
   * Non-object type aliases that cannot be converted will emit a warning and fall back to preserve.
   */
  declarationMapping?: 'preserve' | 'type' | 'interface' | 'class';
}

const CONFIG_FILE_NAMES = ['typeship.config.json', '.typeshiprc.json'];

/**
 * Loads typeship configuration from the nearest config file in the given
 * root directory. Returns an empty object if no config file is found.
 */
export function loadConfig(rootDir: string = process.cwd()): TypeshipConfig {
  for (const name of CONFIG_FILE_NAMES) {
    const configPath = join(resolve(rootDir), name);
    if (existsSync(configPath)) {
      try {
        return JSON.parse(readFileSync(configPath, 'utf8')) as TypeshipConfig;
      } catch {
        throw new Error(`Failed to parse config file: ${configPath}`);
      }
    }
  }
  return {};
}
