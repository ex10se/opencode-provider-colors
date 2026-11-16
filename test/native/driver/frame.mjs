import {colorHex} from '../../../src/paint.mjs';
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
