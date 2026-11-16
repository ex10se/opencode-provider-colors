# Contributing

Use Node.js >=22.18.0, npm, Bun 1.4.4, and a local checkout. Install dependencies with `npm ci --ignore-scripts`. `npm test` runs a runtime check through Bun with browser conditions for Solid. CI uses Node.js 22.19.0 and 24, with Bun pinned to 1.4.4.

## Before submitting changes

```sh
npm test
npm run test:dependencies
npm run typecheck
npm run build
bun test/native/core-081.ts
node test/package-smoke.mjs
npm audit --audit-level=moderate
npm pack --dry-run
```

`prepack` runs type checking and the build, but does not replace tests. Edit `src`, not `dist`, as the source of changes. Preserve the ESM export `./tui` and support for loading the package directory.

The package smoke test needs public npm registry access to install the tarball in a temporary consumer. Rendering changes also require native checks: POSIX, Python 3 with its standard library, and an explicitly supplied OpenCode 2.2.5 or 2.2.7 executable. See the [verification matrix](docs/verification.md) for commands, recorded environments, scenarios, and current limitations. The full native UI harness is not part of CI; unit tests and the OpenTUI core probe do not establish real TUI behavior.

Add regression tests for changed behavior. Preserve native rendering on unknown versions, without RGB, and when row mappings are ambiguous. Do not replace the provider registry with fixed display names.

All public documentation is written in English except `README.ru.md`, the Russian counterpart of `README.md`. Keep both READMEs semantically aligned. When changing the palette contract, update both READMEs, the configuration reference, and the changelog together.

Describe the problem, changed behavior, and checks actually performed. Do not include private session messages, tokens, private local paths, or corporate addresses in fixtures or reports. Remove identifying information from screenshots.
