# Native verification

The tests use public `@opentui/core@0.8.1` and real OpenCode 2.2.5 or 2.2.7 without copying host source code.

```sh
bun test/native/core-081.ts
python3 test/native/run.py --opencode /path/to/opencode --mode null
python3 test/native/run.py --opencode /path/to/opencode --mode alpha --animations
python3 test/native/run.py --opencode /path/to/opencode --mode text --animations --theme
python3 test/native/run.py --opencode /path/to/opencode --mode drag
```

- Install project dependencies and Bun 1.4.4 first; Python uses only its standard library. Recorded local runs used Python 3.8.10 and 3.13.18; see [verification and coverage limits](../../docs/verification.md) for the environments and dates. Prefer a maintained Python version for a new environment
- Supply the executable explicitly, not a shell wrapper. Its version is checked with `--version` in an isolated environment
- The harness requires POSIX facilities: PTYs, process groups, and `ps`. Windows without a POSIX environment is not supported by the harness; this does not establish plugin runtime incompatibility
- `--temp-parent /path` selects an existing directory for a private run root; the default is the system temporary directory
- HOME, XDG, TMPDIR, the working directory, and configuration are inside the new run root. The parent environment is not copied; only PATH is inherited
- The sentinel and canonical paths are checked before startup and before calling the production factory. Startup is refused outside the isolated run root
- The server listens only on loopback at a random port. No real credentials, providers, or user sessions are used. This is configuration isolation, not an OS network sandbox
- The driver uses `src/runtime.ts:createProviderColors(context)` and a local instance. The production entrypoint contains no test hooks
- `null` retains checks for nullable backgrounds and foregrounds in idle/hover/busy/unread/question/permission states; `alpha` checks RGB/RGBA, restoration, remounting, an unknown provider, and RGB-off; `text` runs the same checks with long titles and project fade
- `drag` checks real mouse input through a PTY: grabbing, moving across neighbors, releasing, cancelling reordering by returning to the original position, two providers, custom drag colors, `null` inheritance, alpha, and mouse-hook restoration. It does not check cancellation with Escape
- A permission request is created by the synthetic server and rejected; the command is not executed
- `result.json`, snapshots, and `cleanup.json` remain in the printed run root for diagnostics. Terminal output is not recorded. Processes in the test's own group are terminated and the listener is closed
- Existing user configuration and external journals are not modified. The run root can be removed after inspection

Run package verification separately, after building and finishing package manifest changes:

```sh
node test/package-smoke.mjs
```

It runs `npm pack --ignore-scripts` into a temporary directory and checks the allowlist, exports, import closure, and absence of local/debug artifacts. It then installs the tarball through npm in an isolated temporary consumer with lifecycle scripts disabled and access to the public npm registry. Checks cover imports through Bun, public types, and the consumer audit; SDK/OpenTUI are not installed in the consumer. This does not replace root `npm run test:dependencies` and `npm audit --audit-level=moderate`. Nothing is published.
