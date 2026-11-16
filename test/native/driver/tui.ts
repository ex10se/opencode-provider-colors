import {Plugin} from '@opencode/plugin/tui';
import {writeFileSync, readFileSync, renameSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {createProviderColors} from '../../../src/runtime.ts';
import {discoverRows} from '../../../src/probe.mjs';
import {frameColors} from './frame.mjs';
import {normalizeRGBA} from '../../../src/core.mjs';
import {assertIsolation} from './isolation';
import {nullRun} from './null-run';
import {alphaRun} from './alpha';
import {dragRun} from './drag';

// Preserve reactive getters (notably location); never spread the host context.
const override = (target: any, values: Record<string, unknown>) => new Proxy(target, {
  get(object, key) { return Object.hasOwn(values, key) ? values[key as string] : Reflect.get(object, key, object); },
});

export default Plugin.define({id: 'provider-colors-native-driver', setup(c: any) {
  const root = assertIsolation(c.options.fixtureRoot);
  if (!['2.2.5', '2.2.7'].includes(c.app.version)) throw Error('native driver requires OpenCode 2.2.5 or 2.2.7');
  const write = (name: string, value: any) => {
    const path = join(root, name);
    writeFileSync(path + '.tmp', JSON.stringify(value, null, 2));
    renameSync(path + '.tmp', path);
  };
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const abort = new AbortController();
  const owned: string[] = [], assertions: any = {}, details: any = {};
  let instance: ReturnType<typeof createProviderColors>, latest: any, frame = 0, stopped = false;
  let palette: any, alpha = '', omitted = false, rgbOff = false;
  const options = () => ({providerColors: palette ?? {
    openai: {bg: '#00000000', activeBg: '#57A98133', hoverBg: '#00000000',
      ...(!omitted ? {providerFg: '#57A981' + alpha, sessionFg: '#FF0000' + alpha, projectFg: '#000000' + alpha} : {})},
    'fixture-green': {bg: '#3986181A', activeBg: '#39861833', hoverBg: '#39861803',
      ...(!omitted ? {providerFg: '#398618' + alpha, sessionFg: '#FF0000' + alpha, projectFg: '#000000' + alpha} : {})},
  }});
  const start = () => {
    if (instance) throw Error('already started');
    assertIsolation(root);
    const renderer = rgbOff ? override(c.renderer, {capabilities: {rgb: false}}) : c.renderer;
    instance = createProviderColors(override(c, {options: options(), renderer}));
    if (instance) instance.controller.counts = {discoveries: 0, inlineDiscoveries: 0, reconciles: 0, updates: 0, listeners: 0};
    else if (!rgbOff) throw Error('runtime factory declined native context');
  };
  const stop = () => { instance?.dispose(); instance = undefined; };
  const ctrl = () => instance?.controller;
  const rect = (node: any) => ({x: node.screenX, y: node.screenY, width: node.width, height: node.height});
  const hex = (color: any) => '#' + [...color.buffer].slice(0, 3).map(n => n.toString(16).padStart(2, '0')).join('');
  const grid = (lines: any[]) => lines.map(line => line.spans.flatMap((span: any) =>
    Array.from(span.text).map(char => [char, hex(span.fg), hex(span.bg), span.attributes])));
  const rowOf = (id: string) => {
    const title = c.ui.tabs.list().find((tab: any) => tab.sessionID === id)?.title;
    return discoverRows(c.renderer.root).rows.find((row: any) => row.title === title);
  };
  const internal = (id: string) => rowOf(id)?.node.getChildren().flatMap((node: any) => node.getChildren?.() ?? [])
    .filter((node: any) => node._edge === undefined && typeof node.inner?.advance === 'function') ?? [];
  const post = (buffer: any) => { latest = {lines: buffer.getSpanLines(), at: Date.now(), frame: ++frame}; };
  c.renderer.addPostProcessFn(post);
  const gaps = (shot: any) => {
    const rows = discoverRows(c.renderer.root).rows;
    const session = (row: any) => c.ui.tabs.list().find((tab: any) => tab.title === row.title)?.sessionID;
    return rows.slice(1).map((row: any, i: number) => {
      const node = row.node.getChildren().find((n: any) => n._edge === 'above'), box = rect(node);
      return {upper: session(rows[i]), lower: session(row), rect: box,
        cells: shot.cells[box.y]?.slice(box.x, box.x + box.width),
        effect: [node.inner, node.outer].some(p => p.running > 0 || p.flash > 0 || p.completion > 0 || p.glowLevel > 0)};
    });
  };
  const capture = async (name?: string) => {
    const before = frame;
    c.renderer.requestRender();
    for (let i = 0; i < 20 && frame === before; i++) await delay(20);
    if (frame === before) throw Error('no-frame');
    const shot: any = {...latest, cells: grid(latest.lines)};
    shot.rows = owned.map(id => {
      const node = rowOf(id)?.node;
      if (!node) throw Error('missing native row');
      const box = rect(node);
      return {id, rect: box, pixels: frameColors(shot.lines, box),
        cells: shot.cells.slice(box.y, box.y + box.height).map((line: any) => line.slice(box.x, box.x + box.width)),
        background: normalizeRGBA(node.backgroundColor), own: Object.hasOwn(node, 'backgroundColor'),
        tab: {...c.ui.tabs.list().find((tab: any) => tab.sessionID === id)}};
    });
    shot.gaps = gaps(shot);
    if (name) write(name + '.json', shot);
    return shot;
  };
  const wait = async (predicate: () => boolean, label: string, ms = 6000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (stopped) throw Error('stopped');
      if (predicate()) return;
      await delay(40);
    }
    throw Error(label);
  };
  const read = async (id: string) => {
    const idle = c.data.session.get(id)?.time.idle;
    if (idle !== undefined) await c.client.session.view({sessionID: id, idle}, {signal: abort.signal});
  };
  const hover = async (seq: number, x: number, y: number) => {
    write('request.json', {seq, kind: 'hover', x, y});
    await wait(() => existsSync(join(root, 'ack.json')) && JSON.parse(readFileSync(join(root, 'ack.json'), 'utf8')).seq === seq, 'hover-ack');
    await delay(120);
  };
  let mouseSeq = 10000;
  const mouse = async (kind: string, x: number, y: number) => {
    const seq = ++mouseSeq;
    write('request.json', {seq, kind, x, y});
    await wait(() => existsSync(join(root, 'ack.json')) && JSON.parse(readFileSync(join(root, 'ack.json'), 'utf8')).seq === seq, 'mouse-ack');
    await delay(120);
  };
  const dispose = () => { stopped = true; stop(); abort.abort(); c.renderer.removePostProcessFn(post); };
  void (async () => {
    let failure = null;
    try {
      await delay(400);
      if (c.ui.tabs.list().length || c.data.session.list().length) throw Error('not-empty');
      assertions.truecolor = c.renderer.capabilities?.rgb === true;
      if (!assertions.truecolor) throw Error('requires-rgb');
      for (let i = 0; i < 3; i++) {
        const session = await c.client.session.create({title: c.options.mode === 'text'
          ? `Long synthetic session ${i + 1} with enough text to exercise fading and marquee across the rail`
          : `Native fixture ${i + 1}`, model: {id: 'pc-fixture', providerID: i === 1 ? 'fixture-green' : 'openai'},
          location: {directory: process.cwd()}, permissions: [{action: '*', resource: '*', effect: i === 2 ? 'ask' : 'deny'}]}, {signal: abort.signal});
        owned.push(session.id); await c.data.session.sync(session.id); c.ui.tabs.open(session.id);
      }
      await delay(400);
      const helpers = {c, owned, start, stop, capture, delay, wait, rowOf, internal, hover, mouse, read, ctrl, assertions, details,
        setPalette: (v: any) => palette = v, setAlpha: (v: string) => alpha = v,
        setOmitted: (v: boolean) => omitted = v, setRGBOff: (v: boolean) => rgbOff = v,
        releaseBusy: () => writeFileSync(join(root, 'release-busy'), 'release')};
      if (c.options.mode === 'drag') await dragRun(helpers);
      else if (c.options.mode === 'null') await nullRun(helpers);
      else await alphaRun(helpers);
    } catch (error) { failure = error instanceof Error ? error.stack : String(error); }
    finally { dispose(); write('result.json', {stage: c.options.mode, failure, assertions, details}); }
  })();
  return dispose;
}});
