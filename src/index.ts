// Markers
export { Publish, isPublished } from './markers/index.js';
export type {} from './markers/index.js';

// Core pipeline
export { scan, extract, emit } from './core/index.js';
export type {
  ScanResult,
  ScannerOptions,
  ExtractedFile,
  ExtractionResult,
  EmitterOptions,
  EmittedFile,
  EmitResult,
} from './core/index.js';

// Generators
export {
  generatePackageJson,
  generateTsConfig,
  readExistingVersion,
  getPackageJsonPath,
} from './generator/index.js';
export type {
  PackageJsonOptions,
  GeneratedPackageJson,
  GeneratedTsConfig,
} from './generator/index.js';

// Config
export { loadConfig } from './config.js';
export type { TypeshipConfig } from './config.js';
