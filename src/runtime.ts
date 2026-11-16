import type {Plugin} from '@opencode/plugin/tui';
import {createEffect,untrack} from 'solid-js';
import {validateColors} from './paint.mjs';
import {EventController} from './events.mjs';
import {readObservedState} from './observer.mjs';
import {validateOpacity} from './soft.mjs';
import {supportsVersion} from './core.mjs';

/** Internal lifecycle factory; the package exports only the TUI entry. */
export function createProviderColors(context:Plugin.Context){
 if(!supportsVersion(context.app.version)||context.renderer.capabilities?.rgb!==true)return;
 let colors;try{colors=validateColors(context.options.providerColors);validateOpacity(context.options.providerRowOpacity);}catch{return;}
 const controller=new EventController(context,colors);
 const remove=context.ui.slot({append:'app',render:()=>{
  createEffect(()=>{
   const state=readObservedState(context);
   untrack(()=>controller.update(state));
  });return null;
 }});
 return {controller,dispose(){remove();controller.dispose();}};
}
