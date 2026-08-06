/* =====================================================================
   OPS/9 — browser tactical shooter
   Vanilla Three.js, no build step, works straight from GitHub Pages.
   ===================================================================== */

(() => {
  'use strict';

  // ----------------------------------------------------------------
  // DOM refs
  // ----------------------------------------------------------------
  const canvas       = document.getElementById('scene');
  const hud          = document.getElementById('hud');
  const menuStart    = document.getElementById('menu-start');
  const menuPause    = document.getElementById('menu-pause');
  const menuOver     = document.getElementById('menu-over');
  const btnStart     = document.getElementById('btn-start');
  const btnResume    = document.getElementById('btn-resume');
  const btnRestart   = document.getElementById('btn-restart');
  const loadingNote  = document.getElementById('loading-note');

  const elTime       = document.getElementById('hud-time');
  const elScore      = document.getElementById('hud-score');
  const elKills      = document.getElementById('hud-kills');
  const elHealthBar  = document.getElementById('health-bar');
  const elHealthNum  = document.getElementById('health-num');
  const elAmmoCur    = document.getElementById('ammo-current');
  const elAmmoRes     = document.getElementById('ammo-reserve');
  const elAmmoStatus = document.getElementById('ammo-status');
  const crosshair    = document.getElementById('crosshair');
  const hitmarker    = document.getElementById('hitmarker');
  const dmgFlash     = document.getElementById('dmg-flash');
  const killfeed      = document.getElementById('killfeed');
  const finalScore   = document.getElementById('final-score');
  const finalKills   = document.getElementById('final-kills');
  const finalTime    = document.getElementById('final-time');

  // ----------------------------------------------------------------
  // Game state
  // ----------------------------------------------------------------
  const state = {
    running: false,
    paused: false,
    over: false,
    health: 100,
    ammo: 12,
    maxAmmo: 12,
    reserve: 48,
    maxReserve: 96,
    reloading: false,
    score: 0,
    kills: 0,
    elapsed: 0,
    lastShot: 0,
    fireRateMs: 160,
    maxEnemies: 5,
    spawnTimer: 0,
    spawnEvery: 4.5,
  };

  const keys = { forward:false, back:false, left:false, right:false, sprint:false };
  let yaw = 0, pitch = 0;
  const PLAYER_HEIGHT = 1.7;
  const PLAYER_RADIUS = 0.4;
  let velocityY = 0;
  let onGround = true;
  const GRAVITY = -18;
  const JUMP_SPEED = 6;

  // ----------------------------------------------------------------
  // Three.js core
  // ----------------------------------------------------------------
  let scene, camera, renderer, raycaster;
  let gunGroup, muzzleFlash;
  let clock;
  const walls = []; // {mesh, box}
  const enemies = []; // {group, health, maxHealth, speed, mesh, alive}
  const spawnPoints = [
    [24,0,24], [-24,0,24], [24,0,-24], [-24,0,-24],
    [0,0,27], [0,0,-27], [27,0,0], [-27,0,0]
  ];

  function initThree(){
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c0d);
    scene.fog = new THREE.Fog(0x0a0c0d, 18, 55);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 200);
    camera.position.set(0, PLAYER_HEIGHT, 8);
    camera.rotation.order = 'YXZ';

    renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;

    // lights
    const hemi = new THREE.HemisphereLight(0x556677, 0x0a0a0a, 0.9);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffcfa8, 0.8);
    dir.position.set(20, 30, 10);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024,1024);
    dir.shadow.camera.left = -40; dir.shadow.camera.right = 40;
    dir.shadow.camera.top = 40; dir.shadow.camera.bottom = -40;
    scene.add(dir);

    buildArena();
    buildGun();

    raycaster = new THREE.Raycaster();
    clock = new THREE.Clock();

    window.addEventListener('resize', onResize);
  }

  function onResize(){
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ----------------------------------------------------------------
  // Arena construction
  // ----------------------------------------------------------------
  function makeGridTexture(){
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#202426';
    ctx.fillRect(0,0,size,size);
    ctx.strokeStyle = '#33393c';
    ctx.lineWidth = 2;
    const step = size/8;
    for(let i=0;i<=8;i++){
      ctx.beginPath(); ctx.moveTo(i*step,0); ctx.lineTo(i*step,size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,i*step); ctx.lineTo(size,i*step); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(16,16);
    return tex;
  }

  function addWall(x,z,w,d,h=3.2,color=0x2a2f32){
    const geo = new THREE.BoxGeometry(w,h,d);
    const mat = new THREE.MeshStandardMaterial({ color, roughness:0.9, metalness:0.05 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, h/2, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    const box = new THREE.Box3().setFromObject(mesh);
    walls.push({ mesh, box });
  }

  function buildArena(){
    const floorGeo = new THREE.PlaneGeometry(64,64);
    const floorMat = new THREE.MeshStandardMaterial({ map: makeGridTexture(), roughness:1 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.receiveShadow = true;
    scene.add(floor);

    // perimeter
    addWall(0, 32, 64, 1, 5, 0x1c2022);
    addWall(0, -32, 64, 1, 5, 0x1c2022);
    addWall(32, 0, 1, 64, 5, 0x1c2022);
    addWall(-32, 0, 1, 64, 5, 0x1c2022);

    // cover boxes, laid out like tactical map corners
    const covers = [
      [8,0, 4,4], [-8,0, 4,4],
      [14,14, 5,3], [-14,14, 5,3], [14,-14, 5,3], [-14,-14, 5,3],
      [0,18, 8,2.5], [0,-18, 8,2.5],
      [20,0, 2.5,10], [-20,0, 2.5,10],
    ];
    covers.forEach(([x,z,w,d]) => addWall(x,z,w,d, 2.4, 0x24292c));

    // orange accent pillars to sell the tactical-arena identity
    [[10,10],[-10,-10],[10,-10],[-10,10]].forEach(([x,z]) => {
      const geo = new THREE.CylinderGeometry(0.35,0.35,3.4,12);
      const mat = new THREE.MeshStandardMaterial({ color:0xff5a1f, emissive:0x552108, roughness:0.4 });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x,1.7,z);
      m.castShadow = true;
      scene.add(m);
      const box = new THREE.Box3().setFromObject(m);
      walls.push({ mesh:m, box });
    });
  }

  function buildGun(){
    gunGroup = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color:0x15171a, roughness:0.5, metalness:0.4 });
    const accentMat = new THREE.MeshStandardMaterial({ color:0xff5a1f, roughness:0.4, emissive:0x391505 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,0.55), bodyMat);
    body.position.set(0,0,0);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.35,10), bodyMat);
    barrel.rotation.x = Math.PI/2;
    barrel.position.set(0, 0.02, -0.42);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.2,0.08), bodyMat);
    mag.position.set(0,-0.14,0.05);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.125,0.015,0.2), accentMat);
    stripe.position.set(0,0.05,0.05);

    gunGroup.add(body, barrel, mag, stripe);
    gunGroup.position.set(0.28, -0.28, -0.6);
    camera.add(gunGroup);
    scene.add(camera);

    muzzleFlash = new THREE.PointLight(0xffb066, 0, 4, 2);
    muzzleFlash.position.set(0,0.02,-0.6);
    gunGroup.add(muzzleFlash);
  }

  // ----------------------------------------------------------------
  // Enemies
  // ----------------------------------------------------------------
  function spawnEnemy(){
    if(enemies.filter(e=>e.alive).length >= state.maxEnemies) return;
    const [sx,,sz] = spawnPoints[Math.floor(Math.random()*spawnPoints.length)];

    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color:0xb23a2e, roughness:0.7 });
    const headMat = new THREE.MeshStandardMaterial({ color:0xd9a878, roughness:0.6 });

    // torso built from a cylinder + rounded shoulder cap (CapsuleGeometry needs three.js r142+, we ship r128)
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 1.0, 10), bodyMat);
    torso.position.y = 1.0;
    torso.castShadow = true;
    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), bodyMat);
    shoulderCap.position.y = 1.5;
    shoulderCap.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 12), headMat);
    head.position.y = 1.78;
    head.castShadow = true;

    group.add(torso, shoulderCap, head);
    group.position.set(sx + (Math.random()*4-2), 0, sz + (Math.random()*4-2));
    scene.add(group);

    const speed = 1.6 + Math.random()*0.8 + Math.min(state.kills*0.02, 1.4);
    enemies.push({ group, torso, shoulderCap, head, health:100, maxHealth:100, speed, alive:true, attackCooldown:0 });
  }

  function updateEnemies(dt){
    const playerPos = camera.position;
    enemies.forEach(e => {
      if(!e.alive) return;
      const dx = playerPos.x - e.group.position.x;
      const dz = playerPos.z - e.group.position.z;
      const dist = Math.hypot(dx,dz);

      if(dist > 1.6){
        const nx = dx/dist, nz = dz/dist;
        e.group.position.x += nx * e.speed * dt;
        e.group.position.z += nz * e.speed * dt;
        e.group.rotation.y = Math.atan2(nx, nz);
      } else {
        e.attackCooldown -= dt;
        if(e.attackCooldown <= 0){
          e.attackCooldown = 0.9;
          takeDamage(9);
        }
      }
    });
  }

  function damageEnemy(enemy, amount, headshot){
    enemy.health -= amount;
    if(enemy.health <= 0 && enemy.alive){
      killEnemy(enemy, headshot);
    }
  }

  function killEnemy(enemy, headshot){
    enemy.alive = false;
    scene.remove(enemy.group);
    state.kills += 1;
    state.score += headshot ? 150 : 100;
    addKillfeed(headshot ? 'ГОЛОВА • +150' : 'УСТРАНЁН • +100', headshot);
    updateHUD();
  }

  function addKillfeed(text, headshot){
    const div = document.createElement('div');
    div.className = 'killfeed-entry';
    if(headshot) div.style.borderLeftColor = '#3aa6ff';
    div.textContent = text;
    killfeed.appendChild(div);
    setTimeout(() => div.remove(), 3200);
  }

  // ----------------------------------------------------------------
  // Player movement + collision
  // ----------------------------------------------------------------
  function resolveCollisions(pos){
    for(const w of walls){
      const b = w.box;
      const closestX = Math.max(b.min.x, Math.min(pos.x, b.max.x));
      const closestZ = Math.max(b.min.z, Math.min(pos.z, b.max.z));
      const dx = pos.x - closestX;
      const dz = pos.z - closestZ;
      const distSq = dx*dx + dz*dz;
      if(distSq < PLAYER_RADIUS*PLAYER_RADIUS){
        const dist = Math.sqrt(distSq) || 0.0001;
        const push = (PLAYER_RADIUS - dist);
        pos.x += (dx/dist) * push;
        pos.z += (dz/dist) * push;
      }
    }
    const bound = 31 - PLAYER_RADIUS;
    pos.x = Math.max(-bound, Math.min(bound, pos.x));
    pos.z = Math.max(-bound, Math.min(bound, pos.z));
  }

  function updateMovement(dt){
    const speed = (keys.sprint ? 6.4 : 4.2);
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(Math.sin(yaw+Math.PI/2), 0, Math.cos(yaw+Math.PI/2));

    const move = new THREE.Vector3();
    if(keys.forward) move.sub(forward);
    if(keys.back) move.add(forward);
    if(keys.right) move.add(right);
    if(keys.left) move.sub(right);
    if(move.lengthSq() > 0){
      move.normalize().multiplyScalar(speed*dt);
      camera.position.x += move.x;
      camera.position.z += move.z;
    }

    // gravity / jump
    velocityY += GRAVITY*dt;
    camera.position.y += velocityY*dt;
    if(camera.position.y <= PLAYER_HEIGHT){
      camera.position.y = PLAYER_HEIGHT;
      velocityY = 0;
      onGround = true;
    } else {
      onGround = false;
    }

    resolveCollisions(camera.position);

    // gun bob
    const moving = move.lengthSq() > 0 && onGround;
    const t = performance.now()/1000;
    const bobY = moving ? Math.sin(t*9)*0.015 : Math.sin(t*2)*0.004;
    const bobX = moving ? Math.cos(t*4.5)*0.01 : 0;
    gunGroup.position.set(0.28 + bobX, -0.28 + bobY, -0.6);
  }

  // ----------------------------------------------------------------
  // Shooting
  // ----------------------------------------------------------------
  function tryShoot(){
    const now = performance.now();
    if(state.reloading) return;
    if(state.ammo <= 0){ startReload(); return; }
    if(now - state.lastShot < state.fireRateMs) return;
    state.lastShot = now;
    state.ammo -= 1;

    raycaster.setFromCamera({x:0,y:0}, camera);
    let hit = null, headshot = false;
    for(const e of enemies){
      if(!e.alive) continue;
      const hits = raycaster.intersectObjects([e.torso, e.shoulderCap, e.head], false);
      if(hits.length){
        if(!hit || hits[0].distance < hit.distance){
          hit = hits[0];
          headshot = hits[0].object === e.head;
          hit.enemy = e;
        }
      }
    }

    if(hit){
      damageEnemy(hit.enemy, headshot ? 100 : 34, headshot);
      flashHitmarker();
      playTone(headshot ? 920 : 620, 0.05, 'square', 0.06);
    }

    playTone(180, 0.06, 'sawtooth', 0.12);
    recoilKick();
    crosshair.classList.add('fire');
    setTimeout(()=>crosshair.classList.remove('fire'), 90);
    updateHUD();

    if(state.ammo === 0) startReload();
  }

  function recoilKick(){
    muzzleFlash.intensity = 3.5;
    setTimeout(()=>{ muzzleFlash.intensity = 0; }, 60);
    pitch += 0.012;
  }

  function flashHitmarker(){
    hitmarker.classList.remove('show');
    void hitmarker.offsetWidth;
    hitmarker.classList.add('show');
  }

  function startReload(){
    if(state.reloading || state.reserve <= 0 || state.ammo === state.maxAmmo) return;
    state.reloading = true;
    elAmmoStatus.textContent = 'ПЕРЕЗАРЯДКА…';
    playTone(300, 0.15, 'triangle', 0.08);
    setTimeout(() => {
      const needed = state.maxAmmo - state.ammo;
      const take = Math.min(needed, state.reserve);
      state.ammo += take;
      state.reserve -= take;
      state.reloading = false;
      elAmmoStatus.textContent = 'M4 // ТАКТИЧЕСКИЙ';
      updateHUD();
    }, 1450);
  }

  // ----------------------------------------------------------------
  // Damage / HUD
  // ----------------------------------------------------------------
  function takeDamage(amount){
    if(state.over) return;
    state.health = Math.max(0, state.health - amount);
    dmgFlash.classList.remove('show');
    void dmgFlash.offsetWidth;
    dmgFlash.classList.add('show');
    playTone(110, 0.12, 'sawtooth', 0.1);
    updateHUD();
    if(state.health <= 0) gameOver();
  }

  function updateHUD(){
    elScore.textContent = state.score;
    elKills.textContent = state.kills;
    elHealthNum.textContent = Math.round(state.health);
    elHealthBar.style.width = state.health + '%';
    elHealthBar.style.background = state.health > 40
      ? 'linear-gradient(90deg,var(--green),#9be36f)'
      : 'linear-gradient(90deg,var(--red),#ff8a5a)';
    elAmmoCur.textContent = state.ammo;
    elAmmoRes.textContent = state.reserve;
    elAmmoCur.classList.toggle('low', state.ammo <= 3);

    const mm = String(Math.floor(state.elapsed/60)).padStart(2,'0');
    const ss = String(Math.floor(state.elapsed%60)).padStart(2,'0');
    elTime.textContent = `${mm}:${ss}`;
  }

  // ----------------------------------------------------------------
  // Tiny WebAudio synth — no external sound assets needed
  // ----------------------------------------------------------------
  let actx = null;
  function playTone(freq, dur, type='sine', vol=0.1){
    try{
      if(!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = vol;
      gain.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
      osc.connect(gain).connect(actx.destination);
      osc.start();
      osc.stop(actx.currentTime + dur);
    }catch(e){ /* audio not available, ignore */ }
  }

  // ----------------------------------------------------------------
  // Input
  // ----------------------------------------------------------------
  function onKeyDown(e){
    switch(e.code){
      case 'KeyW': case 'ArrowUp': keys.forward = true; break;
      case 'KeyS': case 'ArrowDown': keys.back = true; break;
      case 'KeyA': case 'ArrowLeft': keys.left = true; break;
      case 'KeyD': case 'ArrowRight': keys.right = true; break;
      case 'ShiftLeft': case 'ShiftRight': keys.sprint = true; break;
      case 'KeyR': startReload(); break;
      case 'Space':
        if(onGround){ velocityY = JUMP_SPEED; onGround = false; }
        break;
      case 'Escape': if(state.running && !state.over) togglePause(); break;
    }
  }
  function onKeyUp(e){
    switch(e.code){
      case 'KeyW': case 'ArrowUp': keys.forward = false; break;
      case 'KeyS': case 'ArrowDown': keys.back = false; break;
      case 'KeyA': case 'ArrowLeft': keys.left = false; break;
      case 'KeyD': case 'ArrowRight': keys.right = false; break;
      case 'ShiftLeft': case 'ShiftRight': keys.sprint = false; break;
    }
  }
  function onMouseMove(e){
    if(document.pointerLockElement !== canvas) return;
    yaw -= e.movementX * 0.0022;
    pitch -= e.movementY * 0.0022;
    pitch = Math.max(-Math.PI/2 + 0.05, Math.min(Math.PI/2 - 0.05, pitch));
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
  }
  function onMouseDown(e){
    if(document.pointerLockElement !== canvas) return;
    if(e.button === 0) tryShoot();
  }

  function onPointerLockChange(){
    if(document.pointerLockElement === canvas){
      state.paused = false;
      menuPause.classList.add('hidden');
    } else if(state.running && !state.over){
      state.paused = true;
      menuPause.classList.remove('hidden');
    }
  }

  // ----------------------------------------------------------------
  // Flow control
  // ----------------------------------------------------------------
  function startGame(){
    // reset state
    Object.assign(state, {
      running:true, paused:false, over:false,
      health:100, ammo:12, maxAmmo:12, reserve:48, maxReserve:96,
      reloading:false, score:0, kills:0, elapsed:0, lastShot:0,
      maxEnemies:5, spawnTimer:0, spawnEvery:4.5,
    });
    enemies.splice(0, enemies.length).forEach(e => scene.remove(e.group));
    yaw = 0; pitch = 0;
    camera.position.set(0, PLAYER_HEIGHT, 8);
    camera.rotation.set(0,0,0,'YXZ');
    killfeed.innerHTML = '';

    menuStart.classList.add('hidden');
    menuOver.classList.add('hidden');
    menuPause.classList.add('hidden');
    hud.classList.remove('hidden');
    updateHUD();

    for(let i=0;i<3;i++) spawnEnemy();
    canvas.requestPointerLock();
    clock.start();
    requestAnimationFrame(loop);
  }

  function togglePause(){
    if(state.paused){
      canvas.requestPointerLock();
    } else {
      document.exitPointerLock();
    }
  }

  function gameOver(){
    state.over = true;
    state.running = false;
    document.exitPointerLock();
    finalScore.textContent = state.score;
    finalKills.textContent = state.kills;
    const mm = String(Math.floor(state.elapsed/60)).padStart(2,'0');
    const ss = String(Math.floor(state.elapsed%60)).padStart(2,'0');
    finalTime.textContent = `${mm}:${ss}`;
    hud.classList.add('hidden');
    menuOver.classList.remove('hidden');
  }

  // ----------------------------------------------------------------
  // Main loop
  // ----------------------------------------------------------------
  function loop(){
    if(!state.running) return;
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);

    if(!state.paused && !state.over){
      state.elapsed += dt;
      updateMovement(dt);
      updateEnemies(dt);

      state.spawnTimer += dt;
      const targetInterval = Math.max(1.8, state.spawnEvery - state.kills*0.05);
      if(state.spawnTimer > targetInterval){
        state.spawnTimer = 0;
        spawnEnemy();
      }
      if(state.kills > 0 && state.kills % 8 === 0) state.maxEnemies = Math.min(10, 5 + Math.floor(state.kills/8));

      if(Math.floor(state.elapsed*10) % 10 === 0) updateHUD();
    }

    renderer.render(scene, camera);
  }

  // ----------------------------------------------------------------
  // Wire up UI
  // ----------------------------------------------------------------
  function bindUI(){
    btnStart.addEventListener('click', startGame);
    btnResume.addEventListener('click', () => canvas.requestPointerLock());
    btnRestart.addEventListener('click', startGame);

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    document.addEventListener('pointerlockchange', onPointerLockChange);
  }

  // ----------------------------------------------------------------
  // Boot
  // ----------------------------------------------------------------
  function boot(){
    if(typeof THREE === 'undefined'){
      loadingNote.textContent = 'Не удалось загрузить Three.js. Проверьте подключение к интернету.';
      return;
    }
    initThree();
    bindUI();
    loadingNote.textContent = 'Готово. Кликните на арену, чтобы захватить курсор.';
    btnStart.disabled = false;
  }

  btnStart.disabled = true;
  window.addEventListener('load', boot);
})();
