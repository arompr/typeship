import type * as ts from 'typescript/lib/tsserverlibrary';

/**
 * TypeScript Language Service plugin for typeship.
 *
 * Adds `@publish` to JSDoc tag completions and provides hover documentation.
 *
 * Enable by adding to your tsconfig.json:
 * ```json
 * {
 *   "compilerOptions": {
 *     "plugins": [{ "name": "@arompr/typeship/plugin" }]
 *   }
 * }
 * ```
 *
 * Note: VS Code uses its own bundled TypeScript by default. To activate plugins,
 * open the command palette and select "TypeScript: Select TypeScript Version" →
 * "Use Workspace Version".
 */
function init(modules: { typescript: typeof ts }) {
  function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
    const proxy = Object.create(null) as ts.LanguageService;
    const ls = info.languageService;

    for (const k of Object.keys(ls) as Array<keyof ts.LanguageService>) {
      (proxy as any)[k] = (...args: any[]) => (ls as any)[k](...args);
    }

    proxy.getCompletionsAtPosition = (fileName, position, options, settings) => {
      const prior = ls.getCompletionsAtPosition(fileName, position, options, settings);
      if (!prior) return prior;

      // Detect JSDoc tag context by the presence of built-in JSDoc tag completions.
      const isJsDocContext = prior.entries.some(
        (e) =>
          e.kind === modules.typescript.ScriptElementKind.keyword &&
          ['param', 'returns', 'type', 'example', 'remarks'].includes(e.name),
      );

      if (isJsDocContext && !prior.entries.some((e) => e.name === 'publish')) {
        prior.entries.push({
          name: 'publish',
          kind: modules.typescript.ScriptElementKind.keyword,
          kindModifiers: '',
          sortText: 'z_publish',
          insertText: 'publish',
        });
      }

      return prior;
    };

    proxy.getCompletionEntryDetails = (
      fileName,
      position,
      entryName,
      formatOptions,
      source,
      preferences,
      data,
    ) => {
      if (entryName === 'publish') {
        return {
          name: 'publish',
          kind: modules.typescript.ScriptElementKind.keyword,
          kindModifiers: '',
          displayParts: [{ text: '@publish', kind: 'text' }],
          documentation: [
            {
              text: 'Marks this declaration for extraction and publication by typeship. Run `typeship generate` to emit it into your published package.',
              kind: 'text',
            },
          ],
          tags: [],
        };
      }
      return ls.getCompletionEntryDetails(
        fileName,
        position,
        entryName,
        formatOptions,
        source,
        preferences,
        data,
      );
    };

    return proxy;
  }

  return { create };
}

export = init;
