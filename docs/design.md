# Design decisions

## Exact provider IDs, reactive display names

- Problem: display names can change and are not reliable configuration keys
- Decision: key palettes by exact provider IDs and obtain display names reactively from the SDK registry
- Tradeoff: users must find the actual provider ID; the plugin does not register or rename providers

## Conservative compatibility and row matching

- Problem: coloring depends on internal UI structures, and duplicate titles can make provider-to-row mappings ambiguous
- Decision: support only the verified OpenCode versions 2.2.5 and 2.2.7 with RGB capability, and retain native rendering for unknown or ambiguous mappings
- Tradeoff: some rows or newer host versions may remain uncolored rather than risk applying another provider's palette

## Native rendering and alpha are different choices

- Problem: a transparent color and an untouched native color have different meanings, especially with text fade and glow
- Decision: use `null` for native base colors, blend background alpha with the current native surface, and apply text alpha at the final rendered cell
- Tradeoff: `00` does not restore native text; users must choose `null` explicitly. Object palettes require `bg`, and omitted active/hover backgrounds inherit it

## Drag styling without losing ordinary state behavior

- Problem: a dragged row needs consistent colors while native hover, active, and attention states must remain meaningful outside dragging
- Decision: apply optional drag fields only to the dragged row, with priority over hover. Missing or `null` drag fields inherit active background and base text colors; restore normal state styling on release
- Tradeoff: drag `null` means inheritance, not an independent native-color override. A native drag background requires a native inherited active background. Outside drag, inactive attention rows retain their native background while configured session/project text colors still apply

## Backward-compatible palettes

- Problem: existing string palettes and opacity options must keep their meaning alongside per-field RGBA configuration
- Decision: retain six-digit legacy strings and `providerRowOpacity`; object palettes specify alpha directly. Merge user palettes with the single built-in `openai` color
- Tradeoff: removing the `openai` entry restores its default instead of disabling it. Full native rendering requires all six base fields to be `null`, with drag fields missing or `null`

## Separate package and host verification

- Problem: a valid package import does not prove that rendering works in a real OpenCode session
- Decision: export the built ESM `./tui` entry, keep the SDK development-only, and distinguish unit, dependency, core-library, package-consumer, and native UI checks
- Tradeoff: full UI verification needs an explicitly supplied supported OpenCode binary and a POSIX environment; it is not part of CI. See [verification and coverage limits](verification.md)
