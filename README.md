# typeship

> Extract and publish TypeScript types from your project — automatically.

`typeship` solves a common full-stack TypeScript problem: keeping backend and frontend types in sync without manual duplication or monorepo constraints.

Mark a type with `/** @publish */`, run `npx typeship generate`, and get a ready-to-publish npm package.

## Quick Start

```bash
npm install --save-dev @arompr/typeship
```

### 1. Mark your types

Add the `@publish` JSDoc tag to any interface, type, class, or enum:

```ts
/** @publish */
export interface UserDto {
  id: string;
  email: string;
  role: 'admin' | 'user';
}

/** @publish */
export type UserId = string;
```

### 2. Generate the package

```bash
npx typeship generate --package-name @my-org/api-types
```

This creates a `./generated/` directory:

```
generated/
├── src/
│   ├── index.ts        ← barrel re-exports everything
│   ├── user.dto.ts
│   └── ...
├── package.json
└── tsconfig.json
```

### 3. Publish

```bash
cd generated && npm install && npm publish
```

### 4. Consume on the frontend

```bash
npm install @my-org/api-types
```

```ts
import type { UserDto } from '@my-org/api-types';
```

## CLI Reference

```
Usage: typeship generate [options]

Options:
  -o, --out-dir <path>        Output directory (default: ./generated)
  -n, --package-name <name>   Package name, e.g. @my-org/api-types  [required]
  -r, --registry <url>        npm registry URL
  -b, --bump <level>          Version bump: patch | minor | major
      --dry-run               Preview without writing files
      --tsconfig <path>       Path to project tsconfig.json (default: ./tsconfig.json)
  -c, --config <path>         Path to typeship.config.json
  -v, --version               Show version
  -h, --help                  Show help
```

## Config File

Create `typeship.config.json` (or `.typeshiprc.json`) in your project root:

```json
{
  "packageName": "@my-org/api-types",
  "outDir": "./generated",
  "registry": "https://npm.pkg.github.com",
  "bump": "patch",
  "tsConfig": "./tsconfig.json",
  "declarationMapping": "preserve",
  "outputGrouping": "per-file"
}
```

CLI flags always override config file values.

| Option | Type | Default | Description |
|---|---|---|---|
| `packageName` | `string` | — | **Required.** Package name for the generated package |
| `outDir` | `string` | `./generated` | Output directory |
| `registry` | `string` | `https://registry.npmjs.org` | npm registry URL |
| `bump` | `patch \| minor \| major` | — | Semver bump to apply on each generation |
| `tsConfig` | `string` | `tsconfig.json` | Path to the project's `tsconfig.json` |
| `declarationMapping` | `preserve \| type \| interface \| class` | `preserve` | Normalize declarations to a single TypeScript construct kind |
| `outputGrouping` | `per-file \| single \| Record<string, string[]>` | `per-file` | Controls how declarations are grouped into output files |

## Programmatic API

```ts
import { scan, extract, emit, generatePackageJson, generateTsConfig } from '@arompr/typeship/core';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const results = scan({ tsConfigFilePath: './tsconfig.json' });
const extraction = extract(results);
const emitResult = emit(extraction, { outDir: './generated' });

const pkg = generatePackageJson({ name: '@my-org/api-types', bump: 'patch' });
mkdirSync('./generated', { recursive: true });
writeFileSync('./generated/package.json', JSON.stringify(pkg, null, 2));
writeFileSync('./generated/tsconfig.json', JSON.stringify(generateTsConfig(), null, 2));
```

## CI Integration

A GitHub Actions workflow template is included at `templates/github-actions.yml`. Copy it to `.github/workflows/publish-types.yml` to auto-publish types on every push to `main`.

## License

MIT
