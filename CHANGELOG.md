# Changelog

## 0.1.0 - Unreleased

- Added the ESM package `opencode-provider-colors` with the `./tui` export
- Added palettes keyed by exact provider IDs and reactive names from the SDK registry
- Added six base background/text fields and three drag fields with RGB, RGBA, and `null`
- Preserved colors during dragging; added `dragBg`, `dragSessionFg`, and `dragProjectFg` with active-background and base-text inheritance
- Retained legacy RGB string palettes and `providerRowOpacity`
- Kept `openai` as the only built-in color; other providers require explicit configuration
- Supported OpenCode 2.2.5 and 2.2.7 with RGB; unknown versions and ambiguous mappings retain native rendering
- Added local build, configuration, and verification instructions

This section describes release preparation, not publication or final verification results.
