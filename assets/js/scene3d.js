(function () {
  'use strict';
  var T = window.THREE;
  if (!T) return;
  var canvas = document.querySelector('canvas[data-scene="cnc"]');
  if (!canvas) return;
  try {
    var probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('webgl');
  } catch (e) {
    document.documentElement.classList.add('no-webgl');
    return;
  }

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  var renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  function studioEnvironment() {
    var pmrem = new T.PMREMGenerator(renderer);
    var room = new T.Scene();
    room.add(new T.Mesh(new T.BoxGeometry(26, 16, 26), new T.MeshBasicMaterial({ color: 0x1a2230, side: T.BackSide })));
    function softbox(w, h, color, k, x, y, z) {
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(k), side: T.DoubleSide }));
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      room.add(m);
    }
    softbox(14, 3, 0xffffff, 6.5, 0, 8, 1);
    softbox(3, 12, 0xffffff, 4, -11, 1, 5);
    softbox(3, 12, 0xe4ecff, 3, 11, 1, -2);
    softbox(12, 4, 0x8fb8ff, 1.8, 0, -1, -12);
    softbox(9, 6, 0xffffff, 1.6, 3, 2, 12);
    var target = pmrem.fromScene(room, 0.035);
    pmrem.dispose();
    return target.texture;
  }
  var env = studioEnvironment();
  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(30, 1, 0.1, 100);
  scene.add(new T.AmbientLight(0x7890b8, 0.45));
  var sun = new T.DirectionalLight(0xffffff, 1.8);
  sun.position.set(5, 9, 8);
  scene.add(sun);
  var rimBlue = new T.DirectionalLight(0x8fb8ff, 2.2);
  rimBlue.position.set(-7, 4, -5);
  scene.add(rimBlue);
  var rimRed = new T.DirectionalLight(0xff5a82, 0.9);
  rimRed.position.set(7, 2, -6);
  scene.add(rimRed);

  function phys(o) { o.envMap = env; return new T.MeshPhysicalMaterial(o); }
  var M = {
    shell: phys({ color: 0xe8ebee, metalness: 0.05, roughness: 0.34, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
    panel: phys({ color: 0x3a4047, metalness: 0.25, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
    plinth: phys({ color: 0x2b3036, metalness: 0.3, roughness: 0.55 }),
    red: phys({ color: 0xd6204f, metalness: 0.15, roughness: 0.32, clearcoat: 1 }),
    dark: phys({ color: 0x15191e, metalness: 0.35, roughness: 0.5 }),
    black: phys({ color: 0x0b0d10, metalness: 0.4, roughness: 0.38, clearcoat: 0.6 }),
    inner: phys({ color: 0xc9ced4, metalness: 0.6, roughness: 0.4 }),
    steel: phys({ color: 0xbfc6ce, metalness: 1, roughness: 0.3 }),
    chrome: phys({ color: 0xeef2f6, metalness: 1, roughness: 0.1 }),
    key: phys({ color: 0xd9dde2, roughness: 0.45 }),
    green: phys({ color: 0x2fbf71, roughness: 0.35, clearcoat: 1 }),
    yellow: phys({ color: 0xf2c200, roughness: 0.4 }),
    orange: phys({ color: 0xf29a2e, roughness: 0.35, clearcoat: 0.7 }),
    glass: phys({ color: 0xcfe3ff, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.16, clearcoat: 1, depthWrite: false }),
    brand: phys({ color: 0xffffff, metalness: 0.2, roughness: 0.45, clearcoat: 0.5 })
  };

  function box(w, h, d, mat) { return new T.Mesh(new T.BoxGeometry(w, h, d), mat); }
  function cyl(rt, rb, h, seg, mat) { return new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 32), mat); }
  function roundedBox(w, h, d, r, mat) {
    var s = new T.Shape();
    var x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    var b = Math.min(r * 0.6, d * 0.2);
    var g = new T.ExtrudeGeometry(s, { depth: d - b * 2, bevelEnabled: true, bevelThickness: b, bevelSize: b * 0.8, bevelSegments: 3, curveSegments: 6 });
    g.translate(0, 0, -(d - b * 2) / 2);
    g.computeVertexNormals();
    return new T.Mesh(g, mat);
  }
  function canvasTexture(w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }
  function radialTexture(stops, size) {
    return canvasTexture(size || 256, size || 256, function (g, w) {
      var grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      stops.forEach(function (s) { grd.addColorStop(s[0], s[1]); });
      g.fillStyle = grd;
      g.fillRect(0, 0, w, w);
    });
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  var strokes = [];
  (function () {
    var arc = [], cx = -0.4, r = 0.38;
    for (var a = 125; a >= -125; a -= 5) {
      var t = a * Math.PI / 180;
      arc.push([cx + Math.cos(t) * r, Math.sin(t) * r]);
    }
    strokes.push(arc);
    strokes.push([[-0.54, 0], [-0.03, 0]]);
    strokes.push([[0.2, 0.4], [0.2, -0.4]]);
    strokes.push([[0.74, 0.4], [0.25, 0.01]]);
    strokes.push([[0.37, 0.1], [0.76, -0.4]]);
  })();

  var LETTER_SCALE = 0.42;
  var WP = { w: 0.9, h: 0.16, d: 0.58 };
  var SAFE = 0.24, CUT = -0.008;
  var DOOR_TIME = 1.4;
  var program = [];
  var gcode = ['%', 'O0001 (EK)', 'G21 G90 G17', 'T1 M06', 'S12000 M03', 'M08', 'G00 Z' + (SAFE * 100).toFixed(1)];
  (function () {
    var pos = { x: 0, z: 0.35, y: SAFE };
    var fmt = function (v) { return (v * 100).toFixed(2); };
    function move(to, speed, cut, line) {
      var dx = to.x - pos.x, dz = to.z - pos.z, dy = to.y - pos.y;
      var len = Math.sqrt(dx * dx + dz * dz + dy * dy);
      program.push({ from: { x: pos.x, y: pos.y, z: pos.z }, to: { x: to.x, y: to.y, z: to.z }, dur: Math.max(len / speed, 0.05), cut: cut, line: gcode.length });
      gcode.push(line);
      pos = { x: to.x, y: to.y, z: to.z };
    }
    strokes.forEach(function (st) {
      var p0 = { x: st[0][0] * LETTER_SCALE, z: -st[0][1] * LETTER_SCALE };
      move({ x: p0.x, z: p0.z, y: SAFE }, 1.4, false, 'G00 X' + fmt(p0.x) + ' Y' + fmt(-p0.z));
      move({ x: p0.x, z: p0.z, y: CUT }, 0.45, false, 'G01 Z' + fmt(CUT) + ' F200');
      for (var i = 1; i < st.length; i++) {
        var p = { x: st[i][0] * LETTER_SCALE, z: -st[i][1] * LETTER_SCALE, y: CUT };
        move(p, 0.24, true, 'G01 X' + fmt(p.x) + ' Y' + fmt(-p.z) + ' F450');
      }
      move({ x: pos.x, z: pos.z, y: SAFE }, 0.9, false, 'G00 Z' + fmt(SAFE));
    });
    move({ x: 0, z: 0.35, y: SAFE }, 1.4, false, 'G00 X0 Y-35.00');
    gcode.push('M09', 'M05', 'M30', '%');
  })();
  var programDur = program.reduce(function (s, p) { return s + p.dur; }, 0);
  var CYCLE = DOOR_TIME + programDur + DOOR_TIME + 2.4;

  var ENG = { w: 1024, h: Math.round(1024 * WP.d / WP.w) };
  var engCanvas = document.createElement('canvas');
  engCanvas.width = ENG.w;
  engCanvas.height = ENG.h;
  var eg = engCanvas.getContext('2d');
  var baseCanvas = document.createElement('canvas');
  baseCanvas.width = ENG.w;
  baseCanvas.height = ENG.h;
  (function () {
    var g = baseCanvas.getContext('2d');
    var grd = g.createLinearGradient(0, 0, ENG.w, ENG.h);
    grd.addColorStop(0, '#e1e7ee');
    grd.addColorStop(0.5, '#c8d0d9');
    grd.addColorStop(1, '#dce2e9');
    g.fillStyle = grd;
    g.fillRect(0, 0, ENG.w, ENG.h);
    for (var i = 0; i < 2000; i++) {
      g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '255,255,255' : '90,100,112') + ',' + (Math.random() * 0.07).toFixed(3) + ')';
      g.fillRect(0, Math.random() * ENG.h, ENG.w, Math.random() * 1.6 + 0.3);
    }
  })();
  var engTex = new T.CanvasTexture(engCanvas);
  engTex.colorSpace = T.SRGBColorSpace;
  engTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  function resetEngraving() {
    eg.drawImage(baseCanvas, 0, 0);
    engTex.needsUpdate = true;
  }
  function toCanvas(x, z) { return [(x / WP.w + 0.5) * ENG.w, (z / WP.d + 0.5) * ENG.h]; }
  function engrave(a, b) {
    var p = toCanvas(a.x, a.z), q = toCanvas(b.x, b.z);
    eg.lineCap = 'round';
    eg.lineJoin = 'round';
    [['#353d47', 46, 0], ['#7b8793', 22, -4], ['rgba(255,255,255,0.7)', 4, 19]].forEach(function (l) {
      eg.strokeStyle = l[0];
      eg.lineWidth = l[1];
      eg.beginPath();
      eg.moveTo(p[0], p[1] + l[2]);
      eg.lineTo(q[0], q[1] + l[2]);
      eg.stroke();
    });
    engTex.needsUpdate = true;
  }
  resetEngraving();

  var SCR = { w: 1024, h: 640 };
  var scrCanvas = document.createElement('canvas');
  scrCanvas.width = SCR.w;
  scrCanvas.height = SCR.h;
  var sg = scrCanvas.getContext('2d');
  var scrTex = new T.CanvasTexture(scrCanvas);
  scrTex.colorSpace = T.SRGBColorSpace;
  var logoImg = null;

  function drawScreen(state) {
    var g = sg;
    var bg = g.createLinearGradient(0, 0, 0, SCR.h);
    bg.addColorStop(0, '#0b1a33');
    bg.addColorStop(1, '#050b16');
    g.fillStyle = bg;
    g.fillRect(0, 0, SCR.w, SCR.h);
    g.fillStyle = '#10223f';
    g.fillRect(0, 0, SCR.w, 70);
    if (logoImg) g.drawImage(logoImg, 18, 7, 56, 56);
    g.textBaseline = 'middle';
    g.fillStyle = '#ffffff';
    g.font = '700 26px Manrope, sans-serif';
    g.fillText('ЭЛЕКТРОСТАЛЬСКИЙ КОЛЛЕДЖ', 88, 26);
    g.fillStyle = '#8fb8ff';
    g.font = '600 18px Manrope, sans-serif';
    g.fillText('Обрабатывающий центр · программа EK.NC', 88, 52);
    var status = state.phase === 'door' ? 'ДВЕРЬ' : state.done ? 'ГОТОВО' : state.cut ? 'ФРЕЗЕРОВАНИЕ' : 'ПОЗИЦИОНИРОВАНИЕ';
    g.fillStyle = state.phase === 'door' ? '#41628a' : state.done ? '#2fbf71' : state.cut ? '#d6204f' : '#f0a000';
    roundRect(g, SCR.w - 262, 18, 242, 36, 18);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = '800 17px Manrope, sans-serif';
    g.textAlign = 'center';
    g.fillText(status, SCR.w - 141, 37);
    g.textAlign = 'left';

    var px = 24, py = 90, pw = 560, ph = 420;
    g.fillStyle = '#081426';
    roundRect(g, px, py, pw, ph, 16);
    g.fill();
    g.strokeStyle = 'rgba(143,184,255,0.08)';
    g.lineWidth = 1;
    for (var gx = px; gx < px + pw; gx += 28) { g.beginPath(); g.moveTo(gx, py); g.lineTo(gx, py + ph); g.stroke(); }
    for (var gy = py; gy < py + ph; gy += 28) { g.beginPath(); g.moveTo(px, gy); g.lineTo(px + pw, gy); g.stroke(); }
    var k = 250 / LETTER_SCALE;
    var sx = function (x) { return px + pw / 2 + x * k; };
    var sy = function (z) { return py + ph / 2 + z * k; };
    g.strokeStyle = 'rgba(143,184,255,0.35)';
    g.lineWidth = 3;
    g.setLineDash([8, 8]);
    program.forEach(function (s) { if (!s.cut) { g.beginPath(); g.moveTo(sx(s.from.x), sy(s.from.z)); g.lineTo(sx(s.to.x), sy(s.to.z)); g.stroke(); } });
    g.setLineDash([]);
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(200,215,235,0.35)';
    g.lineWidth = 6;
    program.forEach(function (s) { if (s.cut) { g.beginPath(); g.moveTo(sx(s.from.x), sy(s.from.z)); g.lineTo(sx(s.to.x), sy(s.to.z)); g.stroke(); } });
    g.strokeStyle = '#ff3d6e';
    g.lineWidth = 8;
    g.shadowColor = '#d6204f';
    g.shadowBlur = 16;
    for (var i = 0; i < state.seg; i++) {
      var s = program[i];
      if (s.cut) { g.beginPath(); g.moveTo(sx(s.from.x), sy(s.from.z)); g.lineTo(sx(s.to.x), sy(s.to.z)); g.stroke(); }
    }
    var cur = program[state.seg];
    if (cur && cur.cut) { g.beginPath(); g.moveTo(sx(cur.from.x), sy(cur.from.z)); g.lineTo(sx(state.x), sy(state.z)); g.stroke(); }
    g.shadowBlur = 0;
    g.fillStyle = '#7fe3ff';
    g.beginPath();
    g.arc(sx(state.x), sy(state.z), 10, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(127,227,255,0.5)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(sx(state.x), sy(state.z), 20 + Math.sin(state.t * 6) * 4, 0, Math.PI * 2);
    g.stroke();

    var rx = 610;
    [['X', state.x * 100], ['Y', -state.z * 100], ['Z', state.y * 100]].forEach(function (d, n) {
      var y = 96 + n * 74;
      g.fillStyle = '#0d1f3a';
      roundRect(g, rx, y, 390, 62, 12);
      g.fill();
      g.fillStyle = '#8fb8ff';
      g.font = '800 30px Manrope, sans-serif';
      g.fillText(d[0], rx + 20, y + 32);
      g.fillStyle = '#ffffff';
      g.font = '700 34px "Courier New", monospace';
      g.textAlign = 'right';
      g.fillText((d[1] >= 0 ? '+' : '') + d[1].toFixed(3), rx + 370, y + 33);
      g.textAlign = 'left';
    });
    g.fillStyle = '#9fb1cb';
    g.font = '700 20px Manrope, sans-serif';
    g.fillText('S 12000 об/мин', rx + 4, 332);
    g.fillText('F ' + (state.cut ? '450' : 'G00') + ' мм/мин', rx + 214, 332);
    var line = program[state.seg] ? program[state.seg].line : gcode.length - 2;
    g.fillStyle = '#081426';
    roundRect(g, rx, 354, 390, 156, 12);
    g.fill();
    g.font = '600 19px "Courier New", monospace';
    for (var L = -2; L <= 3; L++) {
      var num = line + L;
      if (num < 0 || num >= gcode.length) continue;
      var yy = 380 + (L + 2) * 24;
      if (L === 0) { g.fillStyle = 'rgba(214,32,79,0.35)'; g.fillRect(rx + 6, yy - 13, 378, 24); }
      g.fillStyle = L === 0 ? '#ffffff' : 'rgba(159,177,203,' + (1 - Math.abs(L) * 0.25) + ')';
      g.fillText('N' + String(num * 10).padStart(4, '0') + ' ' + gcode[num], rx + 16, yy);
    }
    g.fillStyle = '#0d1f3a';
    roundRect(g, 24, 532, 976, 26, 13);
    g.fill();
    var pr = clamp(state.progress, 0, 1);
    var pg = g.createLinearGradient(24, 0, 1000, 0);
    pg.addColorStop(0, '#41628a');
    pg.addColorStop(1, '#d6204f');
    g.fillStyle = pg;
    roundRect(g, 24, 532, Math.max(26, 976 * pr), 26, 13);
    g.fill();
    g.fillStyle = '#9fb1cb';
    g.font = '700 20px Manrope, sans-serif';
    g.fillText('Выполнено ' + Math.round(pr * 100) + ' %', 26, 590);
    g.textAlign = 'right';
    g.fillText('Деталь ' + String(state.cycle + 1).padStart(3, '0'), 998, 590);
    g.textAlign = 'left';
    scrTex.needsUpdate = true;
  }

  function paintBrand() {
    M.brand.map = canvasTexture(384, 1024, function (g, w) {
      g.fillStyle = '#3a4047';
      g.fillRect(0, 0, w, 1024);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#d6204f';
      g.font = '800 140px Unbounded, Manrope, sans-serif';
      g.fillText('ЭК', w / 2, 140);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.font = '700 27px Manrope, sans-serif';
      g.fillText('ЭЛЕКТРОСТАЛЬСКИЙ', w / 2, 250);
      g.fillText('КОЛЛЕДЖ', w / 2, 286);
      [['#f2c200', 'ВНИМАНИЕ', 400, 76], ['#f29a2e', 'СОЖ · 380 В', 492, 76], ['#ffffff', 'ЧПУ · 3 ОСИ', 584, 56]].forEach(function (s) {
        g.fillStyle = s[0];
        roundRect(g, 96, s[2], 192, s[3], 8);
        g.fill();
        g.fillStyle = 'rgba(0,0,0,0.78)';
        g.font = '800 21px Manrope, sans-serif';
        g.fillText(s[1], w / 2, s[2] + s[3] / 2 + 1);
      });
    });
    M.brand.needsUpdate = true;
  }

  var rig = new T.Group();
  scene.add(rig);
  var machine = new T.Group();
  rig.add(machine);
  function put(mesh, x, y, z, parent) { mesh.position.set(x, y, z); (parent || machine).add(mesh); return mesh; }

  var FRONT = 1.42, BASE = 0.34, TOP = 3.1;
  var PANEL_H = TOP - BASE - 0.3, PANEL_Y = (TOP + BASE + 0.3) / 2;
  put(box(4.3, BASE, 2.9, M.plinth), 0, BASE / 2, 0);
  put(box(4.34, 0.04, 2.94, M.red), 0, BASE - 0.02, 0);
  put(box(4.4, 0.32, 0.16, M.shell), 0, BASE + 0.16, FRONT + 0.02);
  put(box(0.3, 0.12, 0.01, M.yellow), -0.25, BASE + 0.16, FRONT + 0.105);
  put(box(0.12, TOP - BASE, 2.9, M.shell), -2.14, (TOP + BASE) / 2, 0);
  put(box(0.12, TOP - BASE, 2.9, M.shell), 2.14, (TOP + BASE) / 2, 0);
  put(box(0.02, 1.5, 0.9, M.black), 2.205, 1.95, 0.35);
  put(box(0.02, 1.4, 0.8, M.glass), 2.216, 1.95, 0.35);
  put(box(4.4, 0.14, 1.3, M.shell), 0, TOP + 0.07, 0.8);
  put(box(4.4, 0.14, 0.2, M.shell), 0, TOP + 0.07, -1.35);
  put(box(4.28, TOP - BASE, 0.06, M.inner), 0, (TOP + BASE) / 2, -1.42);

  put(box(0.92, PANEL_H, 0.12, [M.panel, M.panel, M.panel, M.panel, M.brand, M.panel]), -1.66, PANEL_Y, FRONT);
  put(box(0.14, PANEL_H, 0.14, M.red), -1.17, PANEL_Y, FRONT + 0.01);
  put(roundedBox(1.02, PANEL_H, 0.12, 0.03, M.panel), 1.17, PANEL_Y, FRONT);
  put(box(0.14, PANEL_H, 0.14, M.red), 0.67, PANEL_Y, FRONT + 0.01);
  put(box(0.44, PANEL_H, 0.16, M.shell), 1.9, PANEL_Y, FRONT + 0.02);
  put(box(4.4, 0.16, 0.16, M.shell), 0, TOP - 0.08, FRONT + 0.02);
  put(box(0.03, 0.34, 0.05, M.black), 1.72, 1.2, FRONT + 0.1);
  put(box(0.3, 0.2, 0.01, M.yellow), 1.17, 0.95, FRONT + 0.065);

  var interiorLight = new T.PointLight(0xe8f2ff, 6, 4.5, 1.6);
  interiorLight.position.set(-0.25, 2.8, 0.6);
  machine.add(interiorLight);
  put(box(1.5, 0.03, 0.06, new T.MeshBasicMaterial({ color: 0xeaf4ff, toneMapped: false })), -0.25, TOP - 0.2, 0.9);
  put(box(1.78, 0.08, 2.6, M.dark), -0.25, BASE + 0.36, 0);
  [-1, 1].forEach(function (s) {
    var chute = put(box(0.08, 0.34, 2.6, M.inner), -0.25 + s * 0.86, BASE + 0.52, 0);
    chute.rotation.z = s * 0.35;
  });

  put(roundedBox(1.0, 3.6, 0.9, 0.06, M.panel), -0.25, BASE + 1.9, -0.9);
  put(box(0.08, 2.9, 0.06, M.chrome), -0.55, BASE + 1.9, -0.42);
  put(box(0.08, 2.9, 0.06, M.chrome), 0.05, BASE + 1.9, -0.42);
  put(box(1.02, 0.05, 0.92, M.red), -0.25, BASE + 3.72, -0.9);

  var magazine = new T.Group();
  magazine.position.set(-1.42, TOP + 0.5, -0.5);
  magazine.rotation.z = Math.PI / 2;
  machine.add(magazine);
  magazine.add(cyl(0.62, 0.62, 0.5, 64, M.black));
  var drumCap = cyl(0.45, 0.45, 0.06, 48, M.panel);
  drumCap.position.y = 0.28;
  magazine.add(drumCap);
  var drumRing = cyl(0.63, 0.63, 0.04, 64, M.red);
  drumRing.position.y = -0.2;
  magazine.add(drumRing);
  var pockets = new T.Group();
  magazine.add(pockets);
  for (var pk = 0; pk < 16; pk++) {
    var ang = (pk / 16) * Math.PI * 2;
    [0.255, -0.255].forEach(function (y) {
      var stud = cyl(0.035, 0.035, 0.02, 12, M.steel);
      stud.position.set(Math.cos(ang) * 0.54, y, Math.sin(ang) * 0.54);
      pockets.add(stud);
    });
    var slot = box(0.05, 0.42, 0.012, M.dark);
    slot.position.set(Math.cos(ang) * 0.622, 0, Math.sin(ang) * 0.622);
    slot.rotation.y = -ang;
    pockets.add(slot);
  }
  put(box(0.5, 0.12, 0.12, M.panel), -1.0, TOP + 0.2, -0.62);

  var head = new T.Group();
  machine.add(head);
  put(roundedBox(0.72, 1.1, 0.95, 0.05, M.panel), -0.25, 0, -0.05, head);
  put(box(0.74, 0.06, 0.97, M.red), -0.25, -0.3, -0.05, head);
  put(cyl(0.24, 0.24, 0.62, 40, M.black), -0.25, 0.86, -0.1, head);
  for (var f = 0; f < 7; f++) {
    var fin = new T.Mesh(new T.TorusGeometry(0.245, 0.012, 8, 40), M.steel);
    fin.rotation.x = Math.PI / 2;
    put(fin, -0.25, 0.66 + f * 0.07, -0.1, head);
  }
  put(cyl(0.18, 0.24, 0.1, 40, M.panel), -0.25, 1.2, -0.1, head);
  put(new T.Mesh(new T.LatheGeometry([[0.26, 0], [0.25, -0.08], [0.18, -0.16], [0.15, -0.22]].map(function (p) { return new T.Vector2(p[0], p[1]); }), 48), M.chrome), -0.25, -0.55, 0.1, head);
  var spindleLed = new T.Mesh(new T.TorusGeometry(0.2, 0.014, 8, 48), new T.MeshBasicMaterial({ color: 0xbfe6ff, toneMapped: false }));
  spindleLed.rotation.x = Math.PI / 2;
  put(spindleLed, -0.25, -0.6, 0.1, head);
  var rotor = new T.Group();
  rotor.position.set(-0.25, -0.78, 0.1);
  head.add(rotor);
  rotor.add(new T.Mesh(new T.LatheGeometry([[0.13, 0], [0.13, -0.05], [0.09, -0.08], [0.06, -0.2], [0.045, -0.26]].map(function (p) { return new T.Vector2(p[0], p[1]); }), 32), M.steel));
  var flute = canvasTexture(64, 256, function (g) {
    g.fillStyle = '#d7dde4';
    g.fillRect(0, 0, 64, 256);
    g.strokeStyle = '#59636f';
    g.lineWidth = 10;
    for (var i = -8; i < 12; i++) { g.beginPath(); g.moveTo(0, i * 32); g.lineTo(64, i * 32 + 64); g.stroke(); }
  });
  var cutter = cyl(0.028, 0.028, 0.3, 16, phys({ color: 0xffffff, map: flute, metalness: 1, roughness: 0.25 }));
  cutter.position.y = -0.4;
  rotor.add(cutter);
  var TIP_LOCAL = new T.Vector3(0, -0.55, 0);
  [-1, 1].forEach(function (s) {
    var curve = new T.CatmullRomCurve3([
      new T.Vector3(-0.25 + s * 0.3, -0.52, 0.3),
      new T.Vector3(-0.25 + s * 0.26, -0.72, 0.36),
      new T.Vector3(-0.25 + s * 0.12, -0.98, 0.24)
    ]);
    head.add(new T.Mesh(new T.TubeGeometry(curve, 20, 0.022, 8, false), M.orange));
  });

  var saddle = new T.Group();
  machine.add(saddle);
  put(box(1.3, 0.14, 1.1, M.panel), -0.25, BASE + 0.5, 0, saddle);
  var table = new T.Group();
  saddle.add(table);
  var TABLE_Y = BASE + 0.64;
  put(box(1.7, 0.12, 0.72, M.steel), -0.25, TABLE_Y, 0, table);
  for (var sl = 0; sl < 4; sl++) put(box(1.71, 0.03, 0.05, M.dark), -0.25, TABLE_Y + 0.05, -0.25 + sl * 0.17, table);
  put(box(1.0, 0.14, 0.2, M.panel), -0.25, TABLE_Y + 0.13, -0.4, table);
  put(box(1.0, 0.14, 0.2, M.panel), -0.25, TABLE_Y + 0.13, 0.4, table);
  put(box(0.12, 0.1, 0.1, M.red), 0.3, TABLE_Y + 0.12, 0.4, table);
  var WP_TOP = TABLE_Y + 0.06 + WP.h;
  put(new T.Mesh(new T.BoxGeometry(WP.w, WP.h, WP.d), [M.steel, M.steel, phys({ map: engTex, bumpMap: engTex, bumpScale: 2.5, metalness: 0.85, roughness: 0.34 }), M.steel, M.steel, M.steel]), -0.25, TABLE_Y + 0.06 + WP.h / 2, 0, table);
  var coversL = put(box(1, 0.1, 0.74, M.inner), 0, TABLE_Y - 0.02, 0);
  var coversR = put(box(1, 0.1, 0.74, M.inner), 0, TABLE_Y - 0.02, 0);

  function door(handleX, z) {
    var d = new T.Group();
    d.add(box(0.94, 0.12, 0.05, M.panel).translateY(1.12));
    d.add(box(0.94, 0.12, 0.05, M.panel).translateY(-1.12));
    d.add(box(0.12, 2.36, 0.05, M.panel).translateX(-0.41));
    d.add(box(0.12, 2.36, 0.05, M.panel).translateX(0.41));
    d.add(box(0.72, 2.14, 0.012, M.glass));
    d.add(box(0.05, 0.6, 0.06, M.black).translateX(handleX).translateZ(0.05));
    d.position.set(0, BASE + 1.52, z);
    machine.add(d);
    return d;
  }
  var doorL = door(0.35, FRONT + 0.14);
  var doorR = door(-0.35, FRONT + 0.2);
  var DOOR = { lOpen: -1.6, lClosed: -0.7, rOpen: 1.1, rClosed: 0.2 };

  var pendant = new T.Group();
  pendant.position.set(1.35, 2.02, FRONT + 0.34);
  machine.add(pendant);
  pendant.add(roundedBox(0.86, 1.22, 0.12, 0.04, M.dark));
  put(box(0.1, 0.1, 0.2, M.dark), -0.3, 0.4, -0.14, pendant);
  put(box(0.1, 0.1, 0.2, M.dark), -0.3, -0.4, -0.14, pendant);
  var screen = new T.Mesh(new T.PlaneGeometry(0.7, 0.4375), new T.MeshBasicMaterial({ map: scrTex, toneMapped: false }));
  put(screen, 0, 0.3, 0.064, pendant);
  put(new T.Mesh(new T.PlaneGeometry(0.7, 0.4375), M.glass), 0, 0.3, 0.066, pendant);
  for (var kr = 0; kr < 5; kr++) {
    for (var kc = 0; kc < 8; kc++) {
      put(box(0.07, 0.05, 0.02, kr === 0 && kc > 5 ? M.orange : M.key), -0.3 + kc * 0.085, -0.01 - kr * 0.07, 0.07, pendant);
    }
  }
  function button(mat, r, x, z) {
    var b = cyl(r, r * 1.1, 0.05, 32, mat);
    b.rotation.x = Math.PI / 2;
    return put(b, x, -0.46, z, pendant);
  }
  button(M.yellow, 0.08, -0.28, 0.065);
  button(M.red, 0.06, -0.28, 0.1);
  button(M.green, 0.035, 0.02, 0.08);
  button(M.red, 0.035, 0.14, 0.08);
  button(M.black, 0.05, 0.28, 0.08);

  var tower = new T.Group();
  tower.position.set(1.85, TOP + 0.14, 1.1);
  machine.add(tower);
  put(cyl(0.025, 0.025, 0.36, 12, M.shell), 0, 0.18, 0, tower);
  var lamps = [];
  [[0xd6204f, 0.42], [0xf0a000, 0.55], [0x2fbf71, 0.68]].forEach(function (d) {
    var mat = new T.MeshStandardMaterial({ color: d[0], emissive: d[0], emissiveIntensity: 0.15, roughness: 0.3, transparent: true, opacity: 0.92 });
    put(cyl(0.075, 0.075, 0.12, 24, mat), 0, d[1], 0, tower);
    lamps.push(mat);
  });
  put(cyl(0.08, 0.08, 0.04, 24, M.shell), 0, 0.76, 0, tower);

  var floorGlow = new T.Mesh(new T.PlaneGeometry(10, 10), new T.MeshBasicMaterial({ map: radialTexture([[0, 'rgba(90,140,220,0.4)'], [0.35, 'rgba(65,98,138,0.15)'], [1, 'rgba(65,98,138,0)']], 512), transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false }));
  floorGlow.rotation.x = -Math.PI / 2;
  put(floorGlow, 0, -0.02, 0);
  var shadow = new T.Mesh(new T.PlaneGeometry(6.2, 4.6), new T.MeshBasicMaterial({ map: radialTexture([[0, 'rgba(0,0,0,0.75)'], [0.6, 'rgba(0,0,0,0.3)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  put(shadow, 0, -0.01, 0);

  var CHIPS = 360;
  var chipGeo = new T.BufferGeometry();
  var chipPos = new Float32Array(CHIPS * 3), chipCol = new Float32Array(CHIPS * 3);
  var chips = [];
  for (var c = 0; c < CHIPS; c++) { chips.push({ alive: false, age: 0, life: 0, vx: 0, vy: 0, vz: 0, hot: false }); chipPos[c * 3 + 1] = -99; }
  chipGeo.setAttribute('position', new T.BufferAttribute(chipPos, 3).setUsage(T.DynamicDrawUsage));
  chipGeo.setAttribute('color', new T.BufferAttribute(chipCol, 3).setUsage(T.DynamicDrawUsage));
  var chipPoints = new T.Points(chipGeo, new T.PointsMaterial({ size: 0.035, vertexColors: true, map: radialTexture([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']], 64), transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
  chipPoints.frustumCulled = false;
  scene.add(chipPoints);
  var hotSpot = new T.Sprite(new T.SpriteMaterial({ map: radialTexture([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,190,120,0.7)'], [1, 'rgba(255,90,60,0)']]), transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false }));
  hotSpot.scale.setScalar(0.22);
  scene.add(hotSpot);
  var chipCursor = 0;
  function emitChip(p) {
    var ch = chips[chipCursor], i = chipCursor;
    chipCursor = (chipCursor + 1) % CHIPS;
    var a = Math.random() * Math.PI * 2, sp = 0.8 + Math.random() * 1.6;
    ch.alive = true;
    ch.age = 0;
    ch.life = 0.5 + Math.random() * 0.8;
    ch.hot = Math.random() < 0.45;
    ch.vx = Math.cos(a) * sp;
    ch.vz = Math.sin(a) * sp;
    ch.vy = 0.8 + Math.random() * 1.6;
    chipPos[i * 3] = p.x;
    chipPos[i * 3 + 1] = p.y + 0.01;
    chipPos[i * 3 + 2] = p.z;
  }
  function updateChips(dt, floorY) {
    for (var i = 0; i < CHIPS; i++) {
      var ch = chips[i];
      if (!ch.alive) continue;
      ch.age += dt;
      if (ch.age > ch.life) { ch.alive = false; chipPos[i * 3 + 1] = -99; continue; }
      ch.vy -= 7 * dt;
      var i3 = i * 3;
      chipPos[i3] += ch.vx * dt;
      chipPos[i3 + 1] += ch.vy * dt;
      chipPos[i3 + 2] += ch.vz * dt;
      if (chipPos[i3 + 1] < floorY) { chipPos[i3 + 1] = floorY; ch.vy *= -0.3; ch.vx *= 0.6; ch.vz *= 0.6; }
      var k = 1 - ch.age / ch.life;
      if (ch.hot) { chipCol[i3] = k + 0.2; chipCol[i3 + 1] = 0.55 * k; chipCol[i3 + 2] = 0.2 * k; }
      else { chipCol[i3] = 0.85 * k; chipCol[i3 + 1] = 0.9 * k; chipCol[i3 + 2] = k; }
    }
    chipGeo.attributes.position.needsUpdate = true;
    chipGeo.attributes.color.needsUpdate = true;
  }

  var hero = canvas.closest('.hero');
  var visual = hero && hero.querySelector('.hero__visual');
  function fit() {
    var w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    var fx = 0.5, fy = 0.5, vw = w, vh = h;
    if (visual) {
      var cr = canvas.getBoundingClientRect(), vr = visual.getBoundingClientRect();
      vw = Math.max(vr.width, 1);
      vh = Math.max(vr.height, 1);
      fx = (vr.left + vw / 2 - cr.left) / w;
      fy = (vr.top + vh / 2 - cr.top) / h;
    }
    var dist = clamp(Math.max(8.2 * h / vh, 9.6 * h / vw), 8.5, 48);
    camera.position.set(0, 1.9 + dist * 0.22, dist);
    camera.lookAt(0, 1.9, 0);
    camera.setViewOffset(w, h, -(fx - 0.5) * w, -(fy - 0.5) * h, w, h);
  }
  if ('ResizeObserver' in window) {
    new ResizeObserver(fit).observe(canvas);
    if (visual) new ResizeObserver(fit).observe(visual);
  } else {
    window.addEventListener('resize', fit);
  }
  fit();

  var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  var spin = { v: 0, drag: false, x: 0, off: 0 };
  window.addEventListener('pointermove', function (e) {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    if (spin.drag) { spin.v = (e.clientX - spin.x) * 0.005; spin.x = e.clientX; spin.off += spin.v; }
  }, { passive: true });
  canvas.addEventListener('pointerdown', function (e) { spin.drag = true; spin.x = e.clientX; });
  window.addEventListener('pointerup', function () { spin.drag = false; });

  var visible = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(canvas);

  function programState(t) {
    var acc = 0;
    for (var i = 0; i < program.length; i++) {
      var s = program[i];
      if (t <= acc + s.dur) {
        var k = (t - acc) / s.dur;
        return { seg: i, x: lerp(s.from.x, s.to.x, k), y: lerp(s.from.y, s.to.y, k), z: lerp(s.from.z, s.to.z, k), cut: s.cut, done: false, progress: (acc + s.dur * k) / programDur };
      }
      acc += s.dur;
    }
    var last = program[program.length - 1];
    return { seg: program.length, x: last.to.x, y: last.to.y, z: last.to.z, cut: false, done: true, progress: 1 };
  }

  var clock = new T.Clock(), time = 0, cycleT = 0, cycles = 0, lastTip = null, screenAcc = 1, magAngle = 0, magTarget = 0;
  var tip = new T.Vector3(), floorPoint = new T.Vector3();
  var TOOL_Z = 0.1, HEAD_TIP = -0.78 - 0.55;
  var WALL_L = -1.12, WALL_R = 0.62;

  function frame() {
    requestAnimationFrame(frame);
    var dt = Math.min(clock.getDelta(), 0.05);
    if (!visible || document.hidden || document.documentElement.classList.contains('a11y')) return;
    time += dt;
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    if (!spin.drag) { spin.v *= 0.94; spin.off += spin.v; }

    if (!reduceMotion) cycleT += dt;
    if (cycleT > CYCLE) { cycleT = 0; cycles++; resetEngraving(); lastTip = null; magTarget += Math.PI * 2 / 16; }
    var progT = cycleT - DOOR_TIME;
    var st = programState(clamp(progT, 0, programDur));
    var opening = smooth((progT - programDur) / DOOR_TIME);
    var doorClosed = progT < programDur ? smooth(cycleT / DOOR_TIME) : 1 - opening;
    st.t = time;
    st.cycle = cycles;
    st.phase = progT < 0 || (progT > programDur && opening < 1) ? 'door' : 'run';
    if (progT < 0) { st.done = false; st.cut = false; }

    doorL.position.x = lerp(DOOR.lOpen, DOOR.lClosed, doorClosed);
    doorR.position.x = lerp(DOOR.rOpen, DOOR.rClosed, doorClosed);

    table.position.x = -st.x;
    saddle.position.z = TOOL_Z - st.z;
    head.position.y = WP_TOP + st.y - HEAD_TIP;
    var tableLeft = -1.1 - st.x, tableRight = 0.6 - st.x;
    coversL.scale.x = Math.max(tableLeft - WALL_L, 0.01);
    coversL.position.set((WALL_L + tableLeft) / 2, TABLE_Y - 0.02, saddle.position.z);
    coversR.scale.x = Math.max(WALL_R - tableRight, 0.01);
    coversR.position.set((WALL_R + tableRight) / 2, TABLE_Y - 0.02, saddle.position.z);
    rotor.rotation.y += dt * (st.done || progT < 0 ? 3 : 60);
    magAngle += (magTarget - magAngle) * 0.04;
    pockets.rotation.y = magAngle;

    var cutting = st.cut && !st.done && progT >= 0;
    if (cutting) {
      var p = { x: st.x, z: st.z };
      if (lastTip) engrave(lastTip, p);
      lastTip = p;
    } else {
      lastTip = null;
    }
    scene.updateMatrixWorld();
    tip.copy(TIP_LOCAL);
    rotor.localToWorld(tip);
    if (cutting && !reduceMotion) {
      var n = Math.floor(dt * 150 + Math.random());
      for (var e = 0; e < n; e++) emitChip(tip);
    }
    floorPoint.set(0, TABLE_Y + 0.06, 0);
    machine.localToWorld(floorPoint);
    updateChips(dt, floorPoint.y);
    hotSpot.position.copy(tip);
    hotSpot.material.opacity = cutting ? 0.8 + Math.sin(time * 50) * 0.15 : 0;
    interiorLight.intensity = cutting ? 6.5 + Math.sin(time * 40) * 0.8 : 5.5;
    spindleLed.material.color.setHex(cutting ? 0xffffff : 0xbfe6ff);

    lamps[1].emissiveIntensity = st.phase === 'door' || st.done ? 1.6 + Math.sin(time * 8) * 0.8 : 0.15;
    lamps[2].emissiveIntensity = st.phase === 'run' && !st.done ? 1.8 : 0.15;

    screenAcc += dt;
    if (screenAcc > 0.08) { screenAcc = 0; drawScreen(st); }

    var scrollK = clamp(window.scrollY / Math.max(window.innerHeight, 1), 0, 1.2);
    rig.rotation.y = -0.42 + pointer.x * 0.16 + Math.sin(time * 0.25) * 0.05 + spin.off + scrollK * 0.35;
    rig.rotation.x = pointer.y * 0.035;
    rig.position.y = Math.sin(time * 0.8) * 0.025;

    renderer.render(scene, camera);
  }

  var started = false;
  function start() {
    if (started) return;
    started = true;
    var go = function () {
      paintBrand();
      drawScreen(Object.assign(programState(0), { t: 0, cycle: 0, phase: 'door' }));
      requestAnimationFrame(frame);
      canvas.classList.add('is-ready');
    };
    if (document.fonts && document.fonts.load) {
      Promise.race([Promise.all([document.fonts.load('700 26px Manrope'), document.fonts.load('800 140px Unbounded')]), new Promise(function (r) { setTimeout(r, 1200); })]).then(go, go);
    } else {
      go();
    }
  }
  var img = new Image();
  img.onload = function () {
    logoImg = img;
    try { sg.drawImage(img, 0, 0, 1, 1); sg.getImageData(0, 0, 1, 1); } catch (e) { logoImg = null; }
    start();
  };
  img.onerror = start;
  img.src = canvas.getAttribute('data-logo');
})();
