import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recolorText} from '../../src/text.mjs';
test('native plain foreground becomes custom foreground',()=>assert.equal(recolorText('#CCCCCC','#CCCCCC','#444444','#444444','#FFAA00'),'#ffaa00'));
test('fade preserves native weight and background endpoint',()=>assert.equal(recolorText('#888888','#CCCCCC','#444444','#444444','#FFAA00'),'#a27722'));
test('glow contribution is preserved separately from custom base',()=>assert.equal(recolorText('#7878A0','#C8C8C8','#282828','#2828C8','#F0A050'),'#8c6464'));
test('unknown and degenerate styles fail closed',()=>assert.equal(recolorText('#888888','#444444','#444444','#444444','#FFAA00'),undefined));
