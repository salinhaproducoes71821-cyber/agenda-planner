const test=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
test('Metro rejects crafted ICNS before its vulnerable parser can loop',()=>{
  const script=`require('./build/image-size-policy.cjs'); const size=require('image-size'); const b=Buffer.alloc(16); b.write('icns'); b.writeUInt32BE(16,4); b.write('ic07',8); try {size(b); process.exit(2);} catch(e){if(!e.message.includes('disabled file type'))throw e;}`;
  execFileSync(process.execPath,['-e',script],{cwd:path.join(__dirname,'..'),timeout:5000});
});
test('Metro protection preserves PNG asset dimensions',()=>{
  require('../build/image-size-policy.cjs');
  const size=require('image-size');
  const image=size(path.join(__dirname,'../LogoNovaCorEnovosHighlightsNovo.png'));
  assert.ok(image.width>0 && image.height>0);
});
