import {discoverRows} from './probe.mjs';
import {OrdinaryRows} from './ordinary.mjs';
import {InlineProvider} from './inline.mjs';
export class EventController {
 constructor(context,colors){
  this.context=context;this.colors=colors;this.disposed=false;this.queued=false;this.inlineQueued=false;this.inlineTicket=0;this.inlineRevision=0;this.inlineLayoutBusy=false;this.listeners=[];this.inlineListeners=[];this.snapshot=undefined;this.state=undefined;
  this.counts=undefined;
   this.rows=new OrdinaryRows(context,colors,()=>this.snapshot);this.inline=new InlineProvider();
   this.dragID=undefined;
   const root=context.renderer.root,original=root.processMouseEvent,descriptor=Object.getOwnPropertyDescriptor(root,'processMouseEvent');
   if(typeof original==='function'&&(!descriptor||descriptor.configurable)&&Object.isExtensible(root)){
    const controller=this;
    function mouse(event){try{return original.call(this,event);}finally{if(this===root&&!controller.disposed)controller.pointer(event);}}
    Object.defineProperty(root,'processMouseEvent',{configurable:true,writable:true,value:mouse});
    this.releaseMouse=()=>{if(root.processMouseEvent!==mouse)return;if(descriptor)Object.defineProperty(root,'processMouseEvent',descriptor);else delete root.processMouseEvent;};
   }
  this.watch(context.renderer,'resize');this.watch(context.renderer.root,'layout-changed');this.watch(context.renderer.root,'resized');
 }
 watch(node,event){
  if(node!==this.context.renderer.root&&['layout-changed','resized'].includes(event))return;
  if(!node?.on||this.listeners.some(x=>x.node===node&&x.event===event))return;
   const fn=()=>{
    if(event==='layout-changed'&&node===this.context.renderer.root)this.bindInlineLayout();
    if(event==='layout-changed'&&this.snapshot?.mapping.ok){
     const geometry=this.geometry();
     if(this.rowGeometry?.length===geometry.length&&geometry.every((v,i)=>v===this.rowGeometry[i])){
      if(!this.inline.anchor()&&!this.inline.pending())this.scheduleInline();
      return;
     }
    }
    this.schedule();
   };
  node.on(event,fn);
  this.listeners.push({node,event,fn});if(this.counts)this.counts.listeners++;
 }
  schedule(){if(this.disposed||this.queued)return;this.queued=true;queueMicrotask(()=>{this.queued=false;if(!this.disposed)this.reconcile();});}
  pointer(event){
   if(event.type==='drag'&&event.button===0){
    const seen=new Set();let node=this.context.renderer.capturedRenderable??event.target;
    for(let i=0;node&&i<32&&!seen.has(node);i++,node=node.parent){
     seen.add(node);const id=this.snapshot?.bindings.get(node);
     if(id){this.dragID=id;break;}
    }
    this.schedule();
   }else if(this.dragID&&(event.type==='up'||event.type==='drag-end'||event.type==='down')){
    this.dragID=undefined;this.schedule();
   }
  }
 scheduleInline(){if(this.disposed||this.inlineQueued)return;this.inlineQueued=true;const ticket=++this.inlineTicket;queueMicrotask(()=>{if(ticket!==this.inlineTicket)return;this.inlineQueued=false;if(!this.disposed&&!this.queued)this.reconcileInline();});}
 bindInlineLayout(){
  if(this.disposed||this.inlineLayoutBusy||!this.inline.pending())return;
  this.inlineLayoutBusy=true;const revision=this.inlineRevision;
  try{this.inline.bindPending(this.context.renderer.root,this.label(),this.fg());this.watchInline();
   if(revision===this.inlineRevision&&this.inline.anchor()){this.inlineTicket++;this.inlineQueued=false;}
  }finally{this.inlineLayoutBusy=false;}
 }
 reconcileInline(){
  if(this.disposed)return;
  if(this.counts)this.counts.inlineDiscoveries++;
  this.inline.update(this.context.renderer.root,this.label(),this.fg(),true);
  this.watchInline();
 }
 watchInline(){
  const keep=new Set();for(const start of [this.inline.anchor(),this.inline.editor()])for(let n=start;n&&n!==this.context.renderer.root;n=n.parent)keep.add(n);
  this.inlineListeners=this.inlineListeners.filter(x=>{if(keep.has(x.node)&&!x.node.isDestroyed)return true;x.node.off(x.event,x.fn);if(this.counts)this.counts.listeners--;return false;});
  for(const node of keep)for(const event of ['resize','destroyed'])if(!this.inlineListeners.some(x=>x.node===node&&x.event===event)){
   const fn=()=>{if(event==='resize'&&this.inline.pending())this.bindInlineLayout();else this.scheduleInline();};node.on(event,fn);this.inlineListeners.push({node,event,fn});if(this.counts)this.counts.listeners++;
  }
 }
 update(state){
  if(this.disposed)return;
  this.inlineRevision++;
  if(this.counts)this.counts.updates++;
  const old=this.state;this.state=state;
  if(state.route.type==='session'&&state.selected)this.rows.observe(state.route.sessionID,state.selected);
  const changed=!old||old.tabs.length!==state.tabs.length||old.tabs.some((t,i)=>t.sessionID!==state.tabs[i].sessionID||t.title!==state.tabs[i].title)||old.route.type!==state.route.type||old.route.sessionID!==state.route.sessionID;
  if(changed)this.schedule();
  this.rows.update();const hadAnchor=Boolean(this.inline.anchor());this.inline.update(this.context.renderer.root,this.label(),this.fg(),false);
  if(old?.selected?.providerID!==state.selected?.providerID||old?.providerLabel!==state.providerLabel||(hadAnchor&&!this.inline.anchor()))this.scheduleInline();
 }
 label(){return this.state?.providerLabel;}
  fg(){return this.context.renderer.capabilities?.rgb===true?this.colors[this.state?.selected?.providerID]?.fg:undefined;}
 geometry(){return (this.snapshot?.rows??[]).flatMap(({node})=>[node.isDestroyed,node.parent,node.screenX,node.screenY,node.width,node.height]);}
 reconcile(){
  if(this.counts){this.counts.reconciles++;this.counts.discoveries++;}
  const d=discoverRows(this.context.renderer.root),tabs=this.state?.tabs??[];
  const unique=new Set(tabs.map(t=>t.title)).size===tabs.length&&new Set(tabs.map(t=>t.sessionID)).size===tabs.length;
   const byTitle=new Map(tabs.map(t=>[t.title,t.sessionID]));
   const ok=d.ok&&unique&&tabs.length===d.rows.length&&new Set(d.rows.map(r=>r.title)).size===d.rows.length&&d.rows.every(r=>byTitle.has(r.title));
   const byNode=new Map(ok?d.rows.map(r=>[r.node,byTitle.get(r.title)]):[]);
   if(!tabs.some(t=>t.sessionID===this.dragID))this.dragID=undefined;
   this.snapshot={rows:ok?d.rows:[],mapping:{ok},bindings:{get:n=>byNode.get(n)},dragID:this.dragID};
  this.rowGeometry=this.geometry();
  // Prune retired subtree listeners; never retain a remounted row.
  const keep=new Set([this.context.renderer,this.context.renderer.root]);
  for(const row of d.rows){for(let n=row.node;n&&n!==this.context.renderer.root;n=n.parent){keep.add(n);}}
  this.listeners=this.listeners.filter(x=>{if(keep.has(x.node)&&!x.node.isDestroyed)return true;x.node.off(x.event,x.fn);if(this.counts)this.counts.listeners--;return false;});
  for(const node of keep)if(node!==this.context.renderer){this.watch(node,'resize');this.watch(node,'destroyed');}
  this.rows.update();this.reconcileInline();
 }
  dispose(){if(this.disposed)return;this.disposed=true;this.releaseMouse?.();this.dragID=undefined;for(const x of [...this.listeners,...this.inlineListeners])x.node.off(x.event,x.fn);this.listeners=[];this.inlineListeners=[];if(this.counts)this.counts.listeners=0;this.rows.dispose();this.inline.dispose();this.snapshot=undefined;}
}
