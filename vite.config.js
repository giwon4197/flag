import {defineConfig} from 'vite';
import {resolve} from 'node:path';
import {createLeaderboard,handleLeaderboardApi} from './scripts/leaderboard.mjs';

async function attachApi(server) {
  const store=await createLeaderboard(process.env.FLAG_DATA_FILE || resolve('data/leaderboard.json'));
  server.middlewares.use((req,res,next)=>{
    handleLeaderboardApi(req,res,store).then(handled=>{if(!handled)next();}).catch(next);
  });
}
export default defineConfig({plugins:[{name:'flag-leaderboard',configureServer:attachApi,configurePreviewServer:attachApi}]});
