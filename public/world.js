/* Deterministic world simulation. No DOM, network, passwords, or real-time timers. */
const World=(()=>{
 const E=Engine, SK=Object.keys(E.skills), MI=1048576;
 const rooms=['BOOT','SYSTEM','USERS','MEDIA','ARCHIVE','DELETED'];
 const perks={buffer:{name:'Error correction',desc:'Wrong answers cost 4 less integrity.',max:2},compress:{name:'Lossless packer',desc:'Cargo reservations use 25% less buffer space. Fictional packing ratio; question answers never change.',max:1},memory:{name:'Recovery buffer',desc:'Add 1 MiB of cargo capacity.',max:2},overclock:{name:'Overclock',desc:'Double scrap from repairs; corruption advances faster.',max:1},forensic:{name:'Forensic scanner',desc:'Reveal deleted fragments without spending a scan.',max:1},parser:{name:'ASCII parser',desc:'Read environmental hex messages. Never solves graded questions.',max:1},scheduler:{name:'Process scheduler',desc:'Watchdog and cleanup processes move half as often.',max:1},lens:{name:'Fragment locator',desc:'Scan reveals the full map, including hidden fragments.',max:1},backup:{name:'Restore point',desc:'Survive one fatal error with 35 integrity.',max:1},charge:{name:'Parallel scanner',desc:'Gain 3 charges; future layers grant 1 extra.',max:2}};
 const fresh=()=>({version:2,config:{topics:[...SK],difficulty:'adaptive',units:'binary',pressure:'standard',sound:false},stats:Object.fromEntries(SK.map(k=>[k,{attempts:0,correct:0,recent:[]}])),archive:{},restored:{boot:0,system:0,users:0,image:0,audio:0,archive:0},discoveries:[],history:[],tutorialDone:false,repairs:0,run:null});
 const count=(r,id)=>r.upgrades.filter(k=>k===id).length;
 const rand=r=>E.rng((r.seed+ ++r.serial*17431)>>>0)();
 const choose=(r,a)=>a[Math.floor(rand(r)*a.length)];
 const idx=(r,x,y)=>y*r.w+x;
 const inBounds=(r,x,y)=>x>=0&&y>=0&&x<r.w&&y<r.h;
 const floor=(r,x,y)=>inBounds(r,x,y)&&r.tiles[idx(r,x,y)]!==1;
 const partCount=n=>[0,1,2,3].filter(i=>n&(1<<i)).length;
 const size=n=>n>=MI?(n/MI).toFixed(2)+' MiB':n>=1024?(n/1024).toFixed(1)+' KiB':n+' bytes';
 const capacity=r=>(2+count(r,'memory'))*MI;
 const used=r=>r.cargo.reduce((a,c)=>a+c.bytes,0)*(count(r,'compress')?.75:1);
 const log=(r,text,kind='normal')=>{r.log.unshift({text,kind,turn:r.turn});r.log=r.log.slice(0,24);};
 const discover=(s,id)=>{if(!s.discoveries.includes(id))s.discoveries.push(id);};
 function reveal(r,radius=3){for(let y=r.y-radius;y<=r.y+radius;y++)for(let x=r.x-radius;x<=r.x+radius;x++)if(inBounds(r,x,y)&&Math.abs(x-r.x)+Math.abs(y-r.y)<=radius)r.seen[idx(r,x,y)]=1;}
 function pickSkill(s,r){return E.weightedSkill(()=>rand(r),r.config.topics,s.stats);}
 function makeQuestion(s,r,skill){
  let level=1;const st=s.stats[skill]||{recent:[]},recent=st.recent||[],acc=recent.length?recent.filter(Boolean).length/recent.length:.6;
  if(r.config.difficulty==='challenge')level=3;else if(r.config.difficulty==='adaptive')level=Math.max(1,Math.min(3,r.depth+(recent.length>=4&&acc>.8?1:0)-(recent.length>=3&&acc<.5?1:0)));
  if(r.tutorial)return {skill:'units',kind:'number',answer:2,rawAnswer:2,displayAnswer:'2',unit:'bytes',tolerance:0,prompt:'A damaged register contains 16 bits. How many bytes is that?',facts:[['Block size','16 bits'],['Rule','1 byte = 8 bits']],steps:['16 ÷ 8 = 2 bytes.'],hint:'One byte contains 8 bits. Divide 16 by 8.'};
  return E.question(skill,level,r.config.units,r.seed+ ++r.serial*17389,r.config.topics);
 }
 function createRun(s,mission='recovery',seed=Date.now()>>>0){const r={seed,serial:0,depth:1,turn:0,x:2,y:4,integrity:100,charges:3,scrap:0,corruption:0,cargo:[],upgrades:[],backedUp:false,repairs:0,attempts:0,correct:0,banked:0,bankedBytes:0,maxDepth:1,anchors:0,mission,target:'platform',targetFound:false,log:[],question:null,config:JSON.parse(JSON.stringify(s.config))};r.target=Archive.find(f=>partCount(s.archive[f.id]||0)<4)?.id||'platform';if(mission==='target'&&Archive.every(f=>partCount(s.archive[f.id]||0)===4))r.mission='diagnostic';generate(s,r);s.run=r;log(r,'ECHO-07 mounted. The original drive is read-only.','good');return r;}
 function generate(s,r){
  r.w=27;r.h=19;r.tiles=Array(r.w*r.h).fill(1);r.seen=Array(r.w*r.h).fill(0);r.corrupt=[];r.nodes=[];r.processes=[];r.anchors=0;r.x=2;r.y=4;r.question=null;r.scanned=s.restored.archive>=25;r.shortcutOpen=false;
  for(let row=0;row<2;row++)for(let col=0;col<3;col++)for(let y=1+row*10;y<=7+row*10;y++)for(let x=1+col*9;x<=7+col*9;x++)r.tiles[idx(r,x,y)]=0;
  for(const y of [4,14])for(let x=1;x<26;x++)r.tiles[idx(r,x,y)]=0;
  for(const x of [4,13,22])for(let y=4;y<=14;y++)r.tiles[idx(r,x,y)]=0;
  for(let room=0;room<6;room++){const bx=(room%3)*9,by=Math.floor(room/3)*10;for(let j=0;j<2;j++){const xx=bx+choose(r,[2,3,5,6]),yy=by+choose(r,[2,3,5,6]);r.tiles[idx(r,xx,yy)]=1;}}
  const occupied=new Set();
  function add(type,x,y,extra={}){occupied.add(idx(r,x,y));const n={id:'n'+r.nodes.length,type,x,y,done:false,...extra};r.nodes.push(n);return n;}
  function spot(room){let cells=[];for(let y=1;y<18;y++)for(let x=1;x<26;x++)if(floor(r,x,y)&&!occupied.has(idx(r,x,y))&&!(y>=8&&y<=10)&&!(x%9===8||x%9===0)&&(!(x===r.x&&y===r.y))&&(room===undefined||Math.floor(x/9)+(y>9?3:0)===room))cells.push([x,y]);return choose(r,cells);}
  add('exit',2,4);add('core',24,14);
  for(const room of [0,1,4])add('anchor',...spot(room),{skill:pickSkill(s,r)});
  for(let i=0;i<10;i++)add('repair',...spot(),{skill:pickSkill(s,r),unstable:rand(r)<.3});
  const assigned=new Set();
  for(let i=0;i<9;i++){
   let options=[];for(const f of Archive)for(let part=0;part<4;part++)if(!(s.archive[f.id]&(1<<part))&&!r.cargo.some(c=>c.fileId===f.id&&c.part===part)&&!assigned.has(f.id+part))options.push({f,part});
   if(!options.length)break;
   let choice=i===0&&r.mission==='target'?options.find(c=>c.f.id===r.target):null;if(!choice){const weights=options.map(o=>o.f.rarity==='ANOMALY'?0.18:o.f.rarity==='DELETED'?0.45:o.f.rarity==='SYSTEM'?0.65:1);let t=rand(r)*weights.reduce((a,b)=>a+b,0);choice=options[options.length-1];for(let j=0;j<options.length;j++){t-=weights[j];if(t<=0){choice=options[j];break;}}}const {f,part}=choice;assigned.add(f.id+part);
   const location=spot(i>=7?5:undefined);add('file',...location,{fileId:f.id,part,bytes:f.bytes/4,hidden:i>=7,locked:rand(r)<.55,skill:r.config.topics.includes(f.type==='text'?'ascii':f.type)?(f.type==='text'?'ascii':f.type):pickSkill(s,r)});
  }
  for(let i=0;i<4;i++)add('cache',...spot(),{choices:Object.keys(perks).filter(k=>count(r,k)<perks[k].max).sort((a,b)=>a.localeCompare(b)).map(k=>({k,v:rand(r)})).sort((a,b)=>a.v-b.v).slice(0,3).map(o=>o.k)});
  for(let i=0;i<2;i++)add('station',...spot());
  add('clue',...spot(2),{text:'4D 41 59 41',decoded:'MAYA'});add('clue',...spot(5),{text:'45 43 48 4F',decoded:'ECHO',secret:true});
  add('shortcut',13,9,{open:false});
  for(let i=0;i<12;i++){const p=spot();if(p&&Math.abs(p[0]-2)+Math.abs(p[1]-4)>5)r.corrupt.push(idx(r,...p));}
  for(const [type,room] of [['indexer',1],['watchdog',4],['cleanup',5]]){const [x,y]=spot(room);r.processes.push({id:type,type,x,y,disabled:0});}
  reveal(r,s.restored.system>=25?4:3);log(r,['Boot partition','User partition','Deep archive'][r.depth-1]+' mounted. Repair three anchors to open the core.','info');
 }
 function tutorial(s){const r=createRun(s,'recovery',1234567);r.tutorial=true;r.w=7;r.h=5;r.tiles=Array(35).fill(1);for(let x=1;x<=5;x++)r.tiles[2*7+x]=0;r.seen=Array(35).fill(1);r.corrupt=[];r.processes=[];r.x=1;r.y=2;r.stage=0;r.nodes=[{id:'cache',type:'cache',x:2,y:2,choices:['buffer','memory','parser']},{id:'repair',type:'repair',x:3,y:2,skill:'units'},{id:'file',type:'file',x:4,y:2,fileId:'note',part:0,bytes:8192,locked:false},{id:'exit',type:'exit',x:5,y:2}];r.log=[];return r;}
 function hurt(r,n){r.integrity=Math.max(0,r.integrity-n);if(!r.integrity&&count(r,'backup')&&!r.backedUp){r.backedUp=true;r.integrity=35;log(r,'Restore point consumed. Process restored at 35 integrity.','good');}}
 function tick(s,r){
  r.turn++;if(r.tutorial)return;
  r.corruption=Math.min(100,r.corruption+(r.config.pressure==='gentle'?.18:.35)+(count(r,'overclock')?.25:0));
  if(r.turn%6===0&&r.corrupt.length){let n=choose(r,r.corrupt),x=n%r.w,y=Math.floor(n/r.w),d=choose(r,[[1,0],[-1,0],[0,1],[0,-1]]),k=idx(r,x+d[0],y+d[1]);if(floor(r,x+d[0],y+d[1])&&!r.corrupt.includes(k)&&!(x+d[0]===2&&y+d[1]===4))r.corrupt.push(k);}
  if(r.turn%(count(r,'scheduler')?6:3)===0)for(const p of r.processes){
   if(p.disabled>r.turn)continue;
   let options=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>[p.x+dx,p.y+dy]).filter(([x,y])=>floor(r,x,y));
   if(p.type==='watchdog'&&Math.abs(r.x-p.x)+Math.abs(r.y-p.y)<7)options.sort((a,b)=>(Math.abs(a[0]-r.x)+Math.abs(a[1]-r.y))-(Math.abs(b[0]-r.x)+Math.abs(b[1]-r.y)));else {for(let j=options.length-1;j>0;j--){const k=Math.floor(rand(r)*(j+1));[options[j],options[k]]=[options[k],options[j]];}}
   if(options[0])[p.x,p.y]=options[0];
   if(p.type==='indexer'){for(let y=p.y-1;y<=p.y+1;y++)for(let x=p.x-1;x<=p.x+1;x++)if(inBounds(r,x,y))r.seen[idx(r,x,y)]=1;}
   if(p.type==='cleanup'){const n=r.nodes.find(n=>!n.done&&n.type==='file'&&n.x===p.x&&n.y===p.y);if(n&&!(r.mission==='target'&&n.fileId===r.target)){n.done=true;log(r,'Cleanup process removed an uncollected fragment. It can reappear in a later run.','warn');}}
   if(p.type==='watchdog'&&p.x===r.x&&p.y===r.y){hurt(r,6);p.disabled=r.turn+3;discover(s,'watchdog');log(r,'Watchdog collision: −6 integrity. Isolate it from an adjacent tile.','warn');}
  }
  if(r.corruption>=100){hurt(r,100);log(r,'Partition collapse. Only previously banked files survived.','warn');}
 }
 function move(s,dx,dy){if(!Number.isInteger(dx)||!Number.isInteger(dy)||Math.abs(dx)+Math.abs(dy)!==1)return 'Move one tile at a time.';const r=s.run;if(!r||r.question)return 'Finish the current repair first.';const x=r.x+dx,y=r.y+dy;if(!floor(r,x,y))return 'Solid partition boundary.';if(r.tutorial&&x>(r.stage<2?2:r.stage<4?3:r.stage<5?4:5))return 'Complete the highlighted tutorial step first.';r.x=x;r.y=y;reveal(r,count(r,'lens')||s.restored.system>=25?4:3);if(r.tutorial&&r.stage===0&&x===2)r.stage=1;if(r.corrupt.includes(idx(r,x,y))){hurt(r,2);log(r,'Corrupted block crossed: −2 integrity.','warn');discover(s,'corruption');}tick(s,r);if(!r.integrity)finish(s,'crashed');return '';}
 function nodeAt(r){return r.nodes.find(n=>!n.done&&n.x===r.x&&n.y===r.y&&(!n.hidden||r.scanned||count(r,'forensic')));}
 function startQuestion(s,nodeId){const r=s.run;if(!r||r.question)return 'Finish the current repair first.';const n=r.nodes.find(n=>n.id===nodeId)||r.processes.find(p=>p.id===nodeId);if(!n||n.done)return 'Nothing to repair.';const isProcess=r.processes.includes(n);if((isProcess&&Math.abs(n.x-r.x)+Math.abs(n.y-r.y)>1)||(!isProcess&&(n.x!==r.x||n.y!==r.y)))return 'Move to this block first.';if(isProcess&&n.disabled>r.turn)return 'This process is already isolated.';if(n.type==='core'&&r.anchors<3)return 'Repair all three directory anchors first.';const skill=n.skill||pickSkill(s,r);r.question={nodeId,q:makeQuestion(s,r,skill),feedback:null,hint:false,stage:0};if(r.tutorial)r.stage=3;return '';}
 function submit(s,raw){const r=s.run,e=r?.question;if(!e||e.feedback)return {valid:false,message:'No active question.'};const result=E.grade(e.q,raw);if(!result.valid)return result;
  const t=s.stats[e.q.skill];t.attempts++;t.correct+=Number(result.ok);t.recent.push(result.ok);t.recent=t.recent.slice(-10);r.attempts++;r.correct+=Number(result.ok);
  const node=r.nodes.find(n=>n.id===e.nodeId),cost=r.tutorial?0:Math.max(4,(node?.unstable?18:12)-4*count(r,'buffer'));
  if(result.ok){const gain=(node?.unstable?16:8)*(count(r,'overclock')?2:1);r.scrap+=gain;e.feedback={...result,gain};log(r,'Block verified. +'+gain+' scrap.','good');}
  else{hurt(r,cost);e.feedback={...result,cost};log(r,'Block mismatch. −'+cost+' integrity. Review the method, then retry.','warn');}
  tick(s,r);return result;
 }
 function continueQuestion(s){const r=s.run,e=r?.question;if(!e?.feedback)return;if(!r.integrity){finish(s,'crashed');return;}if(!e.feedback.ok){e.q=makeQuestion(s,r,e.q.skill);e.feedback=null;e.hint=false;e.draft='';return;}
  const n=r.nodes.find(n=>n.id===e.nodeId),p=r.processes.find(n=>n.id===e.nodeId);r.repairs++;s.repairs++;
  if(n?.type==='core'&&e.stage===0){e.stage=1;e.q=makeQuestion(s,r,pickSkill(s,r));e.feedback=null;e.hint=false;e.draft='';return;}
  r.question=null;
  if(p){p.disabled=r.turn+30;discover(s,'process-'+p.type);log(r,p.type+' isolated for 30 actions.','good');return;}
  if(n.type==='file'){n.locked=false;return;}
  if(n.type==='core'){if(r.depth===3){bank(s);finish(s,'restored');return;}r.depth++;r.maxDepth=r.depth;r.corruption=Math.max(0,r.corruption-15);r.charges=Math.min(8,r.charges+2+count(r,'charge'));generate(s,r);return;}
  n.done=true;if(n.type==='anchor'){r.anchors++;const key=r.anchors===1?'boot':r.anchors===2?'system':'archive';s.restored[key]=Math.min(100,s.restored[key]+5);log(r,'Directory anchor restored ('+r.anchors+'/3).','good');}
  if(r.tutorial)r.stage=4;
 }
 function collect(s,id){const r=s.run;if(!r||r.question)return 'Finish the current repair first.';const n=r.nodes.find(n=>n.id===id);if(!n||n.done||n.x!==r.x||n.y!==r.y||n.type!=='file'||n.locked)return 'This fragment must be repaired first.';if(used(r)+n.bytes*(count(r,'compress')?.75:1)>capacity(r))return 'Buffer full. Bank your cargo or discard a carried fragment.';r.cargo.push({fileId:n.fileId,part:n.part,bytes:n.bytes});n.done=true;log(r,'Buffered '+Archive.find(f=>f.id===n.fileId).name+' ['+(n.part+1)+'/4].','good');if(r.tutorial)r.stage=5;tick(s,r);return '';}
 function bank(s){const r=s.run;for(const c of r.cargo){const f=Archive.find(f=>f.id===c.fileId);if(!(s.archive[c.fileId]&(1<<c.part))){s.archive[c.fileId]=(s.archive[c.fileId]||0)|(1<<c.part);r.banked++;r.bankedBytes+=c.bytes;if(c.fileId===r.target)r.targetFound=true;const key=f.type==='text'?'users':f.type;s.restored[key]=Math.min(100,s.restored[key]+4);}}if(r.cargo.length)log(r,r.cargo.length+' fragments banked permanently.','good');r.cargo=[];}
 function objective(r){switch(r.mission){case 'recovery':return r.banked>=3;case 'salvage':return r.bankedBytes>=MI;case 'diagnostic':return r.repairs>=5;case 'target':return r.targetFound;case 'deep':return r.depth===3&&r.anchors===3&&r.finishedCore;default:return false;}}
 function finish(s,status){const r=s.run;if(!r)return;if(status!=='crashed')bank(s);if(status==='restored')r.finishedCore=true;const summary={status,mission:r.mission,success:objective(r)||status==='restored',repairs:r.repairs,correct:r.correct,attempts:r.attempts,banked:r.banked,bytes:r.bankedBytes,depth:r.maxDepth,turns:r.turn,seed:r.seed,when:new Date().toISOString(),lost:status==='crashed'?r.cargo.length:0};s.history.unshift(summary);s.history=s.history.slice(0,30);s.run=null;return summary;}
 function takePerk(s,id,nodeId){const r=s.run;if(!r||r.question)return 'Finish the current repair first.';const n=r.nodes.find(n=>n.id===nodeId);if(!n||n.done||n.x!==r.x||n.y!==r.y||n.type!=='cache'||!perks[id]||!n.choices.includes(id)||count(r,id)>=perks[id].max)return 'Module unavailable.';r.upgrades.push(id);n.done=true;if(id==='charge')r.charges=Math.min(8,r.charges+3);if(r.tutorial)r.stage=2;log(r,perks[id].name+' installed.','good');tick(s,r);return '';}
 function scan(s){const r=s.run;if(!r||r.question)return 'Finish the current repair first.';if(!r.charges)return 'No scan charges remain.';r.charges--;r.scanned=true;if(count(r,'lens'))r.seen.fill(1);else reveal(r,7);discover(s,'deleted');log(r,'Forensic sweep: nearby deleted fragments revealed.','info');tick(s,r);return '';}
 function patch(s){const r=s.run;if(!r||r.question)return 'Finish the current repair first.';if(r.integrity>=100)return 'Integrity is already full.';if(r.scrap<18)return 'A repair patch costs 18 scrap.';r.scrap-=18;r.integrity=Math.min(100,r.integrity+25);tick(s,r);return '';}
 function jump(s){const r=s.run;if(!r||r.question||!r.shortcutOpen||nodeAt(r)?.type!=='shortcut')return 'Unlock and reach the relay first.';r.x=22;r.y=14;reveal(r,4);tick(s,r);log(r,'Maintenance relay routed ECHO-07 to the deleted directory.','info');return '';}
 function normalize(raw){const d=fresh();if(!raw||typeof raw!=='object')return d;
  if(raw.version===1){d.config={...d.config,...raw.config};for(const f of Archive)if(raw.files?.[f.id])d.archive[f.id]=(1<<Math.min(4,raw.files[f.id]))-1;d.repairs=Number(raw.repairs)||0;d.stats={...d.stats,...raw.stats};return normalize({...d,version:2});}
  if(raw.version!==2)return d;d.config={...d.config,...raw.config};d.config.topics=(Array.isArray(d.config.topics)?d.config.topics:SK).filter(k=>SK.includes(k));if(!d.config.topics.length)d.config.topics=[...SK];if(!['foundation','adaptive','challenge'].includes(d.config.difficulty))d.config.difficulty='adaptive';if(!['binary','decimal'].includes(d.config.units))d.config.units='binary';
  for(const k of SK){const t=raw.stats?.[k];if(t){d.stats[k].attempts=Math.max(0,Math.min(1e8,Number(t.attempts)||0));d.stats[k].correct=Math.max(0,Math.min(d.stats[k].attempts,Number(t.correct)||0));d.stats[k].recent=Array.isArray(t.recent)?t.recent.slice(-10).map(Boolean):[];}}
  for(const f of Archive)d.archive[f.id]=Math.max(0,Math.min(15,Math.floor(Number(raw.archive?.[f.id])||0)));
  for(const k in d.restored)d.restored[k]=Math.max(0,Math.min(100,Number(raw.restored?.[k])||0));
  d.discoveries=Array.isArray(raw.discoveries)?raw.discoveries.filter(x=>typeof x==='string').slice(0,50):[];d.repairs=Number(raw.repairs)||0;d.tutorialDone=!!raw.tutorialDone;d.history=Array.isArray(raw.history)?raw.history.filter(h=>h&&typeof h==='object'&&!Array.isArray(h)).slice(0,30):[];
  const r=raw.run;if(r&&r.w===27&&r.h===19&&Array.isArray(r.tiles)&&r.tiles.length===513&&Array.isArray(r.nodes)&&r.nodes.length<100&&Array.isArray(r.seen)&&r.seen.length===513&&Array.isArray(r.cargo)&&r.cargo.length<100&&Array.isArray(r.upgrades)&&Array.isArray(r.processes)&&Array.isArray(r.corrupt)&&Array.isArray(r.log)&&Array.isArray(r.config?.topics)&&r.config.topics.length>0&&r.config.topics.every(k=>SK.includes(k))&&r.tiles.every(t=>t===0||t===1)&&r.seen.every(t=>t===0||t===1)&&r.cargo.every(c=>Archive.some(f=>f.id===c.fileId)&&Number.isInteger(c.part)&&c.part>=0&&c.part<4&&Number.isFinite(c.bytes)&&c.bytes>0)&&r.upgrades.every(k=>perks[k])&&r.processes.length<10&&['seed','serial','depth','turn','integrity','charges','scrap','corruption','repairs','attempts','correct','banked','bankedBytes','maxDepth','anchors'].every(k=>Number.isFinite(r[k])&&r[k]>=0)&&r.depth>=1&&r.depth<=3&&r.integrity<=100&&r.charges<=8&&r.corruption<=100&&r.nodes.every(n=>typeof n.id==='string'&&Number.isInteger(n.x)&&Number.isInteger(n.y)&&inBounds(r,n.x,n.y))&&(!r.question||(SK.includes(r.question.q?.skill)&&['number','binary','hex','text'].includes(r.question.q?.kind)&&Array.isArray(r.question.q?.steps)&&Array.isArray(r.question.q?.facts)))&&Number.isInteger(r.x)&&Number.isInteger(r.y)&&inBounds(r,r.x,r.y))d.run=r;
  return d;
 }
 return {fresh,normalize,jump,createRun,tutorial,move,nodeAt,startQuestion,submit,continueQuestion,collect,bank,finish,takePerk,scan,patch,generate,reveal,makeQuestion,count,capacity,used,size,partCount,rooms,perks,log,discover,objective,floor,idx};
})();
if(typeof module!=='undefined')module.exports=World;
