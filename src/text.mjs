import {normalizeRGBA} from './core.mjs';
import {nativeSurface} from './soft.mjs';

// Recover the base contribution of native linear fade/glow composition. Unknown
// or ambiguous compositions stay native rather than flattening a text effect.
export function recolorText(value,base,background,glow,target){
 const t=normalizeRGBA(target);if(!t||t[4]!=='rgb')return;
 const rgb='#'+t.slice(0,3).map(x=>x.toString(16).padStart(2,'0')).join('');
 const opaque=recolorOpaque(value,base,background,glow,rgb);
 if(t[3]===255)return opaque;
 // Apply opacity after native text effects. TextBuffer composites against the
 // actual destination cell, including the independent background pulse.
 // An ambiguous recolor retains native ink, but still honors requested alpha.
 const v=normalizeRGBA(value);if(!v||v[3]!==255||v[4]!=='rgb')return;
 return (opaque??'#'+v.slice(0,3).map(x=>x.toString(16).padStart(2,'0')).join(''))+t[3].toString(16).padStart(2,'0');
}
function recolorOpaque(value,base,background,glow,target){
 const values=[value,base,background,glow??background,target].map(normalizeRGBA);
 if(values.some(x=>!x||x[3]!==255||x[4]!=='rgb'))return;
 const [v,b,g,h,t]=values;
 const u=b.slice(0,3).map((x,i)=>x-g[i]),w=h.slice(0,3).map((x,i)=>x-g[i]),d=v.slice(0,3).map((x,i)=>x-g[i]);
 const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),uu=dot(u,u),ww=dot(w,w),uw=dot(u,w),ud=dot(u,d),wd=dot(w,d),det=uu*ww-uw*uw;
 if(uu===0)return;
 let a,c;
 if(ww===0){a=ud/uu;c=0;}
 else if(det>1){a=(ud*ww-wd*uw)/det;c=(wd*uu-ud*uw)/det;}
 else if(v.slice(0,3).every((x,i)=>x===b[i])){a=1;c=0;}
 else return;
 if(a<-.04||c<-.04||a+c>1.04||d.some((x,i)=>Math.abs(x-a*u[i]-c*w[i])>1.5))return;
 a=Math.max(0,Math.min(1,a));
 return '#'+v.slice(0,3).map((x,i)=>Math.max(0,Math.min(255,Math.round(x+a*(t[i]-b[i])))).toString(16).padStart(2,'0')).join('');
}

function install(node,source,desired){
 const root=node.textNode,method=root?.prepareWithInheritedStyle;
 if(!root||typeof method!=='function'||Object.hasOwn(root,'prepareWithInheritedStyle')||typeof root.requestRender!=='function')return;
 let disposed=false,last;
 function prepare(...args){
  const result=method.apply(this,args),color=desired();
  if(disposed||this!==root||!color)return result;
  const state=source();if(!state)return result;
  return {...result,chunks:result.chunks.map(chunk=>{
   const value=chunk.fg??args[0]?.fg,hex=recolorText(value,state.base,state.background,state.glow,color);
   return hex&&typeof value?.constructor?.fromHex==='function'?{...chunk,fg:value.constructor.fromHex(hex)}:chunk;
  })};
 }
 Object.defineProperty(root,'prepareWithInheritedStyle',{configurable:true,writable:true,value:prepare});
 const refresh=()=>{const next=desired();if(next!==last){last=next;root.requestRender();}};
 refresh();
 return {node,refresh,dispose(){if(disposed)return;disposed=true;if(root.prepareWithInheritedStyle!==prepare)return;delete root.prepareWithInheritedStyle;if(!node.isDestroyed)root.requestRender();}};
}

export class RowTextColors{
 constructor(){this.handles=new Map();}
 update(entries,colors,provider){
  const keep=new Set();
  for(const [row,entry] of entries){
   const containers=row.getChildren?.().filter(n=>n.height===1&&n.width===row.width&&n.getChildren?.().some(x=>x._edge===undefined&&typeof x.inner?.advance==='function'))??[];
   if(containers.length!==2)continue;
   for(let index=0;index<2;index++){
    const container=containers[index],pulse=container.getChildren().find(n=>n._edge===undefined&&typeof n.inner?.advance==='function');
    const candidates=container.getChildren().flatMap(n=>n.getChildren?.()??[]).filter(n=>n.textNode&&(index===0?Object.hasOwn(n,'_rename'):!Object.hasOwn(n,'_rename')));
    const nodes=index===0?candidates:candidates.filter(n=>n.parent?.parent===container);
    if(nodes.length!==1)continue;
    const node=nodes[0],key=index===0?'sessionFg':'projectFg';
    const parent=node.parent;
     const desired=()=>{
      if(row.isDestroyed||node.isDestroyed||node.parent!==parent||parent?.parent!==container||container.parent!==row||!entry.sessionTextEligible?.())return;
      const palette=colors[provider(entry.id).providerID];
      return entry.dragging?.()?(palette?.[index===0?'dragSessionFg':'dragProjectFg']??palette?.[key]):palette?.[key];
     };
    if(!desired()&&!this.handles.has(node))continue;
    keep.add(node);
    let handle=this.handles.get(node);
    if(handle&&handle.entry!==entry){handle.dispose();this.handles.delete(node);handle=undefined;}
     // Inactive attention keeps its native surface and never resolves a provider
     // background. Do not use its missing (or previously active) nativeBase.
     if(!handle){handle=install(node,()=>({base:node.fg,background:index===0?node._backdrop:entry.pulseEligible?.()?entry.nativeBase:nativeSurface(row,row.backgroundColor),glow:index===0?pulse._glowColor:undefined}),desired);if(handle){handle.entry=entry;this.handles.set(node,handle);}}
    handle?.refresh();
   }
  }
  for(const [node,handle] of this.handles)if(!keep.has(node)){handle.dispose();this.handles.delete(node);}
 }
 dispose(){for(const h of this.handles.values())h.dispose();this.handles.clear();}
}
