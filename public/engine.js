/* Corrupt Drive: deterministic question and route generation. No external dependencies. */
const Engine = (() => {
  const skills={units:{name:'Storage units',glyph:'⇄',short:'ALLOCATE'},binary:{name:'Binary / denary',glyph:'01',short:'BINARY'},hex:{name:'Hexadecimal',glyph:'0x',short:'ADDRESS'},ascii:{name:'ASCII decoding',glyph:'Aa',short:'DECODE'},image:{name:'Image recovery',glyph:'▧',short:'IMAGE'},audio:{name:'Sound recovery',glyph:'≋',short:'AUDIO'}};
  function rng(seed){let a=seed>>>0;return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
  const pick=(r,a)=>a[Math.floor(r()*a.length)];
  const integer=(r,a,b)=>Math.floor(r()*(b-a+1))+a;
  const fmt=n=>Number.isInteger(n)?n.toLocaleString('en-US'):Number(n.toFixed(6)).toLocaleString('en-US',{maximumFractionDigits:6});
  function question(skill,level,mode,seed,allowed=Object.keys(skills)){
    const r=rng(seed), base=mode==='decimal'?1000:1024, units=mode==='decimal'?['bytes','kB','MB','GB','TB']:['bytes','KiB','MiB','GiB','TiB'];
    let q={skill,level,kind:'number',unit:'',path:'/system/recovery/block.dat',title:'Rebuild the data',facts:[],hint:'',steps:[],answer:0,prompt:'',seed};
    if(skill==='units'){
      q.title='Allocate a recovery buffer';q.path='/system/memory/buffer.map';
      if(level===1 || r()<.25){const n=pick(r,[4,8,12,16,24,32,48,64,128]),toBits=r()<.5;q.answer=toBits?n*8:n;q.unit=toBits?'bits':'bytes';q.facts=[['Recovered block',fmt(toBits?n:n*8)+' '+(toBits?'bytes':'bits')],['Storage rule','1 byte = 8 bits']];q.prompt='Reserve exactly enough space. Convert the recovered block to '+q.unit+'.';q.hint=toBits?'Each byte contains 8 bits. Multiply the number of bytes by 8.':'Group the bits into bytes: divide by 8.';q.steps=[toBits?`${n} × 8 = ${q.answer} bits.`:`${n*8} ÷ 8 = ${n} bytes.`];}
      else {let a=integer(r,0,level===3?2:3),gap=level===3?pick(r,[1,2]):1,b=Math.min(4,a+gap),n=pick(r,[2,3,4,6,8,12,16]),up=r()<.5;let factor=base**(b-a),value=up?n*factor:n;q.answer=up?n:n*factor;q.unit=up?units[b]:units[a];q.facts=[['Recovered block',fmt(value)+' '+(up?units[a]:units[b])],['Unit convention',(mode==='decimal'?'Decimal':'Binary')+' · ×'+base+' per step']];q.prompt='Convert this block to '+q.unit+' before mapping it into storage.';q.hint=`Moving to ${up?'larger':'smaller'} units: ${up?'divide':'multiply'} by ${base} for each step (${b-a} ${b-a===1?'step':'steps'}).`;q.steps=[`${fmt(value)} ${up?'÷':'×'} ${fmt(factor)} = ${fmt(q.answer)} ${q.unit}.`];}
    }
    if(skill==='binary'){
      const n=integer(r,1,level===1?31:255),toBinary=r()<.5;
      q.title='Reconstruct a binary register';q.path='/boot/registers/status.bin';q.kind=toBinary?'binary':'number';q.answer=toBinary?n.toString(2).padStart(8,'0'):n;q.unit=toBinary?'base 2':'denary';q.facts=[['Damaged register',toBinary?`${n} (denary)`:n.toString(2).padStart(8,'0')+' (binary)']];q.prompt=toBinary?'Encode the denary value in binary. Leading zeros are accepted.':'Recover the denary value stored in this binary register.';q.hint='The 8-bit place values are 128, 64, 32, 16, 8, 4, 2, 1.';let parts=[128,64,32,16,8,4,2,1].filter(p=>n&p);q.steps=[`${parts.join(' + ')} = ${n}.`,`${n} in denary = ${n.toString(2).padStart(8,'0')} in binary.`];
    }
    if(skill==='hex'){
      const n=integer(r,10,level===1?63:255),kind=pick(r,allowed.includes('binary')?(level===3?[0,1,2,3]:[0,1,2]):[0,1]);q.title='Repair a sector address';q.path='/system/addresses/sector.hex';
      q.kind=kind===0?'number':kind===3?'binary':'hex';q.answer=kind===0?n:kind===3?n.toString(2).padStart(8,'0'):n.toString(16).toUpperCase();q.unit=kind===0?'denary':kind===3?'base 2':'base 16';q.facts=[['Recovered address',kind===0||kind===3?n.toString(16).toUpperCase()+' (hexadecimal)':kind===1?n+' (denary)':n.toString(2).padStart(8,'0')+' (binary)']];q.prompt='Rebuild the address in '+(kind===0?'denary':kind===3?'binary':'hexadecimal')+'.';q.hint='Hexadecimal uses 0–9 and A–F. One hex digit represents four binary bits.';q.steps=[`${Math.floor(n/16)} × 16 + ${n%16} = ${n}.`,`${n.toString(2).padStart(8,'0').slice(0,4)} ${n.toString(2).padStart(8,'0').slice(4)} = ${n.toString(16).toUpperCase().padStart(2,'0')} in hex.`];
    }
    if(skill==='ascii'){
      q.title='Recover a damaged message';q.path='/users/m/notes/fragment.txt';
      const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789',c=pick(r,chars.split('')),code=c.charCodeAt(0),kind=pick(r,level===1?[0,1]:[0,1,...(allowed.includes('binary')?[2,3,...(level===3?[5]:[])]:[]),...(allowed.includes('hex')&&level===3?[4]:[])]);
      q.hint='Open the ASCII reference. Uppercase and lowercase letters have different codes. ASCII is 7-bit; these files store each character in an 8-bit byte.';
      if(kind===0){q.kind='text';q.answer=c;q.unit='character';q.facts=[['Recovered character code',code+' (denary)']];q.prompt='Which ASCII character belongs in this damaged position? Case matters.';q.steps=[`Find denary ${code} in the ASCII reference: the character is “${c}”.`];}
      if(kind===1){q.answer=code;q.unit='denary';q.facts=[['Required character','“'+c+'”']];q.prompt='Look up the ASCII denary code for this character.';q.steps=[`“${c}” has ASCII denary code ${code}.`];}
      if(kind===2){q.kind='text';q.answer=c;q.unit='character';q.facts=[['Recovered byte',code.toString(2).padStart(8,'0')+' (binary)']];q.prompt='Decode this byte into its ASCII character. Case matters.';q.steps=[`${code.toString(2).padStart(8,'0')} in binary = ${code} in denary.`,`ASCII ${code} is “${c}”.`];}
      if(kind===3){q.kind='binary';q.answer=code.toString(2).padStart(8,'0');q.unit='base 2';q.facts=[['Required character','“'+c+'”']];q.prompt='Reconstruct the binary ASCII byte for this character.';q.steps=[`“${c}” has ASCII code ${code}.`,`${code} in denary = ${q.answer} in binary.`];}
      if(kind===4){const word=pick(r,['HOME','ECHO','SAFE','OPEN','Maya','ROOM','hello']);q.kind='text';q.answer=word;q.unit='text';q.facts=[['Raw bytes · hexadecimal',word.split('').map(x=>x.charCodeAt(0).toString(16).toUpperCase()).join(' ')]];q.prompt='Decode these hexadecimal ASCII bytes. Enter the recovered text, preserving case.';q.steps=word.split('').map(x=>`${x.charCodeAt(0).toString(16).toUpperCase()} hex → ${x.charCodeAt(0)} denary → ${x}`);}
      if(kind===5){const word=pick(r,['HELLO','MAYA','ECHO','DATA']),idx=integer(r,0,word.length-1),s=word.charCodeAt(idx);q.kind='binary';q.answer=s.toString(2).padStart(8,'0');q.unit='base 2';q.facts=[['Known original text',word],['Damaged byte sequence',word.split('').map((x,i)=>i===idx?'????????':x.charCodeAt(0).toString(2).padStart(8,'0')).join(' ')]];q.prompt='Restore only the missing binary byte, using the known original text.';q.steps=[`Position ${idx+1} should contain “${word[idx]}”.`,`ASCII ${s} in denary = ${q.answer} in binary.`];}
    }
    if(skill==='image'){
      const w=pick(r,level===3?[320,640,1024]:[16,32,64,128]),h=pick(r,level===3?[240,480,512]:[16,32,64]),d=pick(r,[1,4,8,16]),bits=w*h*d;const div=level===1?1:level===2?8:8*base;q.answer=bits/div;q.unit=level===1?'bits':level===2?'bytes':units[1];q.title='Reconstruct an image payload';q.path='/users/m/photos/platform_09.raw';q.facts=[['Resolution',`${w} × ${h} pixels`],['Colour depth',d+' bits per pixel'],['File format','Uncompressed · no header']];q.prompt=`Calculate the pixel data size in ${q.unit}.`;
      q.hint='Image size in bits = width × height × colour depth. Divide by 8 for bytes; then convert units if needed.';q.steps=[`${w} × ${h} × ${d} = ${fmt(bits)} bits.`,...(level>=2?[`${fmt(bits)} ÷ 8 = ${fmt(bits/8)} bytes.`]:[]),...(level===3?[`${fmt(bits/8)} ÷ ${base} = ${fmt(bits/div)} ${q.unit}.`]:[])];
    }
    if(skill==='audio'){
      const rate=pick(r,level===1?[8000,16000]:[8000,16000,22050,44100]),depth=pick(r,[8,16]),time=pick(r,[2,3,4,5,10]),channels=level===3?pick(r,[1,2]):1,bits=rate*depth*time*channels,div=level===1?1:level===2?8:8*base;
      q.answer=bits/div;q.unit=level===1?'bits':level===2?'bytes':units[1];q.title='Find the end of an audio file';q.path='/users/m/audio/roomtone_04.pcm';q.facts=[['Sample rate',fmt(rate)+' Hz'],['Sample resolution',depth+' bits per sample'],['Duration',time+' seconds'],['Channels',channels===1?'1 · mono':'2 · stereo']];q.prompt=`Calculate the uncompressed audio data size in ${q.unit}. Ignore file headers.`;q.hint='Audio size in bits = sample rate × sample resolution × seconds × channels. Convert bits to bytes with ÷ 8.';q.steps=[`${fmt(rate)} × ${depth} × ${time} × ${channels} = ${fmt(bits)} bits.`,...(level>=2?[`${fmt(bits)} ÷ 8 = ${fmt(bits/8)} bytes.`]:[]),...(level===3?[`${fmt(bits/8)} ÷ ${base} = ${fmt(bits/div)} ${q.unit}.`]:[])];
    }
    q.rawAnswer=q.answer;
    if(q.kind==='number' && !Number.isInteger(q.answer)){q.answer=Number(q.answer.toFixed(3));q.prompt+=' Round to 3 decimal places if necessary.';q.tolerance=.000501;}
    else q.tolerance=1e-8;
    q.displayAnswer=q.kind==='number'?fmt(q.answer):String(q.answer);
    return q;
  }
  function grade(q,raw){
    let s=String(raw).trim();if(!s)return {valid:false,message:'Enter an answer first. No integrity lost.'};let actual,ok=false;
    if(q.kind==='number'){
      if(!/^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(s) && !/^[+-]?\.\d+$/.test(s))return {valid:false,message:'Enter a number only; the unit is already shown.'};
      actual=Number(s.replace(/,/g,''));ok=Number.isFinite(actual)&&Math.abs(actual-Number(q.rawAnswer))<=q.tolerance;
    }else if(q.kind==='binary'){s=s.replace(/^0b/i,'').replace(/\s/g,'');if(!/^[01]+$/.test(s))return {valid:false,message:'Binary uses only 0 and 1. No integrity lost.'};ok=parseInt(s,2)===parseInt(q.answer,2);}
    else if(q.kind==='hex'){s=s.replace(/^0x/i,'').replace(/\s/g,'');if(!/^[0-9a-f]+$/i.test(s))return {valid:false,message:'Hexadecimal uses 0–9 and A–F. No integrity lost.'};ok=parseInt(s,16)===parseInt(q.answer,16);}
    else ok=s===String(q.answer);
    let message='Compare your method with the reconstruction below.';
    if(!ok&&q.kind==='number'&&Number(q.answer)>0&&(Math.abs(actual/q.answer-8)<.001||Math.abs(actual/q.answer-.125)<.001))message='Check the bits ↔ bytes step: one byte contains eight bits.';
    if(!ok&&q.kind==='text'&&s.toLowerCase()===String(q.answer).toLowerCase())message='The letters match, but ASCII is case-sensitive. Check uppercase and lowercase.';
    return {valid:true,ok,message};
  }
  function weightedSkill(r,enabled,stats){const weights=enabled.map(s=>{const t=stats[s]||{attempts:0,correct:0};return t.attempts===0?2:1+3*(1-t.correct/t.attempts);});let x=r()*weights.reduce((a,b)=>a+b,0);for(let i=0;i<enabled.length;i++){x-=weights[i];if(x<=0)return enabled[i];}return enabled[0];}
  function map(seed,depth,enabled,stats){
    const r=rng(seed+depth*7919),nodes=[{id:'start',col:-1,row:1,x:7,y:50,type:'start',skill:null,done:true}],edges=[];
    for(let col=0;col<4;col++)for(let row=0;row<3;row++){
      const roll=r();let type=roll<.12?'cache':roll<.2?'restore':roll<.4?'unstable':roll<.67?'fragment':'repair';
      if(col===0&&row===1)type='fragment';let skill=col===0&&row===1&&enabled.includes('ascii')?'ascii':weightedSkill(r,enabled,stats);
      nodes.push({id:col+'-'+row,col,row,x:24+col*17,y:22+row*28,type,skill,done:false});
    }
    nodes.push({id:'core',col:4,row:1,x:94,y:50,type:'core',skill:weightedSkill(r,enabled,stats),done:false});
    for(const a of nodes)for(const b of nodes)if(b.col===a.col+1&&(a.id==='start'||b.id==='core'||Math.abs(a.row-b.row)<=1))edges.push([a.id,b.id]);
    return {nodes,edges};
  }
  return {skills,rng,pick,integer,fmt,question,grade,map,weightedSkill};
})();
if(typeof module!=='undefined')module.exports=Engine;
