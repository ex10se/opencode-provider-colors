# Color configuration

Pass parameters through `options` in the plugin entry in `cli.json`. See the [README](../README.md) for a complete installation example.

## Provider IDs and names

`providerColors` maps an exact provider ID to a palette. Display names come from the current SDK registry. A color does not define a name or register a provider. Replace `custom-provider` below with your actual provider ID:

```json
{
  "providerColors": {
    "custom-provider": {
      "bg": "#70A0D020",
      "activeBg": "#70A0D040",
      "hoverBg": null,
      "sessionFg": "#F0F0F0",
      "projectFg": "#B0D0FFCC",
      "providerFg": null
    }
  }
}
```

Without a palette, a provider retains native rendering. The only exception is the built-in `openai: "#B8EEE4"`: user options merge with this default rather than replacing the entire set. Every other provider ID requires an explicit palette.

## Object palettes

- `bg` is required, including `"bg": null`
- Missing `activeBg` and `hoverBg` inherit `bg`; explicit `null` preserves the native background of the corresponding state
- Missing or `null` `sessionFg`, `projectFg`, and `providerFg` preserve native text
- Missing or `null` `dragBg` inherits `activeBg`; missing `activeBg` inherits `bg`, while explicit `null` preserves the native active background
- Missing or `null` `dragSessionFg` and `dragProjectFg` inherit `sessionFg` and `projectFg`; a missing or `null` base field preserves native text
- Drag fields apply only during dragging and take priority over hover; normal state styling returns on release
- Color values are `#RRGGBB` or `#RRGGBBAA`; hexadecimal digits are case-insensitive
- Unknown palette fields and invalid values are rejected; the plugin remains inactive

The last byte is alpha: `FF` is opaque and `00` is transparent. Backgrounds blend with the native background of the current state. Text is processed in the final rendered cells, preserving native fade and glow effects. Transparent text is not native text: use `null` for the latter.

An inactive row requiring attention keeps its native background, except while dragging with drag styling. Configured session/project text colors still apply, and status icons are preserved.

To restore fully native rendering for the built-in provider, set all six base fields to `null`, as shown in the README, and leave drag fields missing or `null`. Removing the entry restores the built-in string color.

## Legacy string format

```json
{
  "providerColors": {
    "custom-provider": "#70A0D0"
  },
  "providerRowOpacity": {
    "inactive": 0.1,
    "active": 0.05,
    "hoverMultiplier": 0.1
  }
}
```

String palettes accept only six hexadecimal digits. Their background opacity is controlled by `providerRowOpacity`: `inactive` for idle rows and `active` for active rows; hovering additionally multiplies the value by `hoverMultiplier`. The example shows the defaults. Each value must be a finite number between 0 and 1 inclusive; unknown keys are rejected.

Object palettes do not use these factors: each background field specifies its own alpha. Do not apply these factors to text colors.
