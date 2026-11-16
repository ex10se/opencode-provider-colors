function leadingNonpaintingLeaf(items) {
  const first = items[0];
  return Boolean(first && first.width === 1 && first.height === 1 && !('backgroundColor' in first) && first.getChildren?.().length === 0);
}
export function discoverRows(root) {
  let result;
  try { result = discoverRowsRaw(root); } catch { result = { ok: false, rows: [], reason: 'inspection-failed' }; }
  return result;
}
function discoverRowsRaw(root) {
  const stack = [root], seen = new Set(), candidates = [];
  while (stack.length && seen.size < 10000) {
    const item = stack.pop();
    if (!item || seen.has(item)) continue;
    seen.add(item);
    if (Object.hasOwn(item, '_rename') && Object.hasOwn(item, '_backdrop') && typeof item._rename?.title === 'string') candidates.push(item);
    stack.push(...(item.getChildren?.() ?? []));
  }
  const reject = reason => ({ ok: false, rows: [], reason });
  if (stack.length) return reject('tree-limit');
  if (!candidates.length) return reject('no-expanded-title-rows');
  const entries = candidates.map(title => {
    const row = title.parent?.parent?.parent;
    // Runtime 2.2.5 also has a leading nonpainting 1x1 leaf. Do not ignore other extras.
    const children = row?.getChildren?.() ?? [];
    const count = children.length - (leadingNonpaintingLeaf(children) ? 1 : 0);
    return { title, row, list: row?.parent, valid: Boolean(row && row.height === 2 && (count === 3 || count === 4) && 'backgroundColor' in row) };
  });
  const lists = new Set(entries.filter(e => e.valid && typeof e.list?.getChildren === 'function').map(e => e.list));
  if (lists.size > 1) return reject('ambiguous-row-lists');
  if (!lists.size) return reject(entries.some(e => e.list?.getChildren) ? 'unexpected-row-shape' : 'no-list');
  const [list] = lists;
  const selected = entries.filter(e => e.list === list), byRow = new Map();
  for (const { title, row, valid } of selected) {
    if (!valid || byRow.has(row)) return reject('unexpected-row-shape');
    byRow.set(row, { node: row, title: title._rename.title, titleNode: title });
  }
  const rows = list.getChildren().filter(row => byRow.has(row)).map(row => byRow.get(row));
  if (rows.length !== selected.length) return reject('list-order-count-mismatch');
  return { ok: true, rows, reason: 'pinned-expanded-shape' };
}
