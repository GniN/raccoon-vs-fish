(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay');

  const BEST_KEY = 'raccoon-vs-legfish-best';
  let best = parseFloat(localStorage.getItem(BEST_KEY) || '0') || 0;
  bestEl.textContent = best.toFixed(1);

  const STATE = { MENU: 'menu', PLAYING: 'playing', GAMEOVER: 'gameover' };
  let state = STATE.MENU;

  const PLAYER_SPEED = 230;
  const FISH_BASE_SPEED = 150;
  const FISH_SPEED_PER_SEC = 3.5;
  const FISH_SPAWN_INTERVAL = 9.0;
  const PLAYER_RADIUS = 20;
  const FISH_RADIUS = 22;

  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
    keys.add(e.key.toLowerCase());
    if (e.key === ' ' || e.key === 'Enter') {
      if (state === STATE.MENU || state === STATE.GAMEOVER) startGame();
    }
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.key.toLowerCase());
  });
  window.addEventListener('blur', () => keys.clear());

  const player = {
    x: W / 2,
    y: H / 2,
    r: PLAYER_RADIUS,
    facing: 1,
    bob: 0,
    tail: 0,
  };

  const fishes = [];
  const particles = [];
  let elapsed = 0;
  let spawnTimer = 0;

  function reset() {
    player.x = W / 2;
    player.y = H / 2;
    player.facing = 1;
    player.bob = 0;
    player.tail = 0;
    fishes.length = 0;
    particles.length = 0;
    elapsed = 0;
    spawnTimer = 0;
    spawnFish();
  }

  function startGame() {
    reset();
    state = STATE.PLAYING;
    overlay.classList.add('hidden');
  }

  function gameOver() {
    state = STATE.GAMEOVER;
    if (elapsed > best) {
      best = elapsed;
      localStorage.setItem(BEST_KEY, best.toFixed(2));
      bestEl.textContent = best.toFixed(1);
    }
    showGameOverOverlay();
  }

  function el(tag, opts = {}, children = []) {
    const node = document.createElement(tag);
    if (opts.class) node.className = opts.class;
    if (opts.text != null) node.textContent = opts.text;
    for (const child of children) node.appendChild(child);
    return node;
  }

  function showGameOverOverlay() {
    overlay.classList.remove('hidden');
    const panel = overlay.querySelector('.panel');
    panel.replaceChildren(
      el('h1', { text: 'Caught!' }),
      el('p', { class: 'tagline', text: 'The leg fish wins this round.' }),
      el('div', { class: 'stat-line' }, [
        el('span', { text: 'This run' }),
        el('strong', { text: `${elapsed.toFixed(1)} s` }),
      ]),
      el('div', { class: 'stat-line' }, [
        el('span', { text: 'Best' }),
        el('strong', { text: `${best.toFixed(1)} s` }),
      ]),
      (() => {
        const p = el('p', { class: 'action' });
        p.appendChild(document.createTextNode('Press '));
        p.appendChild(el('kbd', { text: 'Space' }));
        p.appendChild(document.createTextNode(' to try again'));
        return p;
      })()
    );
  }

  function spawnFish() {
    const edge = Math.floor(Math.random() * 4);
    let x, y;
    if (edge === 0)      { x = Math.random() * W; y = -40; }
    else if (edge === 1) { x = W + 40;            y = Math.random() * H; }
    else if (edge === 2) { x = Math.random() * W; y = H + 40; }
    else                 { x = -40;               y = Math.random() * H; }

    fishes.push({
      x, y,
      r: FISH_RADIUS,
      facing: 1,
      walkPhase: Math.random() * Math.PI * 2,
      bob: Math.random() * Math.PI * 2,
    });
  }

  function update(dt) {
    if (state !== STATE.PLAYING) return;

    elapsed += dt;
    scoreEl.textContent = elapsed.toFixed(1);

    spawnTimer += dt;
    if (spawnTimer >= FISH_SPAWN_INTERVAL) {
      spawnTimer = 0;
      spawnFish();
    }

    let dx = 0, dy = 0;
    if (keys.has('arrowleft')  || keys.has('a')) dx -= 1;
    if (keys.has('arrowright') || keys.has('d')) dx += 1;
    if (keys.has('arrowup')    || keys.has('w')) dy -= 1;
    if (keys.has('arrowdown')  || keys.has('s')) dy += 1;
    const mag = Math.hypot(dx, dy);
    if (mag > 0) {
      dx /= mag; dy /= mag;
      player.x += dx * PLAYER_SPEED * dt;
      player.y += dy * PLAYER_SPEED * dt;
      if (dx !== 0) player.facing = dx > 0 ? 1 : -1;
      player.tail += dt * 8;
    } else {
      player.tail += dt * 2;
    }
    player.bob += dt * 6;
    player.x = Math.max(player.r, Math.min(W - player.r, player.x));
    player.y = Math.max(player.r, Math.min(H - player.r, player.y));

    const fishSpeed = FISH_BASE_SPEED + elapsed * FISH_SPEED_PER_SEC;
    for (const f of fishes) {
      const fdx = player.x - f.x;
      const fdy = player.y - f.y;
      const fmag = Math.hypot(fdx, fdy) || 1;
      f.x += (fdx / fmag) * fishSpeed * dt;
      f.y += (fdy / fmag) * fishSpeed * dt;
      f.facing = fdx >= 0 ? 1 : -1;
      f.walkPhase += dt * 9;
      f.bob += dt * 4;

      const hitDist = f.r + player.r - 6;
      if (Math.hypot(fdx, fdy) < hitDist) {
        spawnHitParticles(player.x, player.y);
        gameOver();
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function spawnHitParticles(x, y) {
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 80 + Math.random() * 160;
      particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.6 + Math.random() * 0.4,
        color: Math.random() < 0.5 ? '#ffd166' : '#fff1c4',
        size: 2 + Math.random() * 3,
      });
    }
  }

  function drawGround() {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#2a4a31';
    for (let i = 0; i < 40; i++) {
      const x = (i * 137.5) % W;
      const y = (i * 71.3) % H;
      ctx.beginPath();
      ctx.ellipse(x, y, 22, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawShadow(x, y, r) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.85, r * 0.9, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawRaccoon(p) {
    const bobY = Math.sin(p.bob) * 2;
    drawShadow(p.x, p.y + 4, p.r);
    ctx.save();
    ctx.translate(p.x, p.y + bobY);
    ctx.scale(p.facing, 1);

    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const tx = -22 - t * 18;
      const ty = 4 - Math.sin(p.tail + t * 2) * 6 - t * 4;
      const tailWag = Math.sin(p.tail) * 0.35;
      ctx.fillStyle = i % 2 === 0 ? '#3a3a3a' : '#1c1c1c';
      ctx.beginPath();
      ctx.ellipse(tx, ty, 7 - t * 1.2, 8 - t * 1.2, tailWag * (0.5 + t), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath();
    ctx.ellipse(-4, 14, 5, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(10, 14, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#6e6e6e';
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#cfc6b3';
    ctx.beginPath();
    ctx.ellipse(2, 4, 14, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#5a5a5a';
    ctx.beginPath();
    ctx.ellipse(-10, -16, 6, 7, -0.3, 0, Math.PI * 2);
    ctx.ellipse(10, -16, 6, 7, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f0a0b8';
    ctx.beginPath();
    ctx.ellipse(-10, -15, 2.5, 3.5, -0.3, 0, Math.PI * 2);
    ctx.ellipse(10, -15, 2.5, 3.5, 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#7a7a7a';
    ctx.beginPath();
    ctx.ellipse(4, -4, 18, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f5efe0';
    ctx.beginPath();
    ctx.ellipse(6, 2, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(-12, -8);
    ctx.quadraticCurveTo(4, -14, 20, -8);
    ctx.quadraticCurveTo(20, -2, 14, -2);
    ctx.quadraticCurveTo(4, -6, -6, -2);
    ctx.quadraticCurveTo(-12, -2, -12, -8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-2, -6, 3.4, 0, Math.PI * 2);
    ctx.arc(14, -6, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(-1, -5.5, 2, 0, Math.PI * 2);
    ctx.arc(15, -5.5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-0.4, -6.2, 0.7, 0, Math.PI * 2);
    ctx.arc(15.6, -6.2, 0.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(7, 1, 2.2, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(7, 3);
    ctx.quadraticCurveTo(4, 6, 2, 5);
    ctx.moveTo(7, 3);
    ctx.quadraticCurveTo(10, 6, 12, 5);
    ctx.stroke();

    ctx.restore();
  }

  function drawFish(f) {
    const bobY = Math.sin(f.bob) * 2.5;
    drawShadow(f.x, f.y + 6, f.r);
    ctx.save();
    ctx.translate(f.x, f.y + bobY);
    ctx.scale(f.facing, 1);

    const legSwing = Math.sin(f.walkPhase);
    const legSwing2 = Math.sin(f.walkPhase + Math.PI);

    ctx.strokeStyle = '#2b6a73';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-7, 12);
    ctx.lineTo(-7, 22 + Math.max(0, legSwing) * 4);
    ctx.moveTo(7, 12);
    ctx.lineTo(7, 22 + Math.max(0, legSwing2) * 4);
    ctx.stroke();

    ctx.fillStyle = '#ffcf6b';
    ctx.beginPath();
    ctx.ellipse(-7, 26 + Math.max(0, legSwing) * 4, 6, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(7, 26 + Math.max(0, legSwing2) * 4, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#3aa6b3';
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.lineTo(-36, -10);
    ctx.lineTo(-36, 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2c8a96';
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.lineTo(-34, -6);
    ctx.lineTo(-34, 6);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#46c2d0';
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#9be7ef';
    ctx.beginPath();
    ctx.ellipse(2, 5, 16, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#3aa6b3';
    ctx.beginPath();
    ctx.moveTo(-2, -14);
    ctx.lineTo(6, -22);
    ctx.lineTo(10, -14);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#2c8a96';
    ctx.beginPath();
    ctx.ellipse(-4, 8, 6, 3, 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#2c8a96';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-10, -6);
    ctx.quadraticCurveTo(-12, 0, -10, 6);
    ctx.moveTo(-16, -4);
    ctx.quadraticCurveTo(-18, 0, -16, 4);
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(10, -3, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a2a30';
    ctx.beginPath();
    ctx.arc(11.5, -2.5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(12.5, -3.5, 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#1a2a30';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(14, 4);
    ctx.quadraticCurveTo(18, 8, 22, 4);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 180, 200, 0.55)';
    ctx.beginPath();
    ctx.ellipse(6, 4, 3.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawGround();

    const drawables = [
      { y: player.y, fn: () => drawRaccoon(player) },
      ...fishes.map(f => ({ y: f.y, fn: () => drawFish(f) })),
    ];
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.fn();

    drawParticles();
  }

  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  draw();
  requestAnimationFrame((t) => { lastTime = t; loop(t); });
})();
