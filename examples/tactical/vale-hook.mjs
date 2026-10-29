// Contract-tested against documented Claude Code 2.1.312 PostToolUse input.
// Direct handler tests do NOT establish dispatch by an actual Claude session.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
try{
 const event=JSON.parse(fs.readFileSync(0,'utf8'));
 if(event.hook_event_name!=='PostToolUse'||!['Edit','Write'].includes(event.tool_name))process.exit(0);
 if(typeof event.cwd!=='string'||typeof event.tool_input?.file_path!=='string')throw new Error('Invalid PostToolUse input');
 const cwd=fs.realpathSync(path.dirname(fileURLToPath(import.meta.url))),file=fs.realpathSync(event.tool_input.file_path);
 const relative=path.relative(cwd,file);
 if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Edited file is outside example project');
 if(!relative.startsWith('tickets'+path.sep)||path.extname(file)!=='.md')process.exit(0);
 const result=spawnSync(process.env.SPCA_VALE_BIN||'vale',['--config',path.join(cwd,'.vale.ini'),'--minAlertLevel=error','--output=line',file],{encoding:'utf8',timeout:10000,cwd});
 if(result.error||result.status!==0){process.stderr.write('Vale check failed after edit; fix the artifact. The edit already occurred.\n'+(result.stdout||'')+(result.stderr||'')+(result.error?.message||''));process.exit(2);}
}catch(error){process.stderr.write(`Vale hook input/execution failure: ${error.message}\n`);process.exit(2);}
