import { normalizeRGBA, equalRGBA, interceptIdleBackground } from './core.mjs';
const paletteEntry = (label, base) => Object.freeze({label, bg:base, fg:base});
export const defaults = Object.freeze({
  openai: paletteEntry('Codex Safe', '#B8EEE4'),
});
export function validateColors(value = {}) {
  if (!value || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new Error('invalid-provider-colors');
  const colors = Object.assign(Object.create(null), defaults);
  for (const [id, color] of Object.entries(value)) {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(id)) throw new Error('invalid-provider-colors');
    const label=defaults[id]?.label ?? id;
    if(typeof color==='string'){
      if(!/^#[a-f0-9]{6}$/i.test(color))throw new Error('invalid-provider-colors');
      colors[id]=paletteEntry(label,color);continue;
    }
    if(!color||Array.isArray(color)||Object.getPrototypeOf(color)!==Object.prototype||!Object.hasOwn(color,'bg'))throw new Error('invalid-provider-colors');
    for(const [key,value] of Object.entries(color)){
      const background=['bg','activeBg','hoverBg'].includes(key),foreground=['sessionFg','projectFg','providerFg'].includes(key);
      if(!background&&!foreground||typeof value!=='string'||!(background?/^#[a-f0-9]{6}([a-f0-9]{2})?$/i:/^#[a-f0-9]{6}$/i).test(value))throw new Error('invalid-provider-colors');
    }
    colors[id]=Object.freeze({...color,label,fg:color.providerFg,objectPalette:true});
  }
  return Object.freeze(colors);
}
export function colorHex(value) {
  const rgba = normalizeRGBA(value);
  if (!rgba || rgba[3] !== 255 || rgba[4] !== 'rgb') return undefined;
  return '#' + rgba.slice(0, 3).map(n => n.toString(16).padStart(2, '0')).join('');
}
export class RowPainter {
  #idle = new WeakMap(); #installed = new Map(); #states = new Map(); #retiredWrites = 0;
  constructor(colors, live) { this.colors = colors; this.live = live; }
  verifyTheme(node, idle, active, hover, panel) {
    if (![idle, active, hover, panel].every(normalizeRGBA) || equalRGBA(idle, active) || equalRGBA(idle, hover) || equalRGBA(active, hover) || !equalRGBA(idle, panel)) return false;
    this.#idle.set(node, idle); return true;
  }
  // Caller must establish native idle/active on this exact object, before installing.
  verifyIdle(node, idle, active) {
    if (!normalizeRGBA(idle) || !normalizeRGBA(active) || equalRGBA(idle, active) || this.#installed.has(node)) return false;
    this.#idle.set(node, idle); return true;
  }
  update(rows, safe) {
    const current = row => this.live ? this.live(row?.node) : row;
    const eligible = row => { const now = current(row); return safe && now?.verified === true && now.active === false && now.busy === false && now.attention === false && !now.unread && Boolean(this.colors[now.providerID]); };
    this.#states = new Map(rows.map(row => [row.node, row]));
    for (const [node, handle] of this.#installed) {
      if (!eligible(this.#states.get(node))) { handle.dispose(); this.#retiredWrites += handle.writes; this.#installed.delete(node); }
    }
    if (!safe) { this.#idle = new WeakMap(); return; }
    for (const row of rows) {
      if (!eligible(row) || !this.#idle.has(row.node)) continue;
      if (!this.#installed.has(row.node)) {
        if (!equalRGBA(row.node.backgroundColor, this.#idle.get(row.node))) continue;
        const handle = interceptIdleBackground(row.node, {
          idle: this.#idle.get(row.node),
          color: () => this.colors[current(this.#states.get(row.node))?.providerID]?.bg,
          eligible: () => eligible(this.#states.get(row.node)),
        });
        if (handle) this.#installed.set(row.node, handle);
      }
      this.#installed.get(row.node)?.refresh();
    }
  }
  dispose() {
    for (const handle of this.#installed.values()) { handle.dispose(); this.#retiredWrites += handle.writes; }
    this.#installed.clear(); this.#states.clear(); this.#idle = new WeakMap();
  }
  stats() { return { installed: this.#installed.size, writes: this.#retiredWrites + [...this.#installed.values()].reduce((sum, h) => sum + h.writes, 0) }; }
}
export function frameColors(lines, rect, channel = 'bg') {
  const result = { cells: 0, colors: {} };
  if (!rect || !['x', 'y', 'width', 'height'].every(k => Number.isInteger(rect[k])) || rect.width < 1 || rect.height < 1) return result;
  for (let y = Math.max(0, rect.y); y < Math.min(lines.length, rect.y + rect.height); y++) {
    let x = 0;
    for (const span of lines[y].spans) {
      const overlap = Math.max(0, Math.min(x + span.width, rect.x + rect.width) - Math.max(x, rect.x));
      const color = colorHex(channel === 'fg' ? span.fg : span.bg) ?? 'unknown';
      if (overlap) { result.cells += overlap; result.colors[color] = (result.colors[color] ?? 0) + overlap; }
      x += span.width;
    }
  }
  return result;
}
