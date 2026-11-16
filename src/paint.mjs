import { normalizeRGBA } from './core.mjs';
const paletteEntry = base => Object.freeze({bg:base, fg:base});
export const defaults = Object.freeze({
  openai: paletteEntry('#B8EEE4'),
});
export function validateColors(value = {}) {
  if (!value || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new Error('invalid-provider-colors');
  const colors = Object.assign(Object.create(null), defaults);
  for (const [id, color] of Object.entries(value)) {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(id)) throw new Error('invalid-provider-colors');
    if(typeof color==='string'){
      if(!/^#[a-f0-9]{6}$/i.test(color))throw new Error('invalid-provider-colors');
      colors[id]=paletteEntry(color);continue;
    }
    if(!color||Array.isArray(color)||Object.getPrototypeOf(color)!==Object.prototype||!Object.hasOwn(color,'bg'))throw new Error('invalid-provider-colors');
    const normalized={};
    for(const [key,value] of Object.entries(color)){
      const background=['bg','activeBg','hoverBg','dragBg'].includes(key),foreground=['sessionFg','projectFg','providerFg','dragSessionFg','dragProjectFg'].includes(key);
      if(foreground&&value===null)continue;
      if(background&&value===null){normalized[key]=null;continue;}
      if(!background&&!foreground||typeof value!=='string'||!/^#[a-f0-9]{6}([a-f0-9]{2})?$/i.test(value))throw new Error('invalid-provider-colors');
      normalized[key]=value;
    }
    colors[id]=Object.freeze({...normalized,fg:normalized.providerFg,objectPalette:true});
  }
  return Object.freeze(colors);
}
export function colorHex(value) {
  const rgba = normalizeRGBA(value);
  if (!rgba || rgba[3] !== 255 || rgba[4] !== 'rgb') return undefined;
  return '#' + rgba.slice(0, 3).map(n => n.toString(16).padStart(2, '0')).join('');
}
