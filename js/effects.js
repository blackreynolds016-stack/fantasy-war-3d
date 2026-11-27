/* effects.js — partículas (un solo InstancedMesh), flechas y bolas de fuego (pools), barras de vida (instanciadas). No crea objetos nuevos por fotograma. */
import * as THREE from 'three';

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Effects {
  constructor(scene, maxParticles = 260) {
    this.scene = scene; this.cap = maxParticles; const N = 420;
    // ---- partículas
    const geo = new THREE.PlaneGeometry(1, 1), mat = new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, N); this.mesh.frustumCulled = false; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage); this.mesh.renderOrder = 5; scene.add(this.mesh);
    this.p = []; for (let i = 0; i < N; i++) this.p.push({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1, grow: 0, g: 0, r: 1, gc: 1, b: 1 });
    this.nextP = 0; this.N = N; this.dummy = new THREE.Object3D(); this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < N; i++) this.mesh.setMatrixAt(i, this.zero);
    this.col = new THREE.Color();
    // ---- flechas y bolas de fuego (pools)
    this.arrows = []; const ag = new THREE.BoxGeometry(0.8, 0.045, 0.045), am = new THREE.MeshStandardMaterial({ color: 0x8a6a40 }); const tg = new THREE.ConeGeometry(0.05, 0.14, 5); tg.rotateZ(-Math.PI / 2); tg.translate(0.46, 0, 0);
    for (let i = 0; i < 48; i++) { const m = new THREE.Mesh(ag, am), tip = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ color: 0xcfd5dd, metalness: .8, roughness: .3 })); m.add(tip); m.visible = false; scene.add(m); this.arrows.push({ m, id: 0 }); }
    this.balls = []; const bg = new THREE.SphereGeometry(0.28, 10, 8), bm = new THREE.MeshBasicMaterial({ color: 0xffa040 });
    for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(bg, bm); m.visible = false; scene.add(m); this.balls.push({ m, id: 0 }); }
    // ---- barras de vida
    const B = 160; this.B = B; const pg = new THREE.PlaneGeometry(1, 1);
    this.bgBars = new THREE.InstancedMesh(pg, new THREE.MeshBasicMaterial({ color: 0x101418, transparent: true, opacity: 0.85, depthWrite: false, fog: false }), B);
    this.fgBars = new THREE.InstancedMesh(pg, new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false, fog: false }), B);
    this.fgBars.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(B * 3), 3); for (const m of [this.bgBars, this.fgBars]) { m.frustumCulled = false; m.renderOrder = 6; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); }
    this.fgBars.instanceColor.setUsage(THREE.DynamicDrawUsage);
  }
  setCap(n) { this.cap = n; }
  _spawn() {
    let tries = 0; while (tries++ < 8) { const p = this.p[this.nextP]; this.nextP = (this.nextP + 1) % this.N; if (!p.on) return p; }
    return this.p[this.nextP];
  }
  /** Lanza n partículas. o: {color, speed, life, size, grow, gravity, up, spread, vx} */
  burst(x, y, z, n, o) {
    const live = this._live || 0; if (live > this.cap) n = Math.ceil(n * 0.3);
    this.col.set(o.color ?? 0xffffff); const sp = o.speed ?? 3, sd = o.spread ?? 1;
    for (let i = 0; i < n; i++) {
      const p = this._spawn(); p.on = true; p.x = x + (Math.random() - .5) * (o.pos ?? .2); p.y = y; p.z = z + (Math.random() - .5) * (o.pos ?? .2);
      const a = Math.random() * Math.PI * 2, e = (Math.random() - .3) * sd; p.vx = Math.cos(a) * sp * (.3 + Math.random()) * sd + (o.vx ?? 0); p.vz = Math.sin(a) * sp * (.3 + Math.random()) * sd * .6; p.vy = (o.up ?? 1) * sp * (.3 + Math.random()) * (1 + e * .3);
      p.max = p.life = (o.life ?? .5) * (.7 + Math.random() * .6); p.size = (o.size ?? .3) * (.7 + Math.random() * .6); p.grow = o.grow ?? 0; p.g = o.gravity ?? 6; p.r = this.col.r; p.gc = this.col.g; p.b = this.col.b;
    }
  }
  slash(x, y, z, dir, heavy) { this.burst(x, y, z, heavy ? 14 : 7, { color: heavy ? 0xffd070 : 0xfff2c0, speed: heavy ? 4.5 : 3, life: .28, size: heavy ? .4 : .26, gravity: 9, vx: dir * 1.2, spread: .9 }); }
  blood(x, y, z) { this.burst(x, y, z, 6, { color: 0xd04040, speed: 2.4, life: .4, size: .2, gravity: 10, spread: .8 }); }
  dust(x, z, n = 6) { this.burst(x, .12, z, n, { color: 0xc8b89a, speed: 1.4, life: .7, size: .5, grow: 1.4, gravity: -.4, up: .35, spread: 1.2 }); }
  explosion(x, z, r, kind) {
    if (kind === 'fire') { this.burst(x, .8, z, 26, { color: 0xff8a2a, speed: r * 1.6, life: .55, size: .75, grow: 1.5, gravity: 1, spread: 1.2, pos: r * .5 }); this.burst(x, 1.1, z, 12, { color: 0xffe08a, speed: r, life: .35, size: .5, gravity: 3 }); this.burst(x, 1, z, 10, { color: 0x5a4a44, speed: 1.2, life: 1.1, size: .9, grow: 1.8, gravity: -1.4, up: 1.2 }); }
    else { this.burst(x, .15, z, 16, { color: 0xd8c8a8, speed: r * 1.8, life: .6, size: .6, grow: 1.6, gravity: .5, up: .3, spread: 1.3, pos: r * .4 }); this.burst(x, .3, z, 8, { color: 0xffe0a0, speed: r, life: .25, size: .45, gravity: 8 }); }
  }
  coin(x, y, z) { this.burst(x, y, z, 4, { color: 0xffd34a, speed: 2, life: .6, size: .22, gravity: 5, up: 1.6 }); }
  castleBoom(x) { for (let i = 0; i < 5; i++) this.burst(x + (Math.random() - .5) * 6, 1.5 + Math.random() * 4, (Math.random() - .5) * 3, 14, { color: i % 2 ? 0xff7a2a : 0xffcf6a, speed: 5, life: .9, size: 1.1, grow: 1.8, gravity: 2, pos: 1 }); this.burst(x, 2, 0, 22, { color: 0x4a403c, speed: 2.4, life: 2, size: 1.6, grow: 2.2, gravity: -1, up: 1.6, pos: 3 }); }
  smoke(x, y, z) { this.burst(x, y, z, 2, { color: 0x6a605a, speed: .6, life: 1.4, size: .8, grow: 1.5, gravity: -.8, up: 1, pos: 1.2 }); }

  update(dt, camera) {
    const m = this.mesh, d = this.dummy; let live = 0;
    for (let i = 0; i < this.N; i++) {
      const p = this.p[i]; if (!p.on) continue;
      p.life -= dt; if (p.life <= 0) { p.on = false; m.setMatrixAt(i, this.zero); continue; }
      live++; p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < 0.03) { p.y = 0.03; p.vy *= -.2; p.vx *= .8; }
      const k = p.life / p.max, s = (p.size + p.grow * (1 - k) * p.size) * Math.min(1, k * 2.6 + .15);
      d.position.set(p.x, p.y, p.z); d.quaternion.copy(camera.quaternion); d.scale.set(s, s, s); d.updateMatrix(); m.setMatrixAt(i, d.matrix);
      const f = Math.min(1, k * 1.5); m.instanceColor.setXYZ(i, p.r * f, p.gc * f, p.b * f);
    }
    this._live = live; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
  }
  /** Proyectiles: se sincronizan con la lista del juego (flechas y bolas de fuego). */
  syncProjectiles(list) {
    let ai = 0, bi = 0;
    for (const p of list) {
      if (p.kind === 'arrow') { const a = this.arrows[ai++]; if (!a) continue; a.m.visible = true; a.m.position.set(p.x, p.y, p.z); a.m.rotation.set(0, 0, p.rot * p.dirx); a.m.scale.x = p.dirx < 0 ? -1 : 1; }
      else { const b = this.balls[bi++]; if (!b) continue; b.m.visible = true; b.m.position.set(p.x, p.y, p.z); this.burst(p.x, p.y, p.z, 1, { color: 0xff9a30, speed: .6, life: .3, size: .35, gravity: 0 }); }
    }
    for (; ai < this.arrows.length; ai++) if (this.arrows[ai].m.visible) this.arrows[ai].m.visible = false;
    for (; bi < this.balls.length; bi++) if (this.balls[bi].m.visible) this.balls[bi].m.visible = false;
  }
  /** Barras de vida sobre las unidades heridas. */
  bars(units, camX, half) {
    let n = 0; const d = this.dummy, c = this.col;
    for (const u of units) {
      if (n >= this.B) break; if (u.state === 'dead' || u.hp >= u.maxHp * 0.999 && u.hurtT < -3) continue; if (u.hp >= u.maxHp * 0.999) continue; if (Math.abs(u.x - camX) > half) continue;
      const f = Math.max(0, u.hp / u.maxHp), w = 0.9 * Math.max(0.9, u.def.scale), y = 2.15 * u.def.scale + 0.15;
      d.position.set(u.x, y, u.z + 0.05); d.rotation.set(0, 0, 0); d.scale.set(w, 0.11, 1); d.updateMatrix(); this.bgBars.setMatrixAt(n, d.matrix);
      d.position.set(u.x - w * (1 - f) / 2, y, u.z + 0.07); d.scale.set(w * f, 0.08, 1); d.updateMatrix(); this.fgBars.setMatrixAt(n, d.matrix);
      c.setRGB(u.team === 0 ? 0.35 : 0.95, u.team === 0 ? 0.85 : 0.3, u.team === 0 ? 0.4 : 0.25); if (f < 0.35) c.setRGB(1, 0.75, 0.15); this.fgBars.setColorAt(n, c); n++;
    }
    this.bgBars.count = this.fgBars.count = n; this.bgBars.instanceMatrix.needsUpdate = this.fgBars.instanceMatrix.needsUpdate = true; if (this.fgBars.instanceColor) this.fgBars.instanceColor.needsUpdate = true;
  }
  clear() { for (const p of this.p) p.on = false; for (let i = 0; i < this.N; i++) this.mesh.setMatrixAt(i, this.zero); this.mesh.instanceMatrix.needsUpdate = true; this.bgBars.count = this.fgBars.count = 0; for (const a of this.arrows) a.m.visible = false; for (const b of this.balls) b.m.visible = false; }
}
