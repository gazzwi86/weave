/** Strips a `var(--token)` wrapper down to the bare `--token` name -- CE
 * palette/overlay colours travel as the full `var(...)` form (ready to drop
 * straight into an inline `style`), but a couple of design-system molecules
 * (`OverlayKey`, `Minimap`) take the bare custom-property name and wrap it
 * themselves. Any input that isn't a `var(...)` wrapper passes through
 * unchanged (defensive -- never throws on an unexpected format). */
export function stripVarWrapper(colour: string): string {
  const match = /^var\((--[\w-]+)\)$/.exec(colour);
  return match ? match[1]! : colour;
}
