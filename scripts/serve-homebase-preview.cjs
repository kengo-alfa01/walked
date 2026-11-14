/* Work-branch-only static server for StackBlitz review. No writes or deployment. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.topojson':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
const port=Number(process.env.PORT||3000);
const server=http.createServer((req,res)=>{
 let url;
 try {url=new URL(req.url,'http://localhost');}catch{res.writeHead(400).end();return;}
 let pathname=url.pathname;
 if(pathname==='/')pathname='/index.html';
 let file;
 try{file=decodeURIComponent(pathname);}catch{res.writeHead(400).end();return;}
 const absolute=path.resolve(root,'.'+file);
 if(!absolute.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 if(file.startsWith('/.git/')||file.startsWith('/tests/')||file.startsWith('/.github/')||file.startsWith('/scripts/')||file.includes('..')||file.startsWith('/.qa-assets/')){res.writeHead(403).end();return;}
 fs.stat(absolute,(error,stats)=>{
  if(error||!stats.isFile()){res.writeHead(404).end('Not found');return;}
  res.setHeader('Content-Type',types[path.extname(absolute).toLowerCase()]||'application/octet-stream');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  const stream=fs.createReadStream(absolute);
  stream.on('error',()=>{if(!res.headersSent)res.writeHead(500);res.end();});
  stream.pipe(res);
 });
});
server.listen(port,'0.0.0.0',()=>process.stdout.write('HOMEBASE_PREVIEW_READY http://localhost:'+port+'\n'));
