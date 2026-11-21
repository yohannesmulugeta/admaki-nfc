import {readFileSync,existsSync,statSync} from 'node:fs';
export const assets={fetch:async req=>{let path='public'+new URL(typeof req==='string'?req:req.url).pathname;if(existsSync(path)&&statSync(path).isDirectory())path+='/index.html';return existsSync(path)?new Response(readFileSync(path)):new Response('Not found',{status:404});}};
