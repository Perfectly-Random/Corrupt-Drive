'use strict';
const assert=require('node:assert/strict');
global.Engine=require('../public/engine');
global.Archive=require('../public/archive');
const W=require('../public/world');
let checks=0;
function ok(value,label){assert.ok(value,label);checks++;}
for(const units of ['binary','decimal'])for(const skill of Object.keys(Engine.skills))for(const level of [1,2,3])for(let seed=0;seed<500;seed++){
 const q=Engine.question(skill,level,units,seed);ok(Engine.grade(q,String(q.answer)).ok,`${skill} ${units} ${seed}`);ok(!Engine.grade(q,'').valid,'empty rejected');
 if(q.kind==='number')ok(!Engine.grade(q,String(Number(q.answer)+Math.max(1,q.answer*.1))).ok,'incorrect number');
}
function reachable(r){const start=W.idx(r,r.x,r.y),seen=new Set([start]),queue=[start];while(queue.length){const k=queue.shift(),x=k%r.w,y=Math.floor(k/r.w);for(const [dx,dy]of[[0,1],[0,-1],[1,0],[-1,0]]){const kk=W.idx(r,x+dx,y+dy);if(W.floor(r,x+dx,y+dy)&&!seen.has(kk)){seen.add(kk);queue.push(kk);}}}return seen;}
for(let seed=0;seed<300;seed++){
 const s=W.fresh(),r=W.createRun(s,'target',seed),cells=reachable(r);ok(r.nodes.every(n=>cells.has(W.idx(r,n.x,n.y))),'all encounters reachable');ok(new Set(r.nodes.map(n=>`${n.x},${n.y}`)).size===r.nodes.length,'unique encounter locations');ok(r.nodes.filter(n=>n.type==='anchor').length===3,'three anchors');ok(r.nodes.some(n=>n.fileId===r.target),'target exists');ok(W.normalize(JSON.parse(JSON.stringify(s))).run!==null,'serialized run resumes');
 const r2=W.createRun(W.fresh(),'target',seed);ok(JSON.stringify(r.nodes)===JSON.stringify(r2.nodes),'deterministic encounters');
}
// Full tutorial, including wrong answer, barriers, banking and real progress isolation.
const s=W.fresh();W.tutorial(s);ok(W.move(s,1,0)==='','move to cache');ok(s.run.stage===1,'tutorial stage');ok(W.move(s,1,0)!=='','barrier works');W.takePerk(s,'memory','cache');W.move(s,1,0);W.startQuestion(s,'repair');ok(W.submit(s,'3').valid&&!s.run.question.feedback.ok,'wrong tutorial answer');ok(s.run.integrity===100,'no tutorial damage');W.continueQuestion(s);ok(W.submit(s,'2').ok,'correct tutorial answer');W.continueQuestion(s);W.move(s,1,0);W.collect(s,'file');W.move(s,1,0);W.finish(s,'extracted');ok(!s.run&&(s.archive.note&1),'tutorial extraction banks');
const cargo=W.fresh(),r=W.createRun(cargo,'recovery',991);r.processes=[];const file=r.nodes.find(n=>n.type==='file');r.x=file.x;r.y=file.y;file.locked=false;r.cargo=[{fileId:'platform',part:0,bytes:W.capacity(r)}];ok(W.collect(cargo,file.id).includes('full'),'cargo cap');r.cargo=[];W.collect(cargo,file.id);const id=file.fileId;W.bank(cargo);ok(cargo.archive[id]&(1<<file.part),'banking');const before=r.banked;r.cargo=[{fileId:id,part:file.part,bytes:file.bytes}];W.bank(cargo);ok(r.banked===before,'no duplicate banking');
r.cargo=[{fileId:'readme',part:3,bytes:1024}];W.finish(cargo,'crashed');ok(cargo.history[0].lost===1,'unbanked lost');ok(cargo.archive[id]&(1<<file.part),'banked retained');
const t=W.fresh(),core=W.createRun(t,'deep',71);core.processes=[];const n=core.nodes.find(n=>n.type==='core');core.x=n.x;core.y=n.y;ok(W.startQuestion(t,n.id).includes('three'),'core locked');core.anchors=3;W.startQuestion(t,n.id);for(let i=0;i<2;i++){W.submit(t,String(t.run.question.q.answer));W.continueQuestion(t);}ok(t.run.depth===2,'core transition');
const a=W.fresh();a.restored.archive=25;W.createRun(a);ok(a.run.scanned,'restoration unlock works');ok(W.move(a,10,0).includes('one tile'),'no teleport via movement');
ok(W.normalize({version:2,run:{w:27,h:19}}).run===null,'malformed run rejected');
console.log(`${checks} generator/world checks passed across all six skills, both unit systems, tutorial, maps, inventory, core and persistence.`);
