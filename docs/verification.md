# Verification and coverage limits

This document describes verification criteria for version 0.1.0 and separately records completed local native runs. It does not claim that every listed check or CI has passed.

## Basic commands

Use Node.js >=22.18.0, npm, and Bun 1.4.4. The runtime test in `npm test` starts Bun with browser conditions for reactive Solid. CI uses Node.js 22.19.0 and 24, with Bun pinned to 1.4.4.

```sh
npm ci --ignore-scripts
npm run typecheck
npm run build
npm test
npm run test:dependencies
bun test/native/core-081.ts
node test/package-smoke.mjs
npm audit --audit-level=moderate
npm pack --dry-run
```

Inspect the archive: compiled `dist`, license, and documentation must be present; local settings, private paths, secrets, and temporary artifacts must be absent. `prepack` runs type checking and the build, but not unit tests.

The OpenTUI core probe checks library version 0.8.1 without starting OpenCode. The package smoke test builds a tarball and installs it in a temporary consumer, requiring public npm registry access. CI runs both steps, but not the full native OpenCode harness. The audit with a moderate threshold remains required; findings are not suppressed. Record final dependency-graph and consumer checks after package changes separately from the native runs below.

The OpenCode 2.2.5 SDK is development-only and is not part of the consumer dependency graph. `npm run test:dependencies` checks compatibility and security regressions in the root development graph with pinned overrides. Root `npm audit --audit-level=moderate` checks the full development graph; the package smoke test separately checks imports, public types, and the audit of a clean consumer without SDK/OpenTUI. Passing one check does not replace the other.

## Native verification

Use Python 3 with its standard library, installed dependencies, and an explicitly supplied OpenCode 2.2.5 or 2.2.7 executable. Point to the binary itself, not a shell launcher. The commands below match the CLI of `test/native/run.py`. Results from an earlier prototype do not replace verification of the current package.

In an activated Python virtual environment:

```sh
export OPENCODE_BINARY=/path/to/opencode
python --version
python test/native/run.py --opencode "${OPENCODE_BINARY}" --temp-parent "${TMPDIR:-/tmp}" --mode null
python test/native/run.py --opencode "${OPENCODE_BINARY}" --temp-parent "${TMPDIR:-/tmp}" --mode alpha --animations
python test/native/run.py --opencode "${OPENCODE_BINARY}" --temp-parent "${TMPDIR:-/tmp}" --mode text --animations --theme
python test/native/run.py --opencode "${OPENCODE_BINARY}" --temp-parent "${TMPDIR:-/tmp}" --mode drag
```

`--temp-parent` must point to an existing directory. Each run creates a private subdirectory and prints its path; results are in `result.json` and `cleanup.json`. Check the exit code, every assertion, listener closure, and the absence of remaining child processes. Supply the binary explicitly; its source and availability are not assumed.

The production entry uses the internal `createProviderColors` factory: version 2.2.5 or 2.2.7, `rgb: true`, and valid options are checked before registering listeners and the app slot. Supported versions are checked by the shared `supportsVersion` function, including during row processing. The native fixture calls the same factory directly; it does not use production global hooks.

The harness targets POSIX (macOS/Linux). This is a harness limitation, not proof of plugin incompatibility with Windows. Checks use isolated configuration without changing the user's working installation.

### Recorded local runs

November 9, 2026, macOS, OpenCode 2.2.5, Bun 1.4.4, Python 3.8.10:

| Mode | Additional flags | Passing assertions |
| --- | --- | --- |
| `null` | None | 110 |
| `alpha` | `--animations` | 177 |
| `text` | `--animations --theme` | 196 |

In all three runs, child process groups were empty after completion and the listener was closed. These are local results for that stage, not CI results or verification of later dependency changes. Record tarball installation in a consumer separately.

On November 11, 2026, the checks were repeated on macOS with real OpenCode 2.2.7 and Python 3.13.18: `null` 110/110, `alpha --animations` 177/177, and `text --animations --theme` 196/196. Independent version gates at startup and during row processing were corrected; color algorithms did not change. Support for 2.2.5 was retained; its native results above refer to the earlier run. Verification of 2.2.7 does not imply support for untested intermediate or future versions.

### Dragging

On November 14, 2026, the installed local npm archive for 0.1.0 was checked on real OpenCode 2.2.5 and 2.2.7: each version passed `null` 110, `alpha` 177, `text` 196, and `drag` 49 assertions. Each version also passed 6 separate public-entry checks covering loading, color application, and restoration of native rendering after disabling the plugin. This was local archive verification before publication, not installation from the public npm registry.

On OpenCode 2.2.7, `--mode drag` checks real mouse input through a PTY: grabbing, moving across neighbors, releasing, cancelling reordering by returning to the original position, two providers, custom drag colors, `null` inheritance, alpha, and mouse-hook restoration. On November 11, 2026, 49 assertions passed. `null` 110/110, `alpha` 177/177, and `text` 196/196 were repeated. This scenario does not check cancellation with Escape.

### Verification matrix

| Area | Required coverage |
| --- | --- |
| Loading | Built package directory and `./tui` export |
| Compatibility | 2.2.5 or 2.2.7 with RGB enables processing; other versions or missing RGB leave the UI unchanged |
| Palette | Six base and three drag fields; RGB, RGBA, `null`; missing required `bg`; invalid values |
| Alpha | `00` and `FF`; blending with native backgrounds; final text and preservation of fade/glow |
| Inheritance | Missing active/hover fields use `bg`; explicit `null` preserves the native state |
| Defaults | Only `openai` has a built-in palette: removing its entry restores it; six `null` fields retain native rendering. Other providers require explicit configuration |
| Registry | Actual SDK IDs and names, registry updates, missing palettes |
| States | Idle, active, hovered, and expanded rows; native state priority |
| Attention | Native inactive-row background; preservation of configured session/project foregrounds |
| Safe fallback | Duplicate titles and ambiguous or unknown mappings |
| Lifecycle | Data updates, row removal, and plugin disposal without leftover hooks |
| Packaging | Local tarball installation and loading its `./tui` in an isolated environment |

## Recording results

Record the package, OpenCode, Node.js, Bun, and Python versions, OS, command, exit code, and checked scenarios. Distinguish unit tests, type checking, builds, the OpenTUI core probe, packaging, and real UI checks. Do not claim Linux or Windows coverage without a separate run, or describe manual inspection as an automated check.
