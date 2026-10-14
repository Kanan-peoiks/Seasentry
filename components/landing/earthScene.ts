import * as THREE from "three";

/**
 * WebGL half of the landing story: a photographic Earth, a thin atmosphere, a
 * small observation satellite and a camera that follows the story progress.
 * Everything is driven by `render(progress, time)`; the caller owns the loop.
 */

export type EarthScene = {
  render: (progress: number, time: number) => void;
  resize: () => void;
  setPointer: (x: number, y: number) => void;
  dispose: () => void;
};

type Options = {
  canvas: HTMLCanvasElement;
  lowPower: boolean;
  onReady: () => void;
};

// Caspian Sea, off the Absheron peninsula — the platform's area of interest.
const TARGET_LAT = 40.4;
const TARGET_LON = 50.6;
// Initial turn that brings the Caspian to face the camera.
const FACE_CASPIAN = -2.44;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function latLonToVector(lat: number, lon: number, radius = 1) {
  const la = THREE.MathUtils.degToRad(lat);
  const lo = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo)).multiplyScalar(radius);
}

function buildSatellite() {
  const sat = new THREE.Group();
  const bus = new THREE.MeshStandardMaterial({ color: 0xe9eeee, metalness: 0.55, roughness: 0.38 });
  const foil = new THREE.MeshStandardMaterial({ color: 0xc9a45c, metalness: 0.85, roughness: 0.32 });
  const frame = new THREE.MeshStandardMaterial({ color: 0x5f7487, metalness: 0.7, roughness: 0.45 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 1.5), bus);
  sat.add(body);
  const wrap = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.4, 1.52), foil);
  wrap.position.y = -0.18;
  sat.add(wrap);

  // Solar array texture: dark-blue cells with a brand-cyan sheen on the grid lines.
  const cells = document.createElement("canvas");
  cells.width = 256;
  cells.height = 128;
  const g = cells.getContext("2d");
  if (g) {
    g.fillStyle = "#0b3c68";
    g.fillRect(0, 0, 256, 128);
    g.strokeStyle = "rgba(120,200,225,.55)";
    g.lineWidth = 2;
    for (let x = 0; x <= 256; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
    for (let y = 0; y <= 128; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  }
  const cellTexture = new THREE.CanvasTexture(cells);
  cellTexture.colorSpace = THREE.SRGBColorSpace;
  const panelMaterial = new THREE.MeshStandardMaterial({ map: cellTexture, metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide });

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 8), frame);
    arm.rotation.z = Math.PI / 2;
    arm.position.x = side * 0.9;
    sat.add(arm);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.03, 1.3), panelMaterial);
    panel.position.x = side * 2.55;
    sat.add(panel);
  }

  // SAR antenna: a long flat slab under the bus, pointed at nadir.
  const antenna = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.55), new THREE.MeshStandardMaterial({ color: 0x9fb2bf, metalness: 0.6, roughness: 0.5 }));
  antenna.position.set(0, -0.62, 0);
  sat.add(antenna);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), bus);
  dish.position.set(0, 0.45, 0.35);
  dish.rotation.x = -0.5;
  sat.add(dish);

  return sat;
}

export function createEarthScene({ canvas, lowPower, onReady }: Options): EarthScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.002, 200);

  // ---- textures -----------------------------------------------------------
  const manager = new THREE.LoadingManager();
  manager.onLoad = onReady;
  const loader = new THREE.TextureLoader(manager);
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const load = (url: string, color: boolean) => {
    const tex = loader.load(url);
    if (color) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    return tex;
  };
  const dayMap = load("/textures/earth_atmos_2048.jpg", true);
  const specMap = load("/textures/earth_specular_2048.jpg", false);
  const cloudMap = load("/textures/earth_clouds_1024.png", false);

  // ---- lighting -----------------------------------------------------------
  const sun = new THREE.DirectionalLight(0xfff4e6, 3.1);
  sun.position.set(-2.2, 1.2, 5);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x3a5f8c, 1.15));

  // ---- Earth --------------------------------------------------------------
  const earth = new THREE.Group();
  scene.add(earth);
  const segments = lowPower ? 64 : 128;
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(1, segments, segments),
    new THREE.MeshPhongMaterial({ map: dayMap, specularMap: specMap, specular: new THREE.Color(0x1c2c3a), shininess: 60 }),
  );
  earth.add(globe);
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(1.006, segments, segments),
    new THREE.MeshStandardMaterial({ map: cloudMap, alphaMap: cloudMap, transparent: true, opacity: 0.55, depthWrite: false, roughness: 1, metalness: 0 }),
  );
  earth.add(clouds);

  // Rayleigh-style rim: bright limb towards the sun, fading to nothing in the dark.
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.07, 96, 96),
    new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uSun: { value: sun.position.clone().normalize() }, uStrength: { value: 1 } },
      vertexShader: `varying vec3 vN; varying vec3 vW;
        void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `varying vec3 vN; varying vec3 vW; uniform vec3 uSun; uniform float uStrength;
        void main(){
          vec3 view = normalize(cameraPosition - vW);
          float rim = pow(clamp(0.72 + dot(normalize(vN), view), 0.0, 1.0), 3.2);
          float lit = clamp(dot(normalize(vW), uSun) * 0.7 + 0.45, 0.0, 1.0);
          vec3 col = mix(vec3(0.12,0.38,0.85), vec3(0.45,0.78,1.0), rim);
          gl_FragColor = vec4(col, rim * lit * 1.15 * uStrength);
        }`,
    }),
  );
  scene.add(atmosphere);
  const atmosphereUniforms = (atmosphere.material as THREE.ShaderMaterial).uniforms;

  // ---- stars --------------------------------------------------------------
  const starCount = lowPower ? 700 : 1800;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(90 + Math.random() * 20);
    starPositions.set([v.x, v.y, v.z], i * 3);
    const warm = Math.random();
    const b = 0.5 + Math.random() * 0.5;
    starColors.set([b * (0.85 + warm * 0.15), b * 0.92, b * (1 - warm * 0.12)], i * 3);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
  const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ size: 0.9, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }));
  scene.add(stars);

  // ---- orbit + satellite --------------------------------------------------
  const ORBIT_RADIUS = 1.32;
  const inclination = THREE.MathUtils.degToRad(98.6); // sun-synchronous, like Sentinel-1
  const orbitPlane = new THREE.Group();
  orbitPlane.rotation.set(0, THREE.MathUtils.degToRad(-35), inclination);
  scene.add(orbitPlane);
  const orbitPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 192; i++) {
    const a = (i / 192) * Math.PI * 2;
    orbitPoints.push(new THREE.Vector3(Math.cos(a) * ORBIT_RADIUS, 0, Math.sin(a) * ORBIT_RADIUS));
  }
  const orbitMaterial = new THREE.LineBasicMaterial({ color: 0x4fd0e0, transparent: true, opacity: 0.22, depthWrite: false });
  orbitPlane.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(orbitPoints), orbitMaterial));

  const satellite = buildSatellite();
  const SAT_SCALE = 0.026;
  satellite.scale.setScalar(SAT_SCALE);
  scene.add(satellite);

  // Sensor footprint on the surface, revealed as the camera arrives.
  const footprint = new THREE.Group();
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x00c5c8, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  footprint.add(new THREE.Mesh(new THREE.RingGeometry(0.058, 0.061, 96), ringMaterial));
  footprint.add(new THREE.Mesh(new THREE.RingGeometry(0.0, 0.004, 24), ringMaterial));
  const targetNormal = latLonToVector(TARGET_LAT, TARGET_LON, 1);
  footprint.position.copy(targetNormal).multiplyScalar(1.002);
  footprint.lookAt(targetNormal.clone().multiplyScalar(3));
  earth.add(footprint);

  // ---- state --------------------------------------------------------------
  const pointer = new THREE.Vector2();
  const pointerSmooth = new THREE.Vector2();
  const worldTarget = new THREE.Vector3();
  const camStart = new THREE.Vector3();
  const camEnd = new THREE.Vector3();
  const look = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const right = new THREE.Vector3();
  const upV = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const satPos = new THREE.Vector3();
  const passPos = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  let wide = true;

  const resize = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    wide = w / h > 1.05;
    const dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();

  const render = (progress: number, time: number) => {
    // Camera approach (chapters 1-2): 0.10 -> 0.31 of the story.
    const approach = smooth(0.1, 0.31, progress);
    const finalDist = 0.34; // never close enough to stretch the 2K texture

    // Earth spin eases to a stop as we lock onto the Caspian.
    const spin = FACE_CASPIAN + time * 0.012 * (1 - approach);
    earth.rotation.y = spin;
    clouds.rotation.y = time * 0.004;

    // Sit the globe to the right while the hero copy occupies the left.
    const heroOffset = (wide ? 0.78 : 0) * (1 - smooth(0.0, 0.14, progress));
    const heroLift = wide ? 0 : -0.42 * (1 - smooth(0.0, 0.14, progress));
    earth.position.set(heroOffset, heroLift, 0);
    clouds.position.copy(earth.position);
    atmosphere.position.copy(earth.position);

    // World position of the target as the planet turns.
    worldTarget.copy(targetNormal).applyAxisAngle(yAxis, earth.rotation.y).add(earth.position);

    // Slow, cinematic drift in the opening shot.
    pointerSmooth.lerp(pointer, 0.04);
    const drift = 1 - approach;
    camStart.set(Math.sin(time * 0.05) * 0.1 + pointerSmooth.x * 0.16 * drift, 0.32 + Math.cos(time * 0.04) * 0.04 + pointerSmooth.y * 0.1 * drift, wide ? 3.7 : 4.5);
    tmp.copy(worldTarget).sub(earth.position).normalize();
    camEnd.copy(earth.position).add(tmp.multiplyScalar(1 + finalDist));
    camera.position.lerpVectors(camStart, camEnd, approach);
    // Fly in on a curve so the dolly never looks like a straight zoom.
    camera.position.y += Math.sin(approach * Math.PI) * 0.18;
    look.set(0, 0, 0).lerp(worldTarget, approach);
    camera.up.set(0, 1, 0);
    camera.lookAt(look);
    camera.fov = 36 - approach * 12;
    camera.updateProjectionMatrix();

    atmosphereUniforms.uStrength.value = 1 + approach * 0.35;
    orbitMaterial.opacity = 0.22 * (1 - approach * 0.8);
    ringMaterial.opacity = smooth(0.18, 0.3, progress) * (0.55 + Math.sin(time * 2.2) * 0.12);
    stars.visible = progress < 0.34;

    // Satellite along its orbit; during the approach it sweeps through the frame.
    const angle = time * 0.09 + 0.6;
    satPos.set(Math.cos(angle) * ORBIT_RADIUS, 0, Math.sin(angle) * ORBIT_RADIUS).applyEuler(orbitPlane.rotation).add(earth.position);
    const passT = smooth(0.12, 0.27, progress);
    const passWeight = Math.sin(passT * Math.PI);
    if (passWeight > 0.001) {
      fwd.copy(look).sub(camera.position).normalize();
      right.crossVectors(fwd, camera.up).normalize();
      upV.crossVectors(right, fwd).normalize();
      passPos.copy(camera.position)
        .addScaledVector(fwd, 1.15 - passT * 0.25)
        .addScaledVector(right, (passT * 2 - 1) * 0.8)
        .addScaledVector(upV, 0.07 + Math.sin(passT * Math.PI) * 0.03);
      satPos.lerp(passPos, passWeight);
    }
    satellite.position.copy(satPos);
    // Nadir-pointing: antenna side faces the planet, panels stay broadside to the sun.
    tmp.copy(satPos).sub(earth.position).normalize();
    satellite.up.copy(tmp);
    satellite.lookAt(satPos.clone().add(new THREE.Vector3(-tmp.z, 0, tmp.x).normalize()));
    satellite.rotation.z += passWeight * 0.35;
    satellite.visible = progress < 0.34;

    renderer.render(scene, camera);
  };

  const dispose = () => {
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      const mats = Array.isArray(mat) ? mat : mat ? [mat] : [];
      mats.forEach((m) => { (m as THREE.MeshStandardMaterial).map?.dispose(); m.dispose(); });
    });
    [dayMap, specMap, cloudMap].forEach((t) => t.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
  };

  return {
    render,
    resize,
    setPointer: (x, y) => pointer.set(x, y),
    dispose,
  };
}
