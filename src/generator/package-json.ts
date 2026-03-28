import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import semver from 'semver';

export interface PackageJsonOptions {
  /** Package name, e.g. "@my-org/api-types" */
  name: string;
  /** Starting version. Defaults to "0.1.0". */
  version?: string;
  /** npm registry URL. Defaults to "https://registry.npmjs.org". */
  registry?: string;
  /** Bump the version: patch | minor | major. Applied before writing. */
  bump?: 'patch' | 'minor' | 'major';
  /** Absolute path to an existing generated package.json to read current version from. */
  existingPackageJsonPath?: string;
}

export interface GeneratedPackageJson {
  name: string;
  version: string;
  description: string;
  main: string;
  types: string;
  files: string[];
  publishConfig: { registry: string };
  devDependencies: Record<string, string>;
}

/**
 * Generates a package.json object for the extracted types package.
 * If an existing package.json is found at outDir, its version is read
 * and optionally bumped.
 */
export function generatePackageJson(
  options: PackageJsonOptions,
): GeneratedPackageJson {
  const registry = options.registry ?? 'https://registry.npmjs.org';

  let version = options.version ?? '0.1.0';

  // Read existing version if available
  if (options.existingPackageJsonPath && existsSync(options.existingPackageJsonPath)) {
    try {
      const existing = JSON.parse(
        readFileSync(options.existingPackageJsonPath, 'utf8'),
      ) as { version?: string };
      if (existing.version && semver.valid(existing.version)) {
        version = existing.version;
      }
    } catch {
      // ignore parse errors, keep default
    }
  }

  // Apply version bump
  if (options.bump) {
    const bumped = semver.inc(version, options.bump);
    if (!bumped) throw new Error(`Cannot bump version "${version}" with "${options.bump}"`);
    version = bumped;
  }

  return {
    name: options.name,
    version,
    description: `TypeScript types published by typeship from ${options.name}`,
    main: './dist/index.js',
    types: './dist/index.d.ts',
    files: ['dist', 'src'],
    publishConfig: { registry },
    devDependencies: {
      typescript: '^5.0.0',
    },
  };
}

/** Reads the version from an existing generated package.json, or returns undefined. */
export function readExistingVersion(packageJsonPath: string): string | undefined {
  if (!existsSync(packageJsonPath)) return undefined;
  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: string };
    return semver.valid(pkg.version ?? '') ?? undefined;
  } catch {
    return undefined;
  }
}

/** Returns the default path to the generated package.json in outDir. */
export function getPackageJsonPath(outDir: string): string {
  return join(outDir, 'package.json');
}
