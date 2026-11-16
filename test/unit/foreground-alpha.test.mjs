import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateColors} from '../../src/paint.mjs';
import {normalizeRGBA,equalRGBA} from '../../src/core.mjs';
import {recolorText} from '../../src/text.mjs';
import {nativeSurface} from '../../src/soft.mjs';
test('all named foreground fields accept RGBA, legacy strings remain RGB',()=>{
 for(const key of ['sessionFg','projectFg','providerFg'])for(const alpha of ['00','80','FF'])assert.equal(validateColors({openai:{bg:'#123456', [key]:'#ABCDEF'+alpha}}).openai[key],'#ABCDEF'+alpha);
 assert.throws(()=>validateColors({openai:'#ABCDEF80'}));
});
test('shared normalization supports alpha without weakening surface guards',()=>{
 assert.deepEqual(normalizeRGBA('#12345680'),[18,52,86,128,'rgb',0]);
 assert(equalRGBA('#123456FF','#123456'));assert(!equalRGBA('#12345680','#123456'));
 assert.equal(nativeSurface({opacity:1},'#12345680'),undefined);
 assert.equal(nativeSurface({opacity:1,parent:{backgroundColor:'#445566'}},'#12345600'),'#445566');
});
test('alpha applies after fade and glow, FF is identical to RGB',()=>{
 for(const native of ['#C8C8C8','#7878A0']){
  const args=[native,'#C8C8C8','#282828','#2828C8'];const opaque=recolorText(...args,'#F0A050');
  assert.equal(recolorText(...args,'#F0A050FF'),opaque);
  assert.equal(recolorText(...args,'#F0A05080'),opaque+'80');
  assert.equal(recolorText(...args,'#F0A05000'),opaque+'00');
 }
});
test('ambiguous effects retain native RGB but never discard requested partial alpha',()=>{
 const args=['#888888','#444444','#444444','#444444'];
 assert.equal(recolorText(...args,'#FFAA00'),undefined);
 assert.equal(recolorText(...args,'#FFAA00FF'),undefined);
 assert.equal(recolorText(...args,'#FFAA0080'),'#88888880');
 assert.equal(recolorText(...args,'#FFAA0000'),'#88888800');
});
