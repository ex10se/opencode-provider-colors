import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateColors} from '../../src/paint.mjs';
import {resolveBackground} from '../../src/soft.mjs';
test('object palette keeps independent text and state colors',()=>{
 const c=validateColors({openai:{bg:'#57A9811A',activeBg:'#57A98133',hoverBg:'#57A98103',sessionFg:'#FFFFFF',projectFg:'#AAAAAA'}}).openai;
 assert.equal(c.sessionFg,'#FFFFFF');assert.equal(c.projectFg,'#AAAAAA');assert.equal(c.fg,undefined);
 assert.equal(resolveBackground(c,'#4F4F4F',false,false),'#505854');
 assert.equal(resolveBackground(c,'#4F4F4F',true,false),'#516159');
});
test('alpha extremes and missing states use bg',()=>{
 const c=validateColors({openai:{bg:'#12345600'}}).openai;
 assert.equal(resolveBackground(c,'#4F4F4F',true,true),'#4F4F4F');
 const opaque=validateColors({openai:{bg:'#123456'}}).openai;
 assert.equal(resolveBackground(opaque,'#4F4F4F',true,true),'#123456');
});
test('legacy strings retain opacity and provider foreground',()=>{
 const c=validateColors({openai:'#B8EEE4'}).openai;
 assert.equal(c.fg,'#B8EEE4');assert.equal(resolveBackground(c,'#4F4F4F',true,false),'#545756');
});
test('reject malformed object fields and malformed foreground alpha',()=>{
 for(const x of [{bg:'#12345'},{bg:'#123456',typo:'#FFFFFF'},{bg:'#123456',sessionFg:'#FFFFFF8'},{}])assert.throws(()=>validateColors({openai:x}));
});
test('explicit hover wins over active, missing hover uses bg, not activeBg',()=>{
 const c=validateColors({openai:{bg:'#123456',activeBg:'#ABCDEF',hoverBg:'#FEDCBA'}}).openai;
 assert.equal(resolveBackground(c,'#4F4F4F',true,true),'#FEDCBA');
 const d=validateColors({openai:{bg:'#123456',activeBg:'#ABCDEF'}}).openai;
 assert.equal(resolveBackground(d,'#4F4F4F',true,true),'#123456');
 assert.equal(resolveBackground(d,'#4F4F4F',true,false),'#ABCDEF');
});
