'use strict';
// Local-only server. Browser tests intercept /api/account; no mock backend is deployed.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../public'),handler=require('../api/account');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname==='/api/account'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>510000){res.writeHead(413);return res.end();}}req.query=Object.fromEntries(url.searchParams);req.body=raw;await handler(req,res);return;}const p=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!p.startsWith(root+path.sep)){res.writeHead(403);return res.end();}try{const data=fs.readFileSync(p);res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'text/plain','Cache-Control':'no-store'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}}).listen(8091,'127.0.0.1',()=>console.log('Corrupt Drive dev server: http://127.0.0.1:8091'));
