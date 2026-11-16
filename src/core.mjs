// Confirmed 2.2.5 RGBA getters expose byte/255 channels, intent and slot.
// Unknown forms are deliberately not coerced through host methods.
export function normalizeRGBA(value) {
  if (typeof value === 'string' && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value)) {
    return [...value.slice(1,7).match(/../g).map(v => parseInt(v, 16)), value.length===9?parseInt(value.slice(7),16):255, 'rgb', 0];
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
export const supportsVersion = version => version === '2.2.5' || version === '2.2.7';
