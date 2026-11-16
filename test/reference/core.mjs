export class RowBindings {
  #bound = new WeakMap();
  #pending;
  #live = new Set();
  get(node) { return this.#live.has(node) ? this.#bound.get(node)?.sessionID : undefined; }
  reconcile(s) {
    const reject = reason => { this.#bound = new WeakMap(); this.#pending = undefined; return { ok: false, reason }; };
    this.#live = new Set(s.rows.map(r => r.node));
    if (s.version !== '2.2.5' || !s.structureVerified || s.compact) return reject('unsupported-structure');
    const ids = new Set(s.tabs.map(t => t.sessionID));
    const titles = new Set(s.tabs.map(t => t.title));
    if (!s.rows.length || s.rows.length !== s.tabs.length || ids.size !== s.tabs.length || titles.size !== s.tabs.length) return reject('ambiguous-count-or-title');
    const byID = new Map(s.tabs.map(t => [t.sessionID, t]));
    let complete = true;
    for (const row of s.rows) {
      const old = this.#bound.get(row.node);
      if (!old || old.title !== row.title || byID.get(old.sessionID)?.title !== row.title) {
        this.#bound.delete(row.node); complete = false;
      }
    }
    if (complete) { this.#pending = undefined; return { ok: true, reason: 'identity-preserved' }; }
    if (!s.stationary) { this.#pending = undefined; return { ok: false, reason: 'not-stationary' }; }
    if (s.rows.some((r, i) => typeof r.title !== 'string' || !r.title || r.title !== s.tabs[i].title)) return reject('title-order-mismatch');
    const candidate = s.rows.map((r, i) => ({ node: r.node, title: r.title, sessionID: s.tabs[i].sessionID }));
    const stable = this.#pending?.length === candidate.length && candidate.every((r, i) => {
      const old = this.#pending[i]; return r.node === old.node && r.title === old.title && r.sessionID === old.sessionID;
    });
    this.#pending = candidate;
    if (!stable) return { ok: false, reason: 'awaiting-second-snapshot' };
    for (const row of candidate) this.#bound.set(row.node, { title: row.title, sessionID: row.sessionID });
    return { ok: true, reason: 'stationary-corroborated-not-runtime-proven' };
  }
}

// Confirmed 2.2.5 RGBA getters expose byte/255 channels, intent and slot.
// Unknown forms are deliberately not coerced through host methods.
export function normalizeRGBA(value) {
  if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) {
    return [...value.slice(1).match(/../g).map(v => parseInt(v, 16)), 255, 'rgb', 0];
  }
  if (!value || typeof value !== 'object') return;
  try {
    const { r, g, b, a, intent, slot } = value;
    if (!['rgb', 'indexed', 'default'].includes(intent) || !Number.isInteger(slot) || slot < 0 || slot > 255) return;
    const channels = [r, g, b, a];
    if (!channels.every(v => Number.isFinite(v) && v >= 0 && v <= 1 && Math.abs(v * 255 - Math.round(v * 255)) < 1e-7)) return;
    return [...channels.map(v => Math.round(v * 255)), intent, slot];
  } catch { return; }
}
export function equalRGBA(left, right) {
  const a = normalizeRGBA(left), b = normalizeRGBA(right);
  return Boolean(a && b && a.every((v, i) => v === b[i]));
}

// Reversible per-instance boundary shared by the ordinary controller and legacy tests.
export function interceptIdleBackground(node, { idle, color, eligible, resolve }) {
  if (Object.hasOwn(node, 'backgroundColor') || !Object.isExtensible(node)) return;
  let prototype = Object.getPrototypeOf(node), descriptor;
  while (prototype && !descriptor) {
    descriptor = Object.getOwnPropertyDescriptor(prototype, 'backgroundColor');
    prototype = Object.getPrototypeOf(prototype);
  }
  if (!descriptor?.get || !descriptor?.set) return;
  let hostValue = descriptor.get.call(node), disposed = false, writes = 0;
  if (!normalizeRGBA(idle) || !normalizeRGBA(hostValue)) return;
  const wanted = () => {
    const candidate = eligible() ? (resolve ? resolve(hostValue) : equalRGBA(hostValue, idle) ? color() : undefined) : undefined;
    return normalizeRGBA(candidate) ? candidate : hostValue;
  };
  const refresh = () => {
    if (disposed || node.isDestroyed || !normalizeRGBA(hostValue)) return;
    const next = wanted();
    if (!equalRGBA(descriptor.get.call(node), next)) { descriptor.set.call(node, next); writes++; }
  };
  const getter = function () { return descriptor.get.call(this); };
  const setter = function (value) {
    if (!normalizeRGBA(value)) { descriptor.set.call(this, value); hostValue = value; return; }
    hostValue = value;
    refresh();
  };
  Object.defineProperty(node, 'backgroundColor', { configurable: true, enumerable: descriptor.enumerable, get: getter, set: setter });
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    const current = Object.getOwnPropertyDescriptor(node, 'backgroundColor');
    if (current?.get !== getter || current?.set !== setter) return;
    delete node.backgroundColor;
    if (!node.isDestroyed && normalizeRGBA(hostValue) && !equalRGBA(descriptor.get.call(node), hostValue)) { descriptor.set.call(node, hostValue); writes++; }
  };
  try { refresh(); } catch (error) { dispose(); throw error; }
  return { refresh, dispose, get writes() { return writes; } };
}

const modelKey = (model, agent) => JSON.stringify([model?.providerID, model?.id ?? model?.modelID, model?.variant, agent]);
export class ProviderObservations {
  #observed = new Map();
  observe(sessionID, selected, persisted, agent) {
    if (!sessionID || !selected?.providerID) return;
    this.#observed.set(sessionID, { providerID: selected.providerID, persistedKey: modelKey(persisted, agent) });
  }
  resolve(sessionID, persisted, agent) {
    const observed = this.#observed.get(sessionID);
    if (observed && observed.persistedKey === modelKey(persisted, agent)) return { source: 'observed', providerID: observed.providerID };
    return persisted?.providerID ? { source: 'saved', providerID: persisted.providerID } : { source: 'unknown' };
  }
  invalidate(id) { if (id) this.#observed.delete(id); else this.#observed.clear(); }
}
