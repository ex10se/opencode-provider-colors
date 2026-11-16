# Package preparation and release

Instructions for preparing, verifying, and manually publishing version 0.1.0.

## Preflight checks

1. Verify the version, name, ESM export `./tui`, and file list in `package.json`
2. Check the MIT license: copyright 2026 Mikhail Belyakov
3. Check both READMEs, the configuration reference, and CHANGELOG against the implementation
4. Run the commands below and the native checks in the [verification matrix](verification.md)

```sh
npm ci --ignore-scripts
npm test
npm run test:dependencies
npm run typecheck
npm run build
bun test/native/core-081.ts
node test/package-smoke.mjs
npm audit --audit-level=moderate
npm pack --dry-run
```

Do not consider the package ready while native verification is incomplete. Inspect the `npm pack --dry-run` file list: exclude user configurations, secrets, private local paths, and temporary data.

## Local archive

If needed, create an archive after verification:

```sh
npm pack
```

For version 0.1.0, the expected filename is `opencode-provider-colors-0.1.0.tgz`. Check the actual command output. `prepack` repeats type checking and the build, but not tests.

Install the archive in a separate empty directory without changing your working installation:

```sh
npm install --ignore-scripts /absolute/path/to/opencode-provider-colors-0.1.0.tgz
```

Use the absolute path to the actual archive. In an isolated `cli.json`, point to the installed package directory ending in `node_modules/opencode-provider-colors`, not to an individual file in `dist`. Verify the public entry in real OpenCode 2.2.5 and 2.2.7 with RGB. Installing the archive alone does not establish correct UI behavior.

## First publication of 0.1.0

1. Commit the verified code to `main`, push it to GitHub, and wait for successful CI on Node.js 22 and 24
2. Make the repository public before release
3. Run `npm login --registry=https://registry.npmjs.org` and check the account with `npm whoami --registry=https://registry.npmjs.org`
4. Rebuild the archive from the verified commit and inspect its contents
5. Publish the verified archive: `npm publish ./opencode-provider-colors-0.1.0.tgz --access public --registry=https://registry.npmjs.org`
6. Create the `v0.1.0` tag on the verified commit and a GitHub Release with release notes and the package archive
7. Install `opencode-provider-colors@0.1.0` from npm in a clean directory and repeat the public-entry check in real OpenCode

The first publication is manual; CI runs checks but does not publish the package. Do not store npm tokens in the repository. A published version cannot be replaced with different contents; release fixes under a new version.

## Restoring the previous configuration

Back up your configuration before changing it. To disable the plugin, remove only its entry from `plugins` and restart the TUI; leave other plugins unchanged. To restore a previous local build, restore its package directory or the path to it. Removing a single `providerColors` entry does not disable the built-in palette.
