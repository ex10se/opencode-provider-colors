# opencode-provider-colors

[Russian README](README.ru.md)

Provider-aware backgrounds and text colors for the OpenCode TUI. Configure session rows, project labels, and provider labels with RGB or RGBA colors, or retain native colors per field.

## Installation

### Requirements

- OpenCode 2.2.5 or 2.2.7, with renderer capability `rgb: true`. Other versions leave the interface unchanged
- Node.js >=22.18.0 and npm for building
- The implementation depends on the UI internals verified on OpenCode 2.2.5 and 2.2.7. Unrecognized or ambiguous UI mappings retain native rendering
- The native verification harness targets POSIX environments (macOS/Linux); that is not a claim about Windows runtime support

### Package or source checkout

To install version 0.1.0 from npm into a directory of your choice:

```sh
npm install --prefix ./provider-colors opencode-provider-colors@0.1.0
```

Set the plugin `package` to the absolute path of `provider-colors/node_modules/opencode-provider-colors` in your existing `cli.json`. The configuration example below also applies to the installed package. No source build is needed for an npm installation.

From the source checkout:

```sh
npm ci --ignore-scripts
npm run build
pwd
```

Add the following entry to the existing `plugins` array in `cli.json`. Replace the example path with the absolute checkout directory printed by `pwd`. Preserve your other settings and plugins.

```json
{
  "plugins": [
    {
      "package": "/absolute/path/to/opencode-provider-colors",
      "options": {
        "providerColors": {
          "openai": {
            "bg": "#B8EEE41A",
            "activeBg": "#B8EEE40D",
            "hoverBg": "#B8EEE403",
            "sessionFg": null,
            "projectFg": null,
            "providerFg": "#B8EEE4"
          }
        }
      }
    }
  ]
}
```

Use the package directory, not `src` or `dist/tui.js`. JSON does not automatically expand `$PWD` or `~`. The ESM package exports `opencode-provider-colors/tui` from `dist`. Rebuild after source changes and restart the TUI after installation or configuration changes.

## Behavior

- Outside drag, native hover, active, and expanded-state priority is preserved
- Outside drag, inactive rows requiring attention keep the native background; configured session/project text colors still apply
- Colors do not change models, provider connections, session content, or notification behavior
- Drag styling applies only to the dragged row and takes priority over hover. On release, normal state styling returns

## Options

`providerColors` keys are exact provider IDs, not display names. Display names come reactively from the SDK provider registry; the plugin does not configure or rename providers.

Each object palette requires `bg`. All color fields accept `#RRGGBB`, `#RRGGBBAA`, or `null`:

| Field | Meaning | Omitted / `null` |
| --- | --- | --- |
| `bg` | Idle row background | Required / native idle background |
| `activeBg` | Active row background | Uses `bg` / native active background |
| `hoverBg` | Hovered row background | Uses `bg` / native hover background |
| `sessionFg` | Session title text | Native text |
| `projectFg` | Project label text | Native text |
| `providerFg` | Provider label text | Native text |
| `dragBg` | Dragged row background | Inherit `activeBg` |
| `dragSessionFg` | Dragged session title | Inherit `sessionFg` |
| `dragProjectFg` | Dragged project text | Inherit `projectFg` |

Background alpha blends with the host background for the current state. Text alpha is applied at the final rendered cell, preserving native fade/glow. Alpha `00` means transparent, not “use native text”; use `null` for native text.

The only built-in legacy color is `openai: "#B8EEE4"`. Other providers retain native rendering unless explicitly configured. Options merge with this default: removing the `openai` entry restores its default, not native rendering. To retain native colors for this default provider, set all six fields to `null`:

```json
{
  "providerColors": {
    "openai": {
      "bg": null,
      "activeBg": null,
      "hoverBg": null,
      "sessionFg": null,
      "projectFg": null,
      "providerFg": null
    }
  }
}
```

Providers without a palette retain native colors. Legacy `"provider-id": "#RRGGBB"` entries remain supported; eight-digit strings require the object form. Legacy `providerRowOpacity` does not change object-palette alpha. See the [full configuration reference](docs/configuration.md).

Missing or `null` drag fields inherit `activeBg`, `sessionFg`, and `projectFg`, respectively. Missing `activeBg` inherits `bg`; explicit `null` preserves the native active surface.

## Troubleshooting

If colors are missing, check the OpenCode version, RGB capability, exact provider ID, configuration validity, build output, and package path. Restart the TUI after configuration changes. A native fallback can be intentional; see [verification](docs/verification.md).

## Limitations

- Only OpenCode 2.2.5 and 2.2.7 with RGB are supported; this is not a version range
- Duplicate titles or uncertain provider-to-row mappings fall back to native rendering rather than guessing
- Invalid palette or opacity options leave the plugin inactive
- Native UI checks target POSIX; Windows runtime support has not been established
- The drag scenario does not verify cancellation with Escape

## Design decisions

The plugin keeps native rendering when it cannot safely identify a row, uses exact provider IDs with reactive SDK names, and distinguishes transparent colors from native colors. See [design decisions and tradeoffs](docs/design.md).

## Development

Install Node.js >=22.18.0, npm, and Bun 1.4.4 first, then run `npm ci --ignore-scripts`. CI checks Node.js 22.19.0 and 24 with this pinned Bun version. `npm test` includes a runtime test that starts Bun with browser conditions for Solid.

The OpenCode SDK is a development-only dependency pinned to 2.2.5. Its used API is also verified against the actual OpenCode 2.2.7 runtime. The packed consumer does not install the SDK or OpenTUI. Supported host versions are 2.2.5 and 2.2.7. Dependency regression tests check the root development graph. The root `npm audit` and the isolated consumer audit in the package smoke test are separate checks.

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

These are verification commands, not a claim that this checkout has passed them. The package smoke test creates and installs a local tarball in an isolated temporary consumer and needs public npm registry access. The OpenTUI core probe does not start OpenCode. Full native UI checks require a separately supplied OpenCode 2.2.5 or 2.2.7 executable and Python 3 (standard library only) on POSIX; they are not run in CI. Commands, recorded environments and verification limits are documented in [verification](docs/verification.md).

- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [Local package preparation](docs/releasing.md)
- [Changelog](CHANGELOG.md)

## License

[MIT](LICENSE), copyright 2026 Mikhail Belyakov
