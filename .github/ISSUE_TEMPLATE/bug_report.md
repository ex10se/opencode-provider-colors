---
name: Rendering bug
about: Sanitized report of a rendering bug or incompatibility
title: ''
labels: ''
assignees: ''
---

## Environment

- Package version or commit:
- OpenCode version:
- OS and terminal:
- Theme:
- RGB capability, if known:

## Expected and actual behavior

Describe the difference without including private session content.

## Reproduction

1. Conditions and sequence of actions
2. Row state: idle, active, hovered, expanded, requiring attention
3. Result

## Minimal configuration

Include only options relevant to this plugin. Anonymize private provider IDs, paths, and project names. Do not attach a complete `cli.json`, session messages, tokens, or internal infrastructure addresses. State whether the palette key matches the actual provider ID without disclosing the private ID.

## Additional checks

- Does the issue persist after rebuilding and restarting the TUI?
- Are there duplicate session titles?
- Does the issue persist without other plugins in an isolated configuration?

Sanitize screenshots and logs before attaching them. For vulnerabilities, follow [SECURITY.md](../../SECURITY.md); do not publish exploitation details.
