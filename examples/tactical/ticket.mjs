import {unified} from 'unified';import remarkParse from 'remark-parse';
const required=['Problem','Expected outcome','Acceptance criteria','Context and references'];
const allowed=new Set([...required,'Implementation notes']);
function text(n){if(n.type==='html')return '';return n.value??(n.children||[]).map(text).join(' ');}
export function validateTicket(markdown){
 const tree=unified().use(remarkParse).parse(markdown),errors=[];
 const titles=tree.children.filter(n=>n.type==='heading'&&n.depth===1);
 if(titles.length!==1||!text(titles[0]).trim())errors.push('Exactly one nonempty H1 title is required.');
 const sections=new Map();let active;
 for(const n of tree.children){
  if(n.type==='heading'&&n.depth===2){const label=text(n).trim();if(!allowed.has(label))errors.push(`Unknown section: ${label}`);if(sections.has(label))errors.push(`Duplicate section: ${label}`);sections.set(label,[]);active=label;}
  else if(active)sections.get(active).push(n);
 }
 for(const label of required){const content=sections.get(label);if(!content)errors.push(`Missing section: ${label}`);else if(!content.map(text).join(' ').trim())errors.push(`Empty section: ${label}`);}
 if(sections.has('Acceptance criteria')&&!sections.get('Acceptance criteria').some(n=>n.type==='list'&&n.children.length))errors.push('Acceptance criteria must include a list.');
 if(/\[\[TODO:[\s\S]*?\]\]/i.test(markdown))errors.push('Unresolved TODO marker.');
 return {valid:errors.length===0,errors,title:titles.length?text(titles[0]).trim():'',semanticReviewRequired:true};
}
// Local example adapter contract, NOT a Linear MCP tool signature.
export async function submitReviewedTicket(adapter,payload,{humanApproved=false}={}){
 const check=validateTicket(payload.description);if(!check.valid)throw new Error(check.errors.join('\n'));
 if(!humanApproved)throw new Error('Human approval required; structural validity is insufficient.');
 if(payload.title!==check.title||!payload.project)throw new Error('Title/project mismatch or missing project.');
 let created;try{created=await adapter.create(structuredClone(payload));}catch{throw new Error('Create outcome unresolved. Inspect existing issues before any retry.');}
 if(!created?.id)throw new Error('No created identifier; outcome unresolved.');
 const actual=await adapter.read(created.id);
 for(const field of ['title','description','project','assignee'])if(actual?.[field]!==payload[field])throw new Error(`Persistence mismatch: ${field}`);
 return {id:created.id,verified:true};
}
