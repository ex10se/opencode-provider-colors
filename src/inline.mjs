import { normalizeRGBA, equalRGBA } from './core.mjs';
function leafOf(renderable) {
 const root=renderable?.textNode,children=root?.children;
 if(root?.textParent!==renderable||!Array.isArray(children)||children.length!==1)return;
 const leaf=children[0];
 if(leaf?.parent!==root||!Array.isArray(leaf.children)||leaf.children.length!==1||typeof leaf.children[0]!=='string')return;
 return leaf;
}
function attached(node,root){let depth=0;for(let n=node;n&&depth++<100;n=n.parent){if(n.isDestroyed)return false;if(n===root)return true;if(!n.parent?.getChildren?.().includes(n))return false;}return false;}
function findEditor(root){
 const editors=[],seen=new Set(),stack=[root];
 while(stack.length&&seen.size<10000){const n=stack.pop();if(!n||seen.has(n))continue;seen.add(n);if(n.editorView&&n.editBuffer&&!n.isDestroyed)editors.push(n);stack.push(...(n.getChildren?.()??[]));}
 return !stack.length&&editors.length===1?editors[0]:undefined;
}
// Addressed composer lookup also works after its initially zero-size editor lays out.
function providerOf(editor,root,label,ready=true){
 if(!editor||!attached(editor,root)||(ready&&!(editor.width>0&&editor.height>0))||typeof label!=='string'||!label)return;
 try {
  const surface=editor.parent,children=surface?.getChildren?.()??[],index=children.indexOf(editor);if(index<0)return;
  const footer=children[index+1];
  const lines=footer?.getChildren?.()??[];if(lines.length!==1||footer.parent!==surface)return;
  const line=lines[0],parts=line.getChildren?.()??[];
  if(![2,3].includes(parts.length)||!parts[0].textNode||line.parent!==footer)return;
  // Autoaccept inserts one native "auto" leaf between agent and model group.
  if(parts.length===3&&(parts[1].parent!==line||leafOf(parts[1])?.children[0]!=='auto'))return;
  const group=parts.at(-1),texts=(group.getChildren?.()??[]).filter(n=>n.textNode),provider=texts[2],leaf=leafOf(provider);
  if(group.parent!==line||texts.length<3||texts.length>5||leafOf(texts[0])?.children[0]!=='·'||!leafOf(texts[1])?.children[0]||leaf?.children[0]!==label||!(ready?provider.height===1&&provider.width>0:[0,1].includes(provider.height)&&provider.width>=0)||provider.parent!==group||provider.isDestroyed)return;
  return leaf;
 }catch{return;}
}
// Full discovery is reserved for structural events, never called by layout binding.
export function findInlineProvider(root,label){if(typeof label!=='string'||!label)return;try{return providerOf(findEditor(root),root,label);}catch{return;}}
const descriptor=node=>{let p=Object.getPrototypeOf(node),d;while(p&&!d){d=Object.getOwnPropertyDescriptor(p,'fg');p=Object.getPrototypeOf(p);}return d;};
export class InlineProvider {
 #node; #restore; #set; #color; #editor; #root; #label;
 anchor(){return this.#node&&providerOf(this.#editor,this.#root,this.#label,false)===this.#node?this.#node.parent.textParent:undefined;}
 editor(){return attached(this.#editor,this.#root)?this.#editor:undefined;}
 pending(){return Boolean(this.editor()&&!this.anchor());}
 bindPending(root,label,color){if(this.pending())this.update(root,label,color,false);}
  update(root,label,color,discover=true){
   let editor=this.#root===root&&attached(this.#editor,root)?this.#editor:undefined;
   const usable=normalizeRGBA(color)&&typeof label==='string'&&label.length>0;
   if(!usable)editor=undefined;
   else if(discover&&!editor){try{editor=findEditor(root);}catch{editor=undefined;}}
   // The existing metadata leaf must be colored before native layout prepares
   // text chunks. Its identity/ancestry are meaningful even at initial 0x0 size.
   const node=providerOf(editor,root,label,false);
   if(node!==this.#node){
   this.dispose();this.#editor=editor;this.#root=root;this.#label=label;
   if(!node||Object.hasOwn(node,'fg')||!Object.isExtensible(node))return;
   const d=descriptor(node);if(!d?.get||!d?.set)return;
   let native=d.get.call(node);if(native!==undefined&&!normalizeRGBA(native))return;
   this.#node=node;this.#color=color;
   const get=function(){return d.get.call(this);};
   const set=value=>{native=value;d.set.call(node,value===undefined||normalizeRGBA(value)?this.#color:value);};
   Object.defineProperty(node,'fg',{configurable:true,enumerable:d.enumerable,get,set});
   this.#set=value=>d.set.call(node,value);
   this.#restore=()=>{const current=Object.getOwnPropertyDescriptor(node,'fg');if(current?.get!==get||current?.set!==set)return;delete node.fg;if(!node.parent?.textParent?.isDestroyed)d.set.call(node,native);};
   }
   this.#editor=editor;this.#root=root;this.#label=label;
  this.#color=color;
  if(node&&!equalRGBA(node.fg,color))this.#set?.(color);
 }
 dispose(){this.#restore?.();this.#restore=undefined;this.#set=undefined;this.#node=undefined;this.#color=undefined;this.#editor=undefined;this.#root=undefined;this.#label=undefined;}
}
