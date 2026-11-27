/* world.js — escenario 3D: cielo, terreno, camino, montañas, árboles, nubes y los dos castillos. Todo se genera por código (sin imágenes). */
import * as THREE from 'three';
import { TOWER } from './combat.js';

function rng(seed) { let a = seed; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function skyTexture(top, bot) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function groundTexture(cols, road) {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), R = rng(7);
  g.fillStyle = cols[0]; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) { g.fillStyle = cols[1 + (R() < .5 ? 0 : 1)]; g.globalAlpha = .25 + R() * .35; const s = 3 + R() * 12; g.fillRect(R() * S, R() * S, s, s * (.4 + R())); }
  g.globalAlpha = 1; const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2; return t;
}
function roadTexture(col) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'), R = rng(3); g.fillStyle = col; g.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 500; i++) { g.fillStyle = R() < .5 ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.1)'; g.fillRect(R() * 256, R() * 64, 2 + R() * 6, 1 + R() * 3); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(30, 1); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildWorld(scene, map, army, quality) {
  const R = rng(42), W = { castles: [], clouds: [], flags: [] }, L = map.length, root = new THREE.Group(); scene.add(root); W.root = root;
  scene.background = skyTexture(map.skyTop, map.skyBot); scene.fog = new THREE.Fog(map.fog, 90, quality === 'low' ? 140 : 190);
  // luces
  const hemi = new THREE.HemisphereLight(0xdfeeff, 0x6a5a40, 1.05); root.add(hemi);
  const sun = new THREE.DirectionalLight(map.sun, map.sunI); sun.position.set(-20, 40, 28); sun.target.position.set(0, 0, 0); root.add(sun, sun.target); W.sun = sun; W.hemi = hemi;
  sun.shadow.camera.left = -34; sun.shadow.camera.right = 34; sun.shadow.camera.top = 18; sun.shadow.camera.bottom = -14; sun.shadow.camera.near = 5; sun.shadow.camera.far = 120; sun.shadow.bias = -0.0006;
  // terreno
  const gt = groundTexture(map.ground, map.road); gt.repeat.set(L / 10, 14);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(L + 140, 140), new THREE.MeshStandardMaterial({ map: gt, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.z = -25; ground.receiveShadow = true; root.add(ground);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(L, map.zHalf * 2 + 3.2), new THREE.MeshStandardMaterial({ map: roadTexture(map.road), roughness: 1 })); road.rotation.x = -Math.PI / 2; road.position.y = 0.015; road.receiveShadow = true; root.add(road);
  // montañas
  const mm = new THREE.MeshStandardMaterial({ color: map.mount, roughness: 1, flatShading: true }), mg = new THREE.ConeGeometry(1, 1, 6, 1);
  for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(mg, mm), h = 16 + R() * 22, w = 18 + R() * 20; m.scale.set(w, h, w * .8); m.position.set(-L * .8 + i * (L * 1.6 / 15) + (R() - .5) * 10, h / 2 - 1, -70 - R() * 25); m.rotation.y = R() * 3; root.add(m); }
  const snow = new THREE.MeshStandardMaterial({ color: 0xf2f6fb, roughness: 1, flatShading: true });
  if (map.id !== 'cenizas') for (let i = 0; i < 16; i++) { const h = 8 + R() * 8, m = new THREE.Mesh(mg, snow), w = 7 + R() * 6; m.scale.set(w, h * .45, w * .8); m.position.set(-L * .8 + i * (L * 1.6 / 15), 0, -70); m.visible = false; }
  // árboles instanciados (tronco + copa)
  const n = quality === 'low' ? Math.floor(map.trees * .6) : map.trees;
  const tr = new THREE.InstancedMesh(new THREE.CylinderGeometry(.18, .26, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 1 }), n);
  const cr = new THREE.InstancedMesh(new THREE.ConeGeometry(1.3, 3.4, 7), new THREE.MeshStandardMaterial({ color: map.tree, roughness: 1, flatShading: true }), n); const d = new THREE.Object3D();
  for (let i = 0; i < n; i++) { const x = (R() - .5) * (L + 30), z = -(6.5 + R() * 34), s = .7 + R() * .9; d.position.set(x, .8 * s, z); d.scale.set(s, s, s); d.rotation.set(0, R() * 3, 0); d.updateMatrix(); tr.setMatrixAt(i, d.matrix); d.position.y = 3 * s; d.updateMatrix(); cr.setMatrixAt(i, d.matrix); }
  tr.castShadow = cr.castShadow = quality !== 'low'; root.add(tr, cr);
  // rocas y piedras del camino
  const rm = new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 1, flatShading: true }), rg = new THREE.DodecahedronGeometry(.5, 0), nr = 40, rocks = new THREE.InstancedMesh(rg, rm, nr);
  for (let i = 0; i < nr; i++) { const s = .3 + R() * .9; d.position.set((R() - .5) * L * .9, s * .3, (R() < .5 ? -1 : 1) * (map.zHalf + 1.6 + R() * 1.5) * (R() < .5 ? 1 : 2.5) + (R() < .5 ? 0 : -3)); if (d.position.z > 6) d.position.z = -d.position.z; d.scale.set(s, s * .7, s); d.rotation.set(R() * 3, R() * 3, R() * 3); d.updateMatrix(); rocks.setMatrixAt(i, d.matrix); }
  root.add(rocks);
  // nubes
  const cmat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .75, fog: false, depthWrite: false }), cg = new THREE.SphereGeometry(1, 8, 6);
  for (let i = 0; i < 9; i++) { const g = new THREE.Group(); for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(cg, cmat); m.scale.set(3 + R() * 2.5, 1.2 + R(), 2); m.position.set(k * 3.2 - 5, R() * .8, 0); g.add(m); } g.position.set((R() - .5) * L * 1.3, 26 + R() * 14, -60 - R() * 20); g.userData.v = .4 + R() * .6; root.add(g); W.clouds.push(g); }
  // castillos
  for (const team of [0, 1]) W.castles.push(buildCastle(root, team, (team === 0 ? -1 : 1) * (L / 2 - 8), army[team], map.id));
  W.towers = []; for (const team of [0, 1]) W.towers.push(buildTower(root, team, (team === 0 ? -1 : 1) * (L / 2 - 8) + (team === 0 ? 1 : -1) * TOWER.dist, army[team], map.id));
  W.update = (dt, camX) => {
    for (const c of W.clouds) { c.position.x += c.userData.v * dt; if (c.position.x > L * .8) c.position.x = -L * .8; }
    sun.position.set(camX - 20, 40, 28); sun.target.position.set(camX, 0, 0); sun.target.updateMatrixWorld();
    const t = performance.now() / 1000; for (const f of W.flags) f.rotation.y = f.userData.dir * (.12 * Math.sin(t * 2 + f.userData.ph));
  };
  W.setShadows = (size) => { sun.castShadow = size > 0; if (size > 0 && sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } } ground.receiveShadow = size > 0; road.receiveShadow = size > 0; };
  wireFlags(W);
  W.dispose = () => { root.traverse(o => { if (o.geometry) o.geometry.dispose(); const m = o.material; if (m) for (const mm of Array.isArray(m) ? m : [m]) { if (mm.map) mm.map.dispose(); mm.dispose(); } }); scene.remove(root); if (scene.background && scene.background.dispose) scene.background.dispose(); };
  return W;
}

function buildCastle(scene, team, x, army, mapId) {
  const g = new THREE.Group(); g.position.x = x; const dir = team === 0 ? 1 : -1;
  const stone = new THREE.MeshStandardMaterial({ color: mapId === 'cenizas' ? 0x5c5258 : 0xb4b0a6, roughness: .95, flatShading: true }), dark = new THREE.MeshStandardMaterial({ color: 0x3a342f, roughness: 1 });
  const roof = new THREE.MeshStandardMaterial({ color: army.color, roughness: .6 }), gold = new THREE.MeshStandardMaterial({ color: army.accent, roughness: .4, metalness: .5 }), wood = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 1 });
  const add = (geo, mat, px, py, pz, rx = 0, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.rotation.set(rx, ry, 0); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  add(new THREE.BoxGeometry(7.2, 5.2, 5.6), stone, 0, 2.6, 0);                       // fortaleza
  add(new THREE.BoxGeometry(7.8, .5, 6.2), stone, 0, 5.4, 0);                         // cornisa
  for (let i = 0; i < 6; i++) for (const zz of [-2.9, 2.9]) add(new THREE.BoxGeometry(.8, .7, .6), stone, -3.3 + i * 1.32, 5.95, zz);   // almenas
  add(new THREE.BoxGeometry(.3, 3.4, 2.6), dark, dir * 3.62, 1.7, 0);                // portón
  add(new THREE.BoxGeometry(.4, .3, 2.8), wood, dir * 3.75, 3.5, 0);                 // viga
  for (const [tx, tz] of [[-3.1, -3.2], [-3.1, 3.2], [3.1, -3.2], [3.1, 3.2]]) {      // torres
    add(new THREE.CylinderGeometry(1.15, 1.3, 7.4, 10), stone, tx, 3.7, tz); add(new THREE.CylinderGeometry(1.5, 1.2, .5, 10), stone, tx, 7.6, tz);
    add(new THREE.ConeGeometry(1.55, 2.4, 10), roof, tx, 9.05, tz); add(new THREE.SphereGeometry(.16, 6, 5), gold, tx, 10.35, tz);
    add(new THREE.BoxGeometry(.25, .8, .1), dark, tx + dir * 1.15, 5.2, tz * .98);
  }
  add(new THREE.ConeGeometry(3.5, 3.6, 4), roof, 0, 7.5, 0, 0, Math.PI / 4);           // techo central
  add(new THREE.CylinderGeometry(.06, .06, 4.2, 5), wood, 0, 11.3, 0);                 // asta
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.3), new THREE.MeshBasicMaterial({ color: army.color, side: THREE.DoubleSide })); flag.geometry.translate(dir * 1.1, 0, 0); flag.position.set(0, 12.8, 0); flag.userData = { dir, ph: team * 2 }; g.add(flag);
  const emb = new THREE.Mesh(new THREE.CircleGeometry(.4, 12), new THREE.MeshBasicMaterial({ color: army.accent, side: THREE.DoubleSide })); emb.position.set(dir * 1.1, 12.8, .01); flag.add(emb);
  // estandartes junto al portón
  const bn = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.4), new THREE.MeshBasicMaterial({ color: army.color, side: THREE.DoubleSide })); bn.position.set(dir * 3.65, 4.2, 1.9); bn.rotation.y = dir * Math.PI / 2; g.add(bn);
  const bn2 = bn.clone(); bn2.position.z = -1.9; g.add(bn2);
  scene.add(g); g.userData.flag = flag; g.userData.baseScale = 1; g.userData.fall = 0; return g;
}

/** Torre con corona: fuste de piedra, balcón almenado, franja con el color del ejército y una corona dorada con gemas arriba. */
function buildTower(scene, team, x, army, mapId) {
  const g = new THREE.Group(); g.position.x = x; const dir = team === 0 ? 1 : -1;
  const stone = new THREE.MeshStandardMaterial({ color: mapId === 'cenizas' ? 0x62585e : 0xc0bcb0, roughness: .95, flatShading: true }), dark = new THREE.MeshStandardMaterial({ color: 0x2c2723, roughness: 1 });
  const band = new THREE.MeshStandardMaterial({ color: army.color, roughness: .6 }), gold = new THREE.MeshStandardMaterial({ color: 0xf0c850, roughness: .3, metalness: .7, emissive: 0x4a3200 });
  const gem = new THREE.MeshStandardMaterial({ color: army.color, roughness: .2, metalness: .3, emissive: army.color, emissiveIntensity: .45 });
  const add = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  add(new THREE.CylinderGeometry(2.2, 2.5, 1.1, 12), stone, 0, .55, 0);                     // zócalo
  add(new THREE.CylinderGeometry(1.55, 1.9, 6.2, 12), stone, 0, 4.2, 0);                    // fuste
  add(new THREE.CylinderGeometry(1.62, 1.62, .55, 12), band, 0, 3.0, 0);                    // franja del equipo
  add(new THREE.CylinderGeometry(2.3, 1.7, .7, 12), stone, 0, 7.65, 0);                     // balcón
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(new THREE.BoxGeometry(.7, .65, .5), stone, Math.cos(a) * 2.15, 8.3, Math.sin(a) * 2.15).rotation.y = -a; }   // almenas
  for (const yy of [4.6, 6.2]) add(new THREE.BoxGeometry(.2, .9, .35), dark, dir * 1.62, yy, 0);                                       // saeteras hacia el campo
  add(new THREE.CylinderGeometry(1.2, 1.35, .5, 12), stone, 0, 8.3, 0);                      // suelo del mirador
  // corona dorada
  add(new THREE.CylinderGeometry(1.25, 1.1, .6, 12, 1, true), gold, 0, 9.1, 0).material.side = THREE.DoubleSide;
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, h = i % 2 ? 1.0 : 1.5; add(new THREE.ConeGeometry(.24, h, 5), gold, Math.cos(a) * 1.15, 9.4 + h / 2, Math.sin(a) * 1.15); if (i % 2 === 0) add(new THREE.SphereGeometry(.17, 8, 6), gem, Math.cos(a) * 1.15, 9.4 + h + .1, Math.sin(a) * 1.15); }
  add(new THREE.SphereGeometry(.42, 10, 8), gem, 0, 9.5, 0);                                  // gema central
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .9), new THREE.MeshBasicMaterial({ color: army.color, side: THREE.DoubleSide })); flag.geometry.translate(dir * .75, 0, 0); flag.position.set(0, 11.6, 0); flag.userData = { dir, ph: team * 2 + 1 }; g.add(flag);
  add(new THREE.CylinderGeometry(.05, .05, 2.4, 5), gold, 0, 10.6, 0);
  scene.add(g); g.userData.flag = flag; g.userData.fall = 0; g.userData.sink = 8.5; return g;
}
export function wireFlags(W) { for (const c of W.castles.concat(W.towers || [])) W.flags.push(c.userData.flag); }
