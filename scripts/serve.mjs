import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {dirname, resolve, sep, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createLeaderboard, handleLeaderboardApi} from './leaderboard.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const leaderboard=await createLeaderboard(process.env.FLAG_DATA_FILE || resolve(root,'../data/leaderboard.json'));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm','.json':'application/json','.svg':'image/svg+xml','.task':'application/octet-stream'};
try {await stat(resolve(root,'index.html'));} catch {console.error('Missing dist/index.html. Run npm ci and npm run build first.');process.exit(1);}
const port=Number(process.env.FLAG_GAME_PORT || 5173);
if(!Number.isInteger(port) || port<1 || port>65535)throw new Error('Invalid FLAG_GAME_PORT');
const server=createServer(async(req,res)=>{
 if(await handleLeaderboardApi(req,res,leaderboard))return;
 try {
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!path.startsWith(root+sep)){res.writeHead(403);res.end('Forbidden');return;}
  const data=await readFile(path);
  res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
  res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404);res.end('Not found');}
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Port 5173 is already in use. Close the other game window/terminal, then retry.':error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{
 console.log(`\nBlue / White AI Game: http://localhost:${port}\nKeep this window open. Press Ctrl+C to stop.\n`);
 if(process.argv.includes('--open') && process.platform==='win32'){
  const child=spawn('cmd.exe',['/d','/c','start','',`http://localhost:${port}`],{stdio:'ignore'});
  child.on('error',()=>console.log('Open http://localhost:5173 in your browser.'));
 }
});
