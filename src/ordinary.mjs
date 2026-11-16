import {ProviderObservations,equalRGBA,normalizeRGBA,interceptIdleBackground,supportsVersion} from './core.mjs';
import {GapUnderlays} from './gaps.mjs';
import {validateOpacity,resolveBackground,nativeSurface} from './soft.mjs';
import {AttentionBases} from './pulses.mjs';
import {RowTextColors} from './text.mjs';
// Snapshot input is refreshed by one app-slot observer, never by a clock or mouse.
export class OrdinaryRows {
 #observed=new ProviderObservations(); #entries=new Map(); #disposed=false;
  constructor(context,colors,snapshot){this.context=context;this.colors=colors;this.snapshot=snapshot;this.opacity=validateOpacity(context.options?.providerRowOpacity);this.gaps=new GapUnderlays(context.renderer);this.pulses=new AttentionBases();this.text=new RowTextColors();}
 observe(id,selected){
  const route=this.context.ui.router.current(),s=this.context.data.session.get(id);
  if(this.#disposed||route.type!=='session'||route.sessionID!==id||!s||!selected?.providerID||!selected?.modelID)return false;
  this.#observed.observe(id,selected,s.model,s.agent);return true;
 }
 provider(id){const s=this.context.data.session.get(id);return s?this.#observed.resolve(id,s.model,s.agent):{source:'unknown'};}
 invalidate(id){this.#observed.invalidate(id);}
 update(){
  if(this.#disposed)return;
  const s=this.snapshot(),b=this.context.theme.background,tokens=[b.raised.base,b.action.primary.selected,b.raised.high];
   const safe=this.context.renderer.capabilities?.rgb===true&&s?.mapping.ok&&supportsVersion(this.context.app.version)&&tokens.every(normalizeRGBA)&&!equalRGBA(tokens[0],tokens[1])&&!equalRGBA(tokens[0],tokens[2])&&!equalRGBA(tokens[1],tokens[2]);
  const tabs=new Map(this.context.ui.tabs.list().map(t=>[t.sessionID,t])),keep=new Set();
  for(const row of safe?s.rows:[]){
   const node=row.node,id=s.bindings.get(node),tab=tabs.get(id),panel=node.parent?.parent?.parent;
   if(!tab||node.isDestroyed||tab.title!==row.title||!panel||!equalRGBA(panel.backgroundColor,tokens[0])||panel.screenX!==node.screenX||panel.width!==node.width||panel.height!==this.context.renderer.height)continue;
   keep.add(node);let entry=this.#entries.get(node);
   if(entry&&(!equalRGBA(entry.idle,tokens[0])||entry.id!==id)){entry.handle?.dispose();this.#entries.delete(node);entry=undefined;}
   if(!entry){entry={id,node,idle:tokens[0]};this.#entries.set(node,entry);}
   const provider=this.provider(id);
   entry.color=this.colors[provider.providerID]?.bg?.slice(0,7);
    // Read live state at the setter boundary too: native effects may execute before
       // the app-slot observer. Attention, unread and busy keep their established bases.
    const current=()=>this.context.ui.tabs.list().find(t=>t.sessionID===id);
       const dragging=()=>this.snapshot()?.dragID===id;
       entry.dragging=dragging;
       const eligible=()=>{const t=current();return this.context.renderer.capabilities?.rgb===true&&!node.isDestroyed&&t&&(t.active||dragging()||!t.attention)&&Boolean(this.colors[this.provider(id).providerID]);};
    entry.eligible=eligible();
    const resolve=host=>{
     const t=current(),theme=this.context.theme.background,hover=equalRGBA(host,theme.raised.high);
     if(!t||!hover&&!equalRGBA(host,theme.raised.base)&&!(t.active&&equalRGBA(host,theme.action.primary.selected)))return;
      entry.nativeBase=nativeSurface(node,host);
      if(dragging()){
       const native=nativeSurface(node,theme.action.primary.selected);
       return resolveBackground(this.colors[this.provider(id).providerID],native,true,false,this.opacity,true)??native;
      }
     return resolveBackground(this.colors[this.provider(id).providerID],entry.nativeBase,t.active,hover,this.opacity);
     };
       entry.resolve=resolve;entry.attentionEligible=()=>{const t=current();return eligible()&&(t?.active&&t.attention||t?.unread||t?.busy);};
       // Keep the current idle base through native effect release animations.
      entry.pulseEligible=()=>eligible();
      entry.sessionTextEligible=()=>this.context.renderer.capabilities?.rgb===true&&!node.isDestroyed&&Boolean(current())&&Boolean(this.colors[this.provider(id).providerID]);
    if(!entry.handle&&entry.eligible)entry.handle=interceptIdleBackground(node,{idle:entry.idle,eligible,resolve});
   entry.handle?.refresh();
  }
  for(const [node,e] of this.#entries)if(!keep.has(node)){e.handle?.dispose();this.#entries.delete(node);}
   this.pulses.update(this.#entries);this.gaps.update(safe?s.rows:[],this.#entries,tokens);this.text.update(this.#entries,this.colors,id=>this.provider(id));
 }
 stats(){return {bindings:this.#entries.size,installed:[...this.#entries.values()].filter(e=>e.handle).length,writes:[...this.#entries.values()].reduce((n,e)=>n+(e.handle?.writes??0),0)};}
  dispose(){this.#disposed=true;this.text.dispose();this.pulses.dispose();this.gaps.dispose();for(const e of this.#entries.values())e.handle?.dispose();this.#entries.clear();this.#observed.invalidate();}
}
