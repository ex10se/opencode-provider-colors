import {equalRGBA,normalizeRGBA} from './core.mjs';

function descriptor(node,key){for(let n=Object.getPrototypeOf(node);n;n=Object.getPrototypeOf(n)){const d=Object.getOwnPropertyDescriptor(n,key);if(d)return {owner:n,value:d};}}
// Pinned 2.2.5: only the two whole-line pulses inside an expanded tab.
// Edge separators, native effect colors, clocks and callbacks are never changed.
function pair(row){
 const containers=(row.getChildren?.()??[]).filter(n=>n.parent===row&&n.height===1&&n.width===row.width&&n.visible!==false&&n._edge===undefined);
 if(containers.length!==2)return;
 const pulses=containers.map(c=>(c.getChildren?.()??[]).filter(n=>n._edge===undefined&&typeof n.inner?.advance==='function'&&typeof n.outer?.advance==='function'));
 if(pulses.some(p=>p.length!==1))return;
 return pulses.map((p,i)=>({node:p[0],container:containers[i]}));
}
function valid(row,items){
 const current=pair(row);
 return !row.isDestroyed&&row.height===2&&current?.every((p,i)=>p.node===items[i].node&&p.container===items[i].container)&&items.every(({node,container},i)=>!node.isDestroyed&&!container.isDestroyed&&node.visible!==false&&container.parent===row&&node.parent===container&&row.getChildren().includes(container)&&container.getChildren().includes(node)&&node._edge===undefined&&node.height===1&&container.height===1&&node.width===row.width&&container.width===row.width&&node.screenX===row.screenX&&container.screenX===row.screenX&&node.screenY===row.screenY+i&&container.screenY===row.screenY+i);
}
function install(node,eligible,resolve){
 const inherited=descriptor(node,'backgroundColor'),base=Object.getOwnPropertyDescriptor(node,'_backgroundColor');
 if(Object.hasOwn(node,'backgroundColor')||!inherited?.value.set||inherited.value.get||!base||!('value' in base)||!normalizeRGBA(base.value)||typeof base.value?.constructor?.fromInts!=='function'||typeof base.value?.equals!=='function'||typeof node.renderSelf!=='function')return;
 let native=base.value,disposed=false;
 const owned=()=>Object.getOwnPropertyDescriptor(node,'backgroundColor')?.set===setter;
 const original=()=>Object.getOwnPropertyDescriptor(inherited.owner,'backgroundColor')?.set===inherited.value.set;
 const refresh=()=>{
  if(disposed||node.isDestroyed||!owned())return;
  if(!original()){delete node.backgroundColor;disposed=true;return;}
  const rgba=normalizeRGBA(eligible()?resolve(native):undefined);
  const next=rgba?native.constructor.fromInts(...rgba.slice(0,4)):native;
  if(!equalRGBA(node._backgroundColor,next))inherited.value.set.call(node,next);
 };
 function setter(value){native=value;if(!original()){if(owned())delete node.backgroundColor;disposed=true;node.backgroundColor=value;return;}if(!normalizeRGBA(value)||typeof value?.constructor?.fromInts!=='function'){inherited.value.set.call(this,value);return;}refresh();}
 Object.defineProperty(node,'backgroundColor',{configurable:true,enumerable:inherited.value.enumerable,set:setter});
 refresh();
 return {refresh,dispose(){if(disposed)return;disposed=true;if(!owned())return;delete node.backgroundColor;if(!node.isDestroyed&&original()&&!equalRGBA(node._backgroundColor,native))inherited.value.set.call(node,native);}};
}
export class AttentionBases {
 constructor(){this.entries=new Map();}
 update(entries){
  const keep=new Set();
  for(const [row,entry] of entries){
   let binding=this.entries.get(row);
   if(binding&&!valid(row,binding.items)){binding.handles.forEach(h=>h.dispose());this.entries.delete(row);binding=undefined;}
   if(!binding){
    if(!entry.attentionEligible?.())continue;
    const items=pair(row);if(!items||!valid(row,items))continue;
    binding={items,entry,handles:[]};
    for(const {node} of items){const h=install(node,()=>valid(row,items)&&binding.entry.pulseEligible(),host=>binding.entry.resolve(host));if(h)binding.handles.push(h);}
    if(binding.handles.length!==2){binding.handles.forEach(h=>h.dispose());continue;}
    this.entries.set(row,binding);
   }
   binding.entry=entry;keep.add(row);binding.handles.forEach(h=>h.refresh());
  }
  for(const [row,binding] of this.entries)if(!keep.has(row)){binding.handles.forEach(h=>h.dispose());this.entries.delete(row);}
 }
 dispose(){for(const b of this.entries.values())b.handles.forEach(h=>h.dispose());this.entries.clear();}
}
