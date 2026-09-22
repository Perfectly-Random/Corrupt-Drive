"""Offline DOM/browser integration tests. Database and gateway have separate tests.
Loads local source with set_content: no network access, no bypass of browser policy.
Requires Playwright and a Chromium executable (CHROMIUM_PATH can override).
"""
import json, os, re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tests'/'screenshots'; OUT.mkdir(exist_ok=True)
MOCK=r'''(() => {
 const memory=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)}});
 window.testStore={user:null,state:{},revision:0,conflict:false,offline:false,requests:[]};
 window.fetch=async(url,init)=>{const s=window.testStore,b=JSON.parse(init.body),a=b.action;s.requests.push(a);if(s.offline)throw Error('Offline test');let status=200,data;
 if(a==='register'||a==='login'||a==='recover'){s.user={id:'qa-browser',username:b.username};data={ok:true,user:s.user,state:s.state,revision:s.revision,...(a==='register'?{recovery:'a'.repeat(48)}:{})};}
 else if(!s.user){status=401;data={ok:false,error:'Please sign in.'};}
 else if(a==='save'){if(s.conflict||b.revision!==s.revision){status=409;data={ok:false,error:'Another device has a newer save.'};}else{s.state=structuredClone(b.state);s.revision++;data={ok:true,revision:s.revision};}}
 else if(a==='logout'){s.user=null;data={ok:true};}
 else data={ok:true,user:s.user,state:s.state,revision:s.revision};
 return {ok:status===200,status,json:async()=>data};};
})()'''
def launch_page(browser, width, height):
 page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
 page.set_default_timeout(6000)
 errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
 html=(ROOT/'public/index.html').read_text();html=re.sub(r'<script[^>]*src=[^>]*></script>','',html);html=re.sub(r'<link[^>]*>','',html)
 page.set_content(html);page.add_style_tag(content=(ROOT/'public/style.css').read_text());page.evaluate(MOCK)
 for name in ['engine.js','archive.js','world.js','client.js','drive-view.js','library-view.js','controls.js']:page.add_script_tag(content=(ROOT/'public'/name).read_text())
 page.wait_for_selector('#authForm')
 return page,errors

def run():
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  page,errors=launch_page(browser,1440,1050)
  page.screenshot(path=str(OUT/'desktop-login.png'),full_page=True)
  page.click('[data-act=auth-register]');page.fill('#username','echo_tester');page.fill('#password','not-a-real-password');page.fill('#confirm','not-a-real-password');page.click('#authForm button[type=submit]')
  page.wait_for_selector('.recoverycode');page.click('[data-act=recovery-done]');page.wait_for_selector('#map')
  page.click('[data-act=move][data-dx="1"]');page.click('[data-act=perk][data-id=memory]');page.click('[data-act=move][data-dx="1"]');page.click('[data-act=diagnose]')
  page.fill('#answer','3');page.click('#questionForm button[type=submit]');assert 'Check the method' in page.locator('#inspector').inner_text();page.click('[data-act=continue]')
  page.fill('#answer','2');page.click('#questionForm button[type=submit]');page.click('[data-act=continue]');page.click('[data-act=move][data-dx="1"]');page.click('[data-act=collect]');page.click('[data-act=move][data-dx="1"]');page.click('[data-act=finish]')
  page.wait_for_selector('text=Recovery training complete');page.click('#dialog [data-act=missions]');page.click('[data-act=begin][data-id=diagnostic]');page.wait_for_timeout(900)
  saved=page.evaluate('testStore.state');assert saved['tutorialDone'] is True;assert saved['stats']['units']['attempts']==0, 'Tutorial must not pollute real stats'
  page.screenshot(path=str(OUT/'desktop-gameplay.png'),full_page=True)
  # Place the local simulation at a real repair node through saved data and reload flow.
  page.evaluate('''()=>{const s=testStore.state,r=s.run,n=r.nodes.find(n=>n.type==='repair');r.x=n.x;r.y=n.y;r.processes=[];r.seen.fill(1);testStore.revision++;}''')
  # Trigger storage conflict through the real event listener so cloud-load UI is exercised.
  page.evaluate('''()=>window.dispatchEvent(new StorageEvent('storage',{key:'corrupt-drive.v2.qa-browser',newValue:JSON.stringify({userId:'qa-browser',revision:testStore.revision})}))''')
  page.click('[data-act=load-cloud]');page.click('[data-act=confirm-load]');page.click('[data-act=diagnose]')
  page.wait_for_timeout(900);answer=page.evaluate('String(testStore.state.run.question.q.answer)');page.fill('#answer',answer);page.click('#questionForm button[type=submit]');page.screenshot(path=str(OUT/'desktop-repair.png'),full_page=True);page.click('[data-act=continue]');page.wait_for_timeout(900)
  assert page.evaluate('testStore.state.run.repairs')==1
  # Free extraction after returning to entry in test state; bank and rendered archive.
  page.evaluate('''()=>{const r=testStore.state.run;r.x=2;r.y=4;r.cargo=[{fileId:'platform',part:0,bytes:65536}];testStore.revision++;window.dispatchEvent(new StorageEvent('storage',{key:'corrupt-drive.v2.qa-browser',newValue:JSON.stringify({userId:'qa-browser',revision:testStore.revision})}));}''')
  page.click('[data-act=load-cloud]');page.click('[data-act=confirm-load]');page.click('[data-act=finish]');page.wait_for_timeout(900)
  assert page.evaluate('testStore.state.archive.platform')==1
  page.click('[data-act=nav][data-page=archive]');page.screenshot(path=str(OUT/'desktop-archive.png'),full_page=True);page.click('[data-act=file][data-id=platform]');page.click('[data-act=close]')
  page.click('[data-act=account]');page.click('[data-act=logout]');page.wait_for_selector('#authForm');page.fill('#username','echo_tester');page.fill('#password','not-a-real-password');page.click('#authForm button[type=submit]');page.wait_for_selector('#sync');assert page.evaluate('testStore.state.archive.platform')==1
  # Force save conflict: app must block, not silently claim success.
  page.evaluate('testStore.conflict=true');page.click('[data-act=settings]');page.click('[data-act=save-settings]');page.wait_for_timeout(1000);assert page.locator('#sync').inner_text()=='SAVE CONFLICT'
  assert not errors,errors
  mobile,mobile_errors=launch_page(browser,390,844);mobile.click('[data-act=auth-register]');mobile.fill('#username','mobile_tester');mobile.fill('#password','not-a-real-password');mobile.fill('#confirm','not-a-real-password');mobile.click('#authForm button[type=submit]');mobile.click('[data-act=recovery-done]');mobile.click('[data-act=move][data-dx="1"]');mobile.click('[data-act=perk][data-id=buffer]');mobile.click('[data-act=move][data-dx="1"]');mobile.click('[data-act=diagnose]');mobile.fill('#answer','2');mobile.screenshot(path=str(OUT/'mobile-tutorial-repair.png'),full_page=True)
  assert mobile.evaluate('document.documentElement.scrollWidth <= innerWidth+1'),'Mobile horizontal overflow'
  assert not mobile_errors,mobile_errors
  report={'browser':'Chromium offline DOM','passed':['register UI','recovery code UI','interactive tutorial with incorrect answer','tutorial isolation','new expedition','real repair','cloud conflict UI','load newer save','banking','archive','logout/login retained save (mock server)','mobile no overflow'],'page_errors':errors+mobile_errors,'backend_note':'Browser transport mocked; separate real PostgreSQL and live Vercel health checks required.'}
  (ROOT/'tests/browser-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2));browser.close()
if __name__=='__main__':run()
