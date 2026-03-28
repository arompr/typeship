# typeship

> Extract and publish TypeScript types from your project — automatically.

`typeship` solves a common full-stack TypeScript problem: keeping backend and frontend types in sync without manual duplication or monorepo constraints.

Mark a type as **publishable**, run `npx typeship generate`, and get a ready-to-publish npm package.

---

## Quick Start

`typeship` is published to GitHub Packages. Add the registry to your `.npmrc` first:

```
@arompr:registry=https://npm.pkg.github.com
```

Then install:

```bash
npm install --save-dev @arompr/typeship
```

### 1. Mark your types

**Option A — JSDoc tag** (works on interfaces, types, classes, enums):

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

**Option B — `@Publish()` decorator** (classes only):

```ts
import { Publish } from 'typeship';

@Publish()
export class CreateUserDto {
  name!: string;
  email!: string;
}
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

---

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

---

## Config File

Create `typeship.config.json` in your project root to avoid repeating CLI flags:

```json
{
  "packageName": "@my-org/api-types",
  "outDir": "./generated",
  "registry": "https://npm.pkg.github.com",
  "bump": "patch",
  "tsConfig": "./tsconfig.json"
}
```

CLI flags always override config file values.

---

## CI Integration — GitHub Actions

Copy `node_modules/typeship/templates/github-actions.yml` to `.github/workflows/publish-types.yml`:

```yaml
name: Publish Types

on:
  push:
    branches: [main]
    paths:
      - 'src/**/*.ts'
      - 'typeship.config.json'

jobs:
  publish-types:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://npm.pkg.github.com'
      - run: npm ci
      - run: npx typeship generate --bump patch
      - working-directory: ./generated
        run: npm install && npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Programmatic API

```ts
import { scan, extract, emit, generatePackageJson, generateTsConfig } from 'typeship';
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

---

## Example: NestJS Backend → Next.js Frontend

**Backend** (`src/users/user.dto.ts`):

```ts
import { Publish } from 'typeship';

@Publish()
export class UserDto {
  id!: string;
  email!: string;
  createdAt!: Date;
}
```

**Generate & publish:**

```bash
npx typeship generate --package-name @my-org/api-types --bump patch
cd generated && npm publish
```

**Frontend** (`pages/profile.tsx`):

```tsx
import type { UserDto } from '@my-org/api-types';

export default function Profile({ user }: { user: UserDto }) {
  return <div>{user.email}</div>;
}
```

No monorepo. No manual copying. Types stay in sync automatically.

---

## License

MIT
