import QRCode from 'qrcode/lib/core/qrcode.js';
import SVG from 'qrcode/lib/renderer/svg-tag.js';
const crc32=bytes=>{let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
function chunk(name,data){const out=new Uint8Array(data.length+12),view=new DataView(out.buffer);view.setUint32(0,data.length);out.set(new TextEncoder().encode(name),4);out.set(data,8);view.setUint32(data.length+8,crc32(out.subarray(4,data.length+8)));return out;}
export async function qrResponse(req,card,format){
 const origin=new URL(req.url).origin,url=origin+'/'+card.slug+'/',qr=QRCode.create(url,{errorCorrectionLevel:'M'});let body;
 if(format==='svg')body=SVG.render(qr,{margin:4,width:256});
 else{
  const size=qr.modules.size+8,scale=Math.max(1,Math.floor(320/size)),width=size*scale,raw=new Uint8Array(width*(width+1));
  for(let y=0;y<width;y++)for(let x=0;x<width;x++){const row=Math.floor(y/scale)-4,col=Math.floor(x/scale)-4;raw[y*(width+1)+x+1]=row>=0&&col>=0&&row<qr.modules.size&&col<qr.modules.size&&qr.modules.get(row,col)?0:255;}
  const compressed=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer()),header=new Uint8Array(13);new DataView(header.buffer).setUint32(0,width);new DataView(header.buffer).setUint32(4,width);header[8]=8;
  body=new Blob([new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',compressed),chunk('IEND',new Uint8Array())]);
 }
 return new Response(req.method==='HEAD'?null:body,{headers:{'content-type':format==='svg'?'image/svg+xml':'image/png','cache-control':'public,max-age=86400','x-content-type-options':'nosniff'}});
}
