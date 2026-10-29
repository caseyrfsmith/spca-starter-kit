import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {validateTicket} from './ticket.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));const folder=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'tickets');
let failed=false;for(const name of fs.readdirSync(folder).filter(n=>n.endsWith('.md'))){
 const file=path.join(folder,name),result=validateTicket(fs.readFileSync(file,'utf8'));
 if(!result.valid){console.error(file,result.errors);failed=true;}
 const lint=spawnSync('vale',['--config',path.join(root,'.vale.ini'),'--minAlertLevel=error','--output=line',file],{encoding:'utf8',timeout:10000});
 if(lint.status!==0||lint.error){console.error(lint.stdout||lint.stderr||lint.error?.message);failed=true;}
}process.exitCode=failed?1:0;
