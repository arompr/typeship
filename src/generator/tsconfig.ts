export interface GeneratedTsConfig {
  compilerOptions: {
    target: string;
    module: string;
    moduleResolution: string;
    declaration: boolean;
    declarationMap: boolean;
    outDir: string;
    rootDir: string;
    strict: boolean;
    esModuleInterop: boolean;
    skipLibCheck: boolean;
  };
  include: string[];
  exclude: string[];
}

/**
 * Generates a tsconfig.json for the extracted types package.
 * The config is set up for declaration emit (consumers can compile .ts sources).
 */
export function generateTsConfig(): GeneratedTsConfig {
  return {
    compilerOptions: {
      target: 'ES2020',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      declaration: true,
      declarationMap: true,
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  };
}
