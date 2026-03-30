import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Command } from 'commander';
import { loadConfig } from '../../config.js';
import { scan } from '../../core/scanner.js';
import { extract } from '../../core/extractor.js';
import { emit } from '../../core/emitter.js';
import {
  generatePackageJson,
  getPackageJsonPath,
} from '../../generator/index.js';
import { log } from '../logger.js';
import pc from 'picocolors';

export function makeGenerateCommand(): Command {
  const cmd = new Command('generate');

  cmd
    .description('Scan the project, extract publishable types, and generate a ready-to-publish package')
    .option('-o, --out-dir <path>', 'Output directory for the generated package')
    .option('-n, --package-name <name>', 'Package name (e.g. @my-org/api-types)')
    .option('-r, --registry <url>', 'npm registry URL')
    .option('-b, --bump <level>', 'Semver bump: patch | minor | major')
    .option('--dry-run', 'Preview what would be generated without writing files')
    .option('--tsconfig <path>', 'Path to tsconfig.json of the project to scan')
    .option('-c, --config <path>', 'Path to typeship.config.json')
    .action(async (opts: {
      outDir?: string;
      packageName?: string;
      registry?: string;
      bump?: string;
      dryRun?: boolean;
      tsconfig?: string;
      config?: string;
    }) => {
      try {
        const cwd = process.cwd();

        // Load file config, then override with CLI flags
        const fileConfig = loadConfig(opts.config ? resolve(opts.config, '..') : cwd);
        const outDir = resolve(cwd, opts.outDir ?? fileConfig.outDir ?? 'generated');
        const packageName = opts.packageName ?? fileConfig.packageName;
        const registry = opts.registry ?? fileConfig.registry;
        const bump = (opts.bump ?? fileConfig.bump) as 'patch' | 'minor' | 'major' | undefined;
        const dryRun = opts.dryRun ?? false;
        const tsConfigPath = resolve(
          cwd,
          opts.tsconfig ?? fileConfig.tsConfig ?? 'tsconfig.json',
        );

        if (!packageName) {
          log.error('Package name is required. Use --package-name or set "packageName" in typeship.config.json');
          process.exit(1);
        }

        if (bump && !['patch', 'minor', 'major'].includes(bump)) {
          log.error(`Invalid --bump value: "${bump}". Must be patch, minor, or major.`);
          process.exit(1);
        }

        log.info(`Scanning project: ${pc.bold(tsConfigPath)}`);
        const scanResults = scan({ tsConfigFilePath: tsConfigPath });
        const totalNodes = scanResults.reduce((n, r) => n + r.nodes.length, 0);
        log.success(`Found ${pc.bold(String(totalNodes))} publishable node(s) in ${pc.bold(String(scanResults.length))} file(s)`);

        if (scanResults.length === 0) {
          log.warn('No publishable types found. Add @Publish() or /** @publish */ to your types.');
          process.exit(0);
        }

        log.info('Extracting types...');
        const extraction = extract(scanResults, {
          ...(fileConfig.declarationMapping !== undefined && { declarationMapping: fileConfig.declarationMapping }),
        });

        if (extraction.diagnostics.length > 0) {
          for (const d of extraction.diagnostics) {
            log.error(
              `Type ${pc.bold(d.typeName)} is used by a published type but is not marked @publish.\n` +
              `  Add ${pc.cyan('/** @publish */')} to ${pc.bold(d.typeName)} in ${d.filePath}`,
            );
          }
          log.error(`${extraction.diagnostics.length} type dependency error(s) found. Fix the above and re-run.`);
          process.exit(1);
        }

        if (extraction.warnings.length > 0) {
          for (const w of extraction.warnings) {
            log.warn(
              `Type ${pc.bold(w.typeName)} in ${w.filePath} could not be converted to the requested declaration kind — emitted as-is.`,
            );
          }
        }

        if (extraction.collisions.length > 0) {
          for (const c of extraction.collisions) {
            log.error(
              `Type name collision: ${pc.bold(c.typeName)} is published by ${c.filePaths.length} files — duplicate declarations are not supported:\n` +
              c.filePaths.map((p) => `  • ${p}`).join('\n'),
            );
          }
          log.error(
            `${extraction.collisions.length} type name collision(s) found. Rename the conflicting types and re-run.`,
          );
          process.exit(1);
        }

        log.info(`Generating package to: ${pc.bold(outDir)}`);

        if (dryRun) {
          log.warn('Dry run mode — no files will be written.');
        }

        // Emit source files
        const emitResult = emit(extraction, {
          outDir,
          dryRun,
          ...(fileConfig.outputGrouping !== undefined && { outputGrouping: fileConfig.outputGrouping }),
        });

        // Generate package.json
        const pkgJsonPath = getPackageJsonPath(outDir);
        const pkgJson = generatePackageJson({
          name: packageName,
          ...(registry !== undefined && { registry }),
          ...(bump !== undefined && { bump }),
          existingPackageJsonPath: pkgJsonPath,
        });
        const pkgJsonContent = JSON.stringify(pkgJson, null, 2) + '\n';

        if (!dryRun) {
          mkdirSync(outDir, { recursive: true });
          writeFileSync(pkgJsonPath, pkgJsonContent, 'utf8');
        }

        // Print summary
        const allFiles = [
          ...emitResult.files,
          { path: pkgJsonPath, content: pkgJsonContent },
        ];

        for (const f of allFiles) {
          log.dim(`  ${dryRun ? '[dry]' : '+'} ${f.path}`);
        }

        log.success(
          dryRun
            ? `Dry run complete — ${allFiles.length} file(s) would be generated`
            : `Package generated at ${pc.bold(outDir)} (v${pkgJson.version})`,
        );

        if (!dryRun) {
          log.info(`Next: cd ${outDir} && npm install && npm publish`);
        }
      } catch (err) {
        log.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  return cmd;
}
