# AGENTS.md

Guidelines for AI agents contributing to this repository.

## Project Overview

**typeship** is a TypeScript library that extracts types marked with `/** @publish */` JSDoc tags from a TypeScript project and generates a standalone, publishable npm package containing those types as `.d.ts` declaration files.

### Pipeline

```
Source files → Scan (find @publish) → Extract (collect deps, convert kinds) → Emit (write files) → Output Package
```

## Repository Structure

```
src/
├── cli/                 # CLI entry point and commands (commander-based)
│   ├── index.ts         # CLI entry, reads version from package.json
│   ├── logger.ts        # Colored console output via picocolors
│   └── commands/
│       └── generate.ts  # Main `typeship generate` command
├── core/                # Core extraction pipeline (depends on ts-morph)
│   ├── index.ts         # Re-exports scan, extract, emit
│   ├── scanner.ts       # Loads a TS project and finds publishable nodes
│   ├── extractor.ts     # Extracts declarations into .d.ts content (largest file)
│   └── emitter.ts       # Writes .d.ts files to disk with grouping strategies
├── markers/             # Publish marker detection (JSDoc-based)
│   ├── index.ts         # Re-exports
│   └── jsdoc.ts         # hasPublishJsDoc(), findPublishableNodes()
├── generator/           # Output package scaffolding
│   ├── index.ts         # Re-exports
│   ├── package-json.ts  # Generates package.json with semver bumping
│   └── tsconfig.ts      # Generates tsconfig.json for the output package
├── plugin/
│   └── index.cts        # TS Language Service plugin (@publish tag completions)
├── config.ts            # Config file loading (typeship.config.json)
├── index.ts             # Main entry point (generator + config exports)
└── core-entry.ts        # Core entry point (pipeline + markers, for /core subpath)

tests/                   # Vitest unit tests
├── core/
│   ├── extractor.test.ts
│   ├── extractor-extends.test.ts
│   └── emitter.test.ts
├── generator/
│   └── package-json.test.ts
├── markers/
│   └── jsdoc.test.ts
└── fixtures/            # Test fixture projects

templates/
└── github-actions.yml   # CI workflow template for consumers
```

## Package Exports

The package exposes three subpath exports:

- `@arompr/typeship` — Generator utilities and config (no ts-morph dependency)
- `@arompr/typeship/core` — Full pipeline: scan, extract, emit, and marker detection (requires ts-morph)
- `@arompr/typeship/plugin` — TypeScript Language Service plugin (CJS)

## Coding Conventions

- **Language**: TypeScript (strict mode, ES2022 target)
- **Module system**: ESM (with CJS builds via tsup for compatibility)
- **Style**: No semicolons are omitted; use semicolons. Use single quotes for strings.
- **Formatting**: 2-space indentation
- **Types**: Prefer explicit type annotations on public APIs. Use `type` imports where possible.
- **Error handling**: Throw `Error` objects with descriptive messages. CLI catches at the top level.
- **No decorators**: The codebase does not use TypeScript decorators. The only marking mechanism is `/** @publish */` JSDoc tags.

## Build & Test

```bash
npm run build        # Build with tsup (ESM + CJS + DTS)
npm run typecheck    # Type-check without emit
npm test             # Run all tests with vitest
npm run test:watch   # Watch mode
```

### Build Script

The build script (`tsup`) produces four bundles:
1. Main entry (`src/index.ts`) → ESM + CJS + DTS
2. Core entry (`src/core-entry.ts`) → ESM + CJS + DTS
3. CLI (`src/cli/index.ts`) → ESM only
4. Plugin (`src/plugin/index.cts`) → CJS + DTS

A post-build step rewrites the plugin's `.d.cts` to use `export =` syntax.

## Testing

- **Framework**: Vitest
- **Pattern**: Tests live in `tests/` mirroring the `src/` structure
- **Fixtures**: `tests/fixtures/` contains multi-file TypeScript projects for integration tests
- **In-memory projects**: Most extractor tests use `ts-morph`'s `useInMemoryFileSystem` to avoid disk I/O
- **Test naming**: Descriptive `it('...')` strings; group related tests with `describe`

## Key Design Decisions

1. **JSDoc-only marking**: Types are marked for publication exclusively via `/** @publish */` or `/** @typeship */` JSDoc tags. No runtime decorators.
2. **Declaration mapping**: The extractor can convert between TypeScript construct kinds (interface ↔ type alias ↔ class). Enums are always preserved.
3. **Cross-file dependency validation**: If a published type references another type via a relative import, that type must also be marked `@publish`. Violations produce fatal diagnostics.
4. **Collision detection**: Duplicate type names across files are detected and reported.
5. **Output grouping**: Files can be grouped per-file, merged into a single file, or grouped by custom glob patterns.

## Dependencies

- **ts-morph** — TypeScript AST manipulation (core pipeline)
- **commander** — CLI framework
- **picocolors** — Terminal colors
- **semver** — Version bumping
- **minimatch** — Glob pattern matching for output grouping
