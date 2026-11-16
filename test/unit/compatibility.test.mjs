import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recolorText} from '../../src/text.mjs';
import {recolorText as previous} from '../reference/text.mjs';
import {validateColors} from '../../src/paint.mjs';
import {validateColors as previousPalette} from '../reference/paint.mjs';
test('six-digit and FF text are byte-identical to installed attention baseline',()=>{
 const samples=['#000000','#FFFFFF','#444444','#CCCCCC','#888888','#C8C8C8','#282828','#2828C8','#7878A0'];
 for(const value of samples)for(const base of samples)for(const background of samples)for(const glow of samples){
  const args=[value,base,background,glow],expected=previous(...args,'#F0A050');
  assert.equal(recolorText(...args,'#F0A050'),expected);assert.equal(recolorText(...args,'#F0A050FF'),expected);
 }
});
test('legacy palette and missing foreground fields retain exact values',()=>{
 // Labels now come from the SDK registry, not palette configuration. Keep the
  // redacted reference aligned to the retained default and explicitly configured
  // neutral fixture; compare every remaining color field exactly.
 const colorContract=palette=>Object.fromEntries(Object.entries(palette).map(([id,{label,...colors}])=>[id,colors]));
  for(const palette of [{},{'example-provider':'#EADBFF'},{openai:'#ABCDEF'},{openai:{bg:'#12345680'}},{openai:{bg:'#123456',sessionFg:'#ABCDEF',projectFg:'#FEDCBA',providerFg:'#ABCDEF'}}]){
  const actual=validateColors(palette);for(const colors of Object.values(actual))assert.equal(Object.hasOwn(colors,'label'),false);
  assert.deepEqual(colorContract(actual),colorContract(previousPalette(palette)));
 }
});
test('only openai is built in; arbitrary providers require explicit palette configuration',()=>{
 const defaults=validateColors();
 assert.deepEqual(Object.keys(defaults),['openai']);
 assert.equal(defaults['example-provider'],undefined);
 const configured=validateColors({'example-provider':'#EADBFF'});
 assert.deepEqual(Object.keys(configured),['openai','example-provider']);
 assert.equal(configured['example-provider'].bg,'#EADBFF');
 assert.equal(configured['example-provider'].fg,'#EADBFF');
});
