import {normalizeRGBA,equalRGBA} from './core.mjs';
function descriptor(node,key){for(let n=node;n;n=Object.getPrototypeOf(n)){const d=Object.getOwnPropertyDescriptor(n,key);if(d)return d;}}
// Capture identities once; read current colors at paint so theme/hover cannot stale.
// Partial alpha is deliberately unsupported: do not approximate native blending.
function surfaceReader(row){
 const chain=[],seen=new Set();for(let n=row;n;n=n.parent){if(seen.has(n)||chain.length===32)return ()=>undefined;seen.add(n);chain.push({node:n,parent:n.parent});}
 return ()=>{
  for(const {node,parent} of chain){
   if(node.isDestroyed||node.parent!==parent||node.opacity!==undefined&&node.opacity!==1)return;
   const color=node.backgroundColor;if(color===undefined)continue;
   const rgba=normalizeRGBA(color);if(!rgba)return;
   if(rgba[3]===255)return color;if(rgba[3]!==0)return;
  }
 };
}
// Pinned 2.2.5 adapter. Never read TabPulse.backgroundColor: it is setter-only.
function install(node,row,above,clip,renderer){
 const bg=descriptor(node,'backgroundColor'),paint=descriptor(node,'renderBefore');
  if(!bg?.set||bg.get||!paint?.get||!paint?.set||node._edge!=='above'||typeof node.renderSelf!=='function'||typeof node.refreshHooks!=='function'||typeof node.inner?.advance!=='function'||typeof node.outer?.advance!=='function')return;
  const selfDescriptor=Object.getOwnPropertyDescriptor(node,'renderSelf'),nativeSelf=node.renderSelf;
  if(selfDescriptor&&(!('value' in selfDescriptor)||!selfDescriptor.configurable))return;
 const valid=()=>{
  if(node.isDestroyed||row.isDestroyed||above.isDestroyed||clip.isDestroyed||!node.visible||node.parent!==row||row.parent!==above.parent||row.parent?.parent!==clip||row.height!==2||above.height!==2||node.height!==1||node.width!==row.width||above.width!==row.width||node.screenX!==row.screenX||above.screenX!==row.screenX||node.screenY!==row.screenY-1||above.screenY+above.height!==node.screenY||!row.getChildren().includes(node))return false;
  const siblings=row.parent.getChildren();return siblings.includes(above)&&siblings.indexOf(row)===siblings.indexOf(above)+1;
 };
 // Layout may still contain the previous positions during a reorder notification.
 // Attach to the verified instance now; every paint remains geometry-guarded.
  const previous=node.renderBefore;if(previous!=null&&typeof previous!=='function')return;
 const upperSurface=surfaceReader(above),lowerSurface=surfaceReader(row);
  let disposed=false,paintedBuffer;
  const ownsSelf=()=>Object.getOwnPropertyDescriptor(node,'renderSelf')?.value===self;
  function before(...args){
   paintedBuffer=undefined;
   previous?.apply(this,args);
   if(disposed||this!==node||!ownsSelf()||node.renderBefore!==before||!valid())return;
   const x=node.screenX,y=node.screenY,w=node.width,upper=upperSurface(),lower=lowerSurface();
  if(!normalizeRGBA(upper)||!normalizeRGBA(lower)||x<0||y<0||x+w>renderer.width||y>=renderer.height||x<clip.screenX||x+w>clip.screenX+clip.width||y<clip.screenY||y>=clip.screenY+clip.height)return;
   for(let i=0;i<w;i++)args[0].setCell(x+i,y,'▄',lower,upper);
   paintedBuffer=args[0];
  }
  function self(...args){
   const painted=paintedBuffer!==undefined&&paintedBuffer===args[0];
   paintedBuffer=undefined;
   if(!disposed&&this===node&&ownsSelf()&&node.renderBefore===before&&painted)return;
   return nativeSelf.apply(this,args);
  }
  Object.defineProperty(node,'renderSelf',{configurable:true,writable:true,enumerable:selfDescriptor?.enumerable??false,value:self});
  node.renderBefore=before;
  node.refreshHooks();
  return {row,above,clip,owned:()=>node.renderBefore===before&&ownsSelf(),dispose(){
   if(disposed)return;disposed=true;paintedBuffer=undefined;
   if(node.renderBefore===before)node.renderBefore=previous;
   if(!ownsSelf())return;
   if(selfDescriptor)Object.defineProperty(node,'renderSelf',selfDescriptor);else delete node.renderSelf;
   if(!node.isDestroyed)node.refreshHooks();
  }};
}
export class GapUnderlays {
 constructor(renderer){this.renderer=renderer;this.entries=new Map();}
 update(rows,entries,tokens){
  const keep=new Set();
  for(let i=1;i<rows.length;i++){
   const row=rows[i].node,above=rows[i-1].node,a=entries.get(above),b=entries.get(row);
   // Unknown neighbor: keep the whole separator native, never guess its palette.
   if(!a?.color||!b?.color||![a.color,b.color].every(c=>normalizeRGBA(c)&&!tokens.some(t=>equalRGBA(c,t))))continue;
   const clip=row.parent?.parent;if(typeof clip?.scrollTo!=='function')continue;
   const candidates=(row.getChildren?.()??[]).filter(n=>n._edge==='above');if(candidates.length!==1)continue;
   const node=candidates[0];keep.add(node);let handle=this.entries.get(node);
   if(handle&&(handle.row!==row||handle.above!==above||handle.clip!==clip)){handle.dispose();this.entries.delete(node);handle=undefined;}
   // Do not wrap another plugin that replaced our hook during this binding.
   if(!handle){handle=install(node,row,above,clip,this.renderer);if(handle)this.entries.set(node,handle);}
  }
  for(const [node,h] of this.entries)if(!keep.has(node)){h.dispose();this.entries.delete(node);}
 }
 dispose(){for(const h of this.entries.values())h.dispose();this.entries.clear();}
}
