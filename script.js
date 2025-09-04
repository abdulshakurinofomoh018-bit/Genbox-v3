// Minimal 'engine' with templates, controls, and procedural audio
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const logEl = document.getElementById('log');

function log(msg){ const d=document.createElement('div'); d.textContent=msg; logEl.appendChild(d); logEl.scrollTop=logEl.scrollHeight; }

// -------- Audio (procedural with WebAudio) --------
const AudioSys = (()=>{
  const Ctx = window.AudioContext || window.webkitAudioContext;
  let ac = null, enabled = true;
  function ensure(){ if(!ac){ ac = new Ctx(); } return ac; }
  function tone(freq=440, dur=0.12, type='sine', gain=0.05){
    if(!enabled) return;
    const a=ensure(); const o=a.createOscillator(); const g=a.createGain();
    o.type=type; o.frequency.value=freq; g.gain.value=gain;
    o.connect(g); g.connect(a.destination); o.start();
    o.stop(a.currentTime+dur);
  }
  function engineRev(){ tone(120,0.05,'sawtooth',0.06); tone(180,0.05,'sawtooth',0.06); }
  function kick(){ tone(80,0.08,'sine',0.08); }
  function punch(){ tone(220,0.06,'square',0.05); }
  function select(){ tone(660,0.05,'triangle',0.04); }
  function toggle(on){ enabled = on; if(on) ensure().resume(); else if(ac) ac.suspend(); }
  return { tone, engineRev, kick, punch, select, toggle };
})();
window.AudioSys = AudioSys;

// -------- Input (keyboard + touch) --------
const keys = {};
window.addEventListener('keydown', e=>{ keys[e.key.toLowerCase()] = true; if([' ','arrowup','arrowdown','arrowleft','arrowright','a','d','w','s'].includes(e.key.toLowerCase())) e.preventDefault(); });
window.addEventListener('keyup', e=>{ keys[e.key.toLowerCase()] = false; });

// Touch D-pad
document.querySelectorAll('[data-dir]').forEach(btn=>{
  const dir = btn.getAttribute('data-dir');
  const map = {up:'arrowup',down:'arrowdown',left:'arrowleft',right:'arrowright'};
  const key = map[dir];
  btn.addEventListener('touchstart', e=>{ e.preventDefault(); keys[key]=true; });
  btn.addEventListener('touchend', e=>{ e.preventDefault(); keys[key]=false; });
});
document.getElementById('btnA').addEventListener('touchstart', e=>{ e.preventDefault(); keys[' ']=true; });
document.getElementById('btnA').addEventListener('touchend', e=>{ e.preventDefault(); keys[' ']=false; });
document.getElementById('btnB').addEventListener('touchstart', e=>{ e.preventDefault(); keys['b']=true; });
document.getElementById('btnB').addEventListener('touchend', e=>{ e.preventDefault(); keys['b']=false; });

// -------- Engine State --------
const Engine = {
  hi:false,
  t:0,
  scene:'none',
  load(name){ this.scene=name; this.t=0; log('Loaded template: '+name+(this.hi?' [Photorealistic]':'')); AudioSys.select(); },
  setHi(v){ this.hi=v; log('Quality: '+(v?'Photorealistic ON':'Light mode ON')); }
};
window.Engine = Engine;

// -------- Render Helpers --------
function vignette(alpha=0.5){
  const g = ctx.createRadialGradient(canvas.width/2,canvas.height/2,60, canvas.width/2,canvas.height/2, canvas.height/1.2);
  g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,'+alpha+')');
  ctx.fillStyle=g; ctx.fillRect(0,0,canvas.width,canvas.height);
}
function blurTrail(strength=0.1){ ctx.fillStyle='rgba(0,0,0,'+strength+')'; ctx.fillRect(0,0,canvas.width,canvas.height); }

// -------- Scenes (playable) --------
const player = { x: canvas.width/2, y: canvas.height/2, vx:0, vy:0, speed: 220 };

function sceneFootball(dt){
  // Field
  const w=canvas.width,h=canvas.height;
  const grass=ctx.createLinearGradient(0,0,0,h); grass.addColorStop(0,'#0a3'); grass.addColorStop(1,'#062'); ctx.fillStyle=grass; ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='rgba(255,255,255,.85)'; ctx.lineWidth=2; ctx.strokeRect(80,40,w-160,h-80); ctx.beginPath(); ctx.arc(w/2,h/2,70,0,Math.PI*2); ctx.stroke();
  // Player control
  const acc = Engine.hi?1.15:1.0;
  if(keys['arrowup']||keys['w']) player.vy = -player.speed*acc;
  else if(keys['arrowdown']||keys['s']) player.vy = player.speed*acc; else player.vy=0;
  if(keys['arrowleft']||keys['a']) player.vx = -player.speed*acc;
  else if(keys['arrowright']||keys['d']) player.vx = player.speed*acc; else player.vx=0;
  player.x += player.vx*dt; player.y += player.vy*dt;
  player.x=Math.max(100,Math.min(w-100,player.x)); player.y=Math.max(60,Math.min(h-60,player.y));
  // Ball orbit
  const bx = player.x + Math.cos(Engine.t*3)*18; const by = player.y + Math.sin(Engine.t*3)*8;
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(bx,by,6,0,Math.PI*2); ctx.fill();
  // Player
  ctx.fillStyle='#e74c3c'; ctx.beginPath(); ctx.arc(player.x,player.y,12,0,Math.PI*2); ctx.fill();
  if(keys[' ']){ AudioSys.kick(); }
  if(Engine.hi) vignette(.55);
}

let car = { x: canvas.width/2, speed: 0 };
function sceneRacing(dt){
  const w=canvas.width,h=canvas.height;
  const sky=ctx.createLinearGradient(0,0,0,h*0.5); sky.addColorStop(0,'#0b1b3a'); sky.addColorStop(1,'#122'); ctx.fillStyle=sky; ctx.fillRect(0,0,w,h*0.5);
  ctx.fillStyle='#111'; ctx.beginPath(); const roadWTop=80, roadWBot=w*0.8, roadY=h*0.5;
  ctx.moveTo(w/2-roadWTop,roadY); ctx.lineTo(w/2+roadWTop,roadY); ctx.lineTo(w/2+roadWBot,h); ctx.lineTo(w/2-roadWBot,h); ctx.closePath(); ctx.fill();
  // Lane marks
  ctx.strokeStyle='#eee'; ctx.lineWidth=3; const segs=20;
  for(let i=0;i<segs;i++){ const p=i/segs; const y=roadY + p*(h-roadY); const phase=((Engine.t*300)%40); if((i*40+phase)%80<40){ ctx.beginPath(); ctx.moveTo(w/2, y); ctx.lineTo(w/2, y+16); ctx.stroke(); } }
  // Controls
  if(keys['arrowleft']||keys['a']) car.x -= 240*dt;
  if(keys['arrowright']||keys['d']) car.x += 240*dt;
  if(keys['arrowup']||keys['w']) { car.speed = Math.min(1, car.speed + 0.8*dt); AudioSys.engineRev(); }
  else car.speed = Math.max(0.2, car.speed - 0.4*dt);
  // Car
  car.x = Math.max(w*0.2, Math.min(w*0.8, car.x));
  const carY = h*0.78;
  ctx.fillStyle='#0ff'; ctx.fillRect(car.x-22,carY-10,44,20);
  ctx.fillStyle='#055'; ctx.fillRect(car.x-18,carY-16,36,10);
  if(Engine.hi) blurTrail(0.12), vignette(.5);
}

let fighters = { a:{x:360,hp:100}, b:{x:600,hp:100} };
function sceneWWE(dt){
  const w=canvas.width,h=canvas.height;
  ctx.fillStyle='#111'; ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#222'; ctx.fillRect(120,80,w-240,h-160);
  ctx.strokeStyle='#e74c3c'; ctx.lineWidth=6;
  for(let r=0;r<3;r++){ const off=20+r*20; ctx.strokeRect(120+off,80+off,w-240-off*2,h-160-off*2); }
  // Controls
  if(keys['arrowleft']||keys['a']) fighters.a.x -= 200*dt;
  if(keys['arrowright']||keys['d']) fighters.a.x += 200*dt;
  if(keys[' ']) { fighters.b.hp = Math.max(0,fighters.b.hp-0.3); AudioSys.punch(); }
  // Fighters
  ctx.fillStyle='#f1c40f'; ctx.fillRect(fighters.a.x-18,h/2-40,36,40);
  ctx.fillStyle='#3498db'; ctx.fillRect(fighters.b.x-18,h/2-40,36,40);
  // HP bars
  ctx.fillStyle='#2ecc71'; ctx.fillRect(140,70,fighters.a.hp*2,8);
  ctx.fillStyle='#e74c3c'; ctx.fillRect(w-140-fighters.b.hp*2,70,fighters.b.hp*2,8);
  if(Engine.hi) vignette(.55);
}

let hero = { x: canvas.width*0.35, y: canvas.height*0.65-20 };
function sceneOpenWorld(dt){
  const w=canvas.width,h=canvas.height;
  const sky = ctx.createLinearGradient(0,0,0,h); sky.addColorStop(0,'#18314a'); sky.addColorStop(1,'#0c1522'); ctx.fillStyle=sky; ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#0f201c'; ctx.fillRect(0,h*0.65,w,h*0.35);
  for(let i=0;i<40;i++){ const z=1+(i%5); const x=(i*120 - (Engine.t*90)%1200)%(w+200)-100; const y=h*0.65 - z*8; const bw=60/z,bh=120/z; ctx.fillStyle='rgba(110,180,210,'+(0.15+0.1/z)+')'; ctx.fillRect(x,y-bh,bw,bh);
    for(let l=0;l<6;l++){ ctx.fillStyle='rgba(255,255,180,'+(0.06+0.04/z)+')'; ctx.fillRect(x+4,y-bh+8*l,bw-8,3); } }
  // Movement
  if(keys['arrowleft']||keys['a']) hero.x -= 200*dt;
  if(keys['arrowright']||keys['d']) hero.x += 200*dt;
  // Hero
  const hy = h*0.65-20;
  ctx.fillStyle='#ffd166'; ctx.fillRect(hero.x-12,hy-28,24,28);
  ctx.fillStyle='#06d6a0'; ctx.fillRect(hero.x-10,hy-48,20,24);
  if(Engine.hi) vignette(.5);
}

// -------- Main loop --------
let last=0;
function frame(ts){
  const dt = Math.min(0.033, (ts-last)/1000 || 0); last=ts; Engine.t += dt;
  if(Engine.scene==='racing' && Engine.hi){ blurTrail(0.1); } else { ctx.clearRect(0,0,canvas.width,canvas.height); }
  switch(Engine.scene){
    case 'football': sceneFootball(dt); break;
    case 'racing': sceneRacing(dt); break;
    case 'wwe': sceneWWE(dt); break;
    case 'openworld': sceneOpenWorld(dt); break;
    default:
      ctx.fillStyle='#0b121d'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle='rgba(255,255,255,.85)'; ctx.font='18px ui-monospace,Menlo,Consolas,monospace';
      ctx.fillText('Select a template. Use arrows/WASD. Space = action. Toggle Photorealistic & Sound.', 70, canvas.height/2);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
