// Optional 3D shrine layer: pinned three.js r128 glTF + bloom / vignette /
// colour grading.  If WebGL, the library or any model fails, the 2D parallax
// renderer takes over without interrupting gameplay.

import { W, H, C } from './draw.js';

export class ThreeScene {
  constructor(canvas, loader, { onLog = null } = {}) {
    this.canvas = canvas;
    this.loader = loader;
    this.onLog = onLog;
    this.active = false;
    this.time = 0;
    this.focus = 0;
    this.lookahead = 0;
    this.models = [];
    this.points = null;
    this.composer = null;
    this.bloom = null;
  }

  log(id, status, detail = '') { this.onLog?.(id, status, detail); }

  async init() {
    const T = window.THREE;
    if (!T) { this.log('library-three', 'fallback', 'THREE missing; 2D parallax'); return false; }
    try {
      this.renderer = new T.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(W, H, false);
      this.renderer.setClearColor(0x09070e, 1);
      if (T.sRGBEncoding) this.renderer.outputEncoding = T.sRGBEncoding;
      if (T.ACESFilmicToneMapping) { this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.08; }

      this.scene = new T.Scene();
      this.scene.background = new T.Color(0x09070e);
      this.scene.fog = new T.FogExp2(0x09070e, 0.058);
      this.camera = new T.PerspectiveCamera(48, W / H, 0.1, 100);
      this.camera.position.set(0, 2.35, 8.6);
      this.camera.lookAt(0, 1.1, 0);

      this.scene.add(new T.AmbientLight(0x3a2c50, 0.48));
      const crimson = new T.PointLight(0xb83448, 1.45, 18); crimson.position.set(-4.5, 3.2, 2.2); this.scene.add(crimson);
      const gold = new T.PointLight(0xb28a4e, 1.05, 16); gold.position.set(4.2, 2.4, -1.2); this.scene.add(gold);
      const moon = new T.DirectionalLight(0x605e7e, 0.36); moon.position.set(2, 7, 4); this.scene.add(moon);

      this.makeGround(T);
      this.makeParticles(T);
      await this.loadRuins(T);
      this.makePost(T);
      this.active = true;
      this.log('three-scene', 'acquired', 'glTF shrine + bloom/vignette/grade');
      return true;
    } catch (e) {
      this.active = false;
      this.log('three-scene', 'fallback', String(e.message || e));
      return false;
    }
  }

  makeGround(T) {
    const geo = new T.PlaneGeometry(80, 80);
    let mat = new T.MeshStandardMaterial({ color: 0x140f1e, roughness: 1, metalness: 0 });
    const img = this.loader.img('tex-stone-pattern');
    if (img) {
      try {
        const tex = new T.Texture(img);
        tex.wrapS = tex.wrapT = T.RepeatWrapping;
        tex.repeat.set(18, 18);
        tex.magFilter = T.NearestFilter;
        tex.minFilter = T.NearestFilter;
        tex.needsUpdate = true;
        mat = new T.MeshStandardMaterial({ map: tex, color: 0x3a2c50, roughness: 1, metalness: 0 });
        mat.map = tex;
      } catch (e) { this.log('tex-stone-pattern', 'fallback', '3D texture'); }
    }
    const ground = new T.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03;
    this.scene.add(ground);
    const grid = new T.GridHelper(48, 48, 0x4a3058, 0x241a32);
    grid.material.transparent = true; grid.material.opacity = 0.32; grid.position.y = 0.015;
    this.scene.add(grid);
  }

  makeParticles(T) {
    const count = 320;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = Math.random() * 7 + 0.2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 24 - 3;
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const mat = new T.PointsMaterial({ color: 0xb28a4e, size: 0.055, transparent: true, opacity: 0.72, blending: T.AdditiveBlending, depthWrite: false });
    this.points = new T.Points(geo, mat);
    this.scene.add(this.points);
  }

  async loadRuins(T) {
    const manager = new T.LoadingManager();
    const texUrl = this.loader.url('tex-graveyard-colormap');
    manager.setURLModifier((u) => {
      if (u.includes('colormap') && texUrl) return texUrl;
      return u;
    });
    let gltfLoader = null;
    if (T.GLTFLoader) {
      gltfLoader = new T.GLTFLoader(manager);
      if (gltfLoader.setCrossOrigin) gltfLoader.setCrossOrigin('anonymous');
    }
    const ids = ['model-pillar-obelisk', 'model-altar-stone', 'model-candle-multiple'];
    const loaded = [];
    for (const id of ids) {
      const url = this.loader.url(id);
      if (!gltfLoader || !url) { loaded.push(null); this.log(id, 'fallback', 'procedural ruin'); continue; }
      // eslint-disable-next-line no-await-in-loop
      const obj = await new Promise((resolve) => {
        gltfLoader.load(url, (g) => resolve(g.scene || null), undefined, (err) => {
          this.log(id, 'fallback', 'GLTF load failed; procedural ruin');
          resolve(null);
        });
      });
      loaded.push(obj);
      if (obj) this.log(id, 'acquired', 'glTF model');
    }
    this.models = loaded;
    const spots = [
      [-6.2, -3.2, 0], [-3.4, -6.0, 1], [0, -7.2, 2], [3.4, -6.0, 0], [6.2, -3.2, 1],
      [-5.2, 2.0, 2], [5.2, 2.0, 2], [0, -1.4, 1],
    ];
    spots.forEach((s, i) => {
      const kind = i % 3;
      let o = loaded[kind] ? loaded[kind].clone(true) : this.proceduralRuin(T, kind);
      o = o || this.proceduralRuin(T, kind);
      o.position.set(s[0], 0, s[1]);
      o.rotation.y = (i * 0.7) % (Math.PI * 2);
      const scale = 0.85 + (i % 3) * 0.15;
      o.scale.setScalar(scale);
      o.traverse((n) => {
        if (n.isMesh) {
          if (n.material) {
            n.material = n.material.clone();
            if (n.material.color) n.material.color.multiplyScalar(0.72);
            if (n.material.emissive) { n.material.emissive.setHex(0x140f1e); n.material.emissiveIntensity = 0.35; }
          }
          n.castShadow = false; n.receiveShadow = false;
        }
      });
      this.scene.add(o);
    });
    const altarLight = new T.PointLight(0xb83448, 1.2, 7);
    altarLight.position.set(0, 1.1, -1.4);
    this.scene.add(altarLight);
  }

  proceduralRuin(T, kind) {
    const g = new T.Group();
    const mat = new T.MeshStandardMaterial({ color: 0x322242, emissive: 0x140f1e, emissiveIntensity: 0.45, roughness: 0.85 });
    const gold = new T.MeshStandardMaterial({ color: 0x78583a, emissive: 0x5c1a2e, emissiveIntensity: 0.55, roughness: 0.7 });
    if (kind === 1) {
      const base = new T.Mesh(new T.BoxGeometry(1.8, 0.35, 1.1), mat); base.position.y = 0.18; g.add(base);
      const top = new T.Mesh(new T.BoxGeometry(1.5, 0.18, 0.9), gold); top.position.y = 0.46; g.add(top);
    } else if (kind === 2) {
      for (let i = 0; i < 3; i++) {
        const c = new T.Mesh(new T.CylinderGeometry(0.08, 0.1, 0.5 + i * 0.12, 6), mat); c.position.set((i - 1) * 0.28, 0.3 + i * 0.06, 0); g.add(c);
        const flame = new T.Mesh(new T.SphereGeometry(0.09, 6, 4), gold); flame.position.set((i - 1) * 0.28, 0.62 + i * 0.12, 0); g.add(flame);
      }
    } else {
      const base = new T.Mesh(new T.BoxGeometry(0.8, 0.22, 0.8), mat); base.position.y = 0.11; g.add(base);
      const shaft = new T.Mesh(new T.BoxGeometry(0.46, 2.5, 0.46), mat); shaft.position.y = 1.4; g.add(shaft);
      const cap = new T.Mesh(new T.ConeGeometry(0.36, 0.7, 4), gold); cap.position.y = 2.95; cap.rotation.y = Math.PI / 4; g.add(cap);
    }
    return g;
  }

  makePost(T) {
    if (!(T.EffectComposer && T.RenderPass && T.ShaderPass && T.UnrealBloomPass && T.CopyShader && T.VignetteShader && T.ColorCorrectionShader)) {
      this.log('three-post', 'fallback', 'postprocessing classes missing');
      return;
    }
    try {
      const composer = new T.EffectComposer(this.renderer);
      composer.setSize(W, H);
      composer.addPass(new T.RenderPass(this.scene, this.camera));
      this.bloom = new T.UnrealBloomPass(new T.Vector2(W, H), 0.86, 0.42, 0.70);
      composer.addPass(this.bloom);
      const vignette = new T.ShaderPass(T.VignetteShader);
      vignette.uniforms.offset.value = 1.05;
      vignette.uniforms.darkness.value = 1.35;
      composer.addPass(vignette);
      const grade = new T.ShaderPass(T.ColorCorrectionShader);
      grade.uniforms.powRGB.value = new T.Vector3(1.04, 0.96, 1.08);
      grade.uniforms.mulRGB.value = new T.Vector3(0.92, 0.88, 1.04);
      grade.uniforms.addRGB.value = new T.Vector3(0.008, 0.0, 0.018);
      grade.renderToScreen = true;
      composer.addPass(grade);
      this.composer = composer;
    } catch (e) {
      this.composer = null;
      this.log('three-post', 'fallback', String(e.message || e));
    }
  }

  setFocus(x, lookahead = 0) { this.focus = x; this.lookahead = lookahead; }

  render(dt, mood = 'menu', boss = false) {
    if (!this.active || !this.renderer || !this.scene || !this.camera) return false;
    this.time += dt;
    const t = this.time;
    const targetX = this.focus * 0.35 + this.lookahead * 0.55;
    this.camera.position.x += (Math.sin(t * 0.09) * 0.85 + targetX - this.camera.position.x) * Math.min(1, dt * 1.6);
    this.camera.position.z = 8.6 + Math.cos(t * 0.055) * 0.45;
    this.camera.position.y = 2.35 + Math.sin(t * 0.07) * 0.12;
    this.camera.lookAt(targetX * 0.55, 1.1, -2.2);
    if (this.points) {
      this.points.rotation.y = t * 0.008;
      const arr = this.points.geometry.attributes.position.array;
      for (let i = 1; i < arr.length; i += 3) {
        arr[i] += dt * 0.16;
        if (arr[i] > 7.2) arr[i] = 0.2;
      }
      this.points.geometry.attributes.position.needsUpdate = true;
    }
    if (this.bloom) {
      const base = mood === 'loading' ? 0.45 : mood === 'game' ? 0.68 : mood === 'result' ? 0.78 : 0.92;
      this.bloom.strength += ((base + (boss ? 0.42 : 0)) - this.bloom.strength) * Math.min(1, dt * 1.5);
    }
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
    return true;
  }
}
