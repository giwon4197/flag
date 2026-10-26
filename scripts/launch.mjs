import {existsSync} from 'node:fs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const major=Number(process.versions.node.split('.')[0]);
if(major<24){console.error('Use Node.js 24 LTS or the no-install Windows release ZIP.');process.exit(1);}
function npm(command) {
  const result=process.platform==='win32'
    ? spawnSync('cmd.exe',['/d','/s','/c',`npm ${command}`],{stdio:'inherit',env:process.env})
    : spawnSync('npm',command.split(' '),{stdio:'inherit',env:process.env});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`npm ${command} failed`);
}
try {
  const hash=createHash('sha256').update(await readFile('package-lock.json')).digest('hex');
  let previous='';try{previous=await readFile('.setup-state','utf8');}catch{}
  if(!existsSync('node_modules/vite') || previous!==hash){npm('ci');await writeFile('.setup-state',hash);}
  const model='public/models/pose_landmarker_lite.task';
  if(!existsSync(model)) {
    console.log('Downloading the official AI pose model...');
    const response=await fetch('https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',{signal:AbortSignal.timeout(120000)});
    if(!response.ok)throw new Error(`Model download failed: HTTP ${response.status}`);
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(bytes.length<100000)throw new Error('Invalid model download');
    await mkdir('public/models',{recursive:true});await writeFile(model,bytes);
  }
  process.env.VITE_POSE_MODEL_URL='/models/pose_landmarker_lite.task';
  // Rebuild source checkouts on each launch so updates cannot use an old dist.
  npm('run build');
  if(!process.argv.includes('--prepare-only')) {
    if(!process.argv.includes('--no-open'))process.argv.push('--open');
    await import('./serve.mjs');
  }
}catch(error){console.error(error.message);process.exitCode=1;}
