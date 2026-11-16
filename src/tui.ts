import type {Plugin} from '@opencode/plugin/tui';
import {createProviderColors} from './runtime.js';

// The host supplies its SDK context. Keep the public declaration independent of
// the SDK while checking this boundary against its pinned development contract.
export default {
 id:'opencode-provider-colors',
 setup(context:unknown){return createProviderColors(context as Plugin.Context)?.dispose;},
} satisfies Plugin.Definition;
