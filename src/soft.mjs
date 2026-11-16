import {normalizeRGBA} from './core.mjs';

const defaults=Object.freeze({inactive:0.10,active:0.05,hoverMultiplier:0.10});
export function validateOpacity(value={}){
 if(!value||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)throw new Error('invalid-provider-row-opacity');
 for(const [key,opacity] of Object.entries(value))if(!Object.hasOwn(defaults,key)||typeof opacity!=='number'||!Number.isFinite(opacity)||opacity<0||opacity>1)throw new Error('invalid-provider-row-opacity');
 return Object.freeze({...defaults,...value});
}
export function blend(base,native,opacity){
 const a=normalizeRGBA(base),b=normalizeRGBA(native);
 if(!a||!b||a[3]!==255||b[3]!==255||a[4]!=='rgb'||b[4]!=='rgb')return;
 return '#'+a.slice(0,3).map((v,i)=>Math.round(b[i]+(v-b[i])*opacity).toString(16).padStart(2,'0')).join('').toUpperCase();
}
export function resolveBackground(color,native,active,hover,opacity=defaults,dragging=false){
 if(!color)return;
  if(!color.objectPalette)return blend(color.bg,native,opacity[dragging||active?'active':'inactive']*(hover&&!dragging?opacity.hoverMultiplier:1));
  const selected=dragging?(color.dragBg??color.activeBg):hover?color.hoverBg:active?color.activeBg:color.bg;
  const hex=selected===undefined?color.bg:selected;
  if(hex===null)return;
 return blend(hex.slice(0,7),native,hex.length===9?parseInt(hex.slice(7),16)/255:1);
}
// Read only the bounded ancestor chain, not the scene tree. The host value is
// captured before interception; using node.backgroundColor here would compound.
export function nativeSurface(node,hostValue){
 const seen=new Set();let color=hostValue;
 for(let depth=0;node&&depth<32;depth++,node=node.parent){
  if(seen.has(node)||node.isDestroyed||node.opacity!==undefined&&node.opacity!==1)return;
  seen.add(node);
  if(depth)color=node.backgroundColor;
  if(color===undefined)continue;
  const rgba=normalizeRGBA(color);if(!rgba)return;
  if(rgba[3]===255)return color;
  if(rgba[3]!==0)return;
 }
}
