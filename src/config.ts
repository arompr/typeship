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
