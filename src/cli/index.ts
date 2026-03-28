#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { makeGenerateCommand } from './commands/generate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, '../../package.json'), 'utf8'),
    ) as { version: string };
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

const program = new Command('typeship')
  .description('Extract and publish TypeScript types from your project')
  .version(getVersion(), '-v, --version')
  .addCommand(makeGenerateCommand());

program.parse(process.argv);
