import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

function roundedRectangle(width, height, radius) {
  const x = -width / 2, y = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

function roundedMesh(width, height, depth, radius, material, sideMaterial = material) {
  const geometry = new THREE.ExtrudeGeometry(roundedRectangle(width, height, radius), {
    depth, bevelEnabled: true, bevelSize: 0.018, bevelThickness: 0.012,
    bevelSegments: 3, curveSegments: 10, steps: 1,
  });
  const mesh = new THREE.Mesh(geometry, [material, sideMaterial]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function line(points, material, radius = 0.012) {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 32, radius, 8, false), material);
}

function starGeometry(radius = 0.1, innerRadius = radius * 0.4, points = 4) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i += 1) {
    const angle = Math.PI / 2 + i * Math.PI / points;
    const r = i % 2 ? innerRadius : radius;
    if (i === 0) shape.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
    else shape.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function textMesh(text, width, height, color, fontSize = 46) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color;
  ctx.font = "600 " + fontSize + "px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
}

function createIllustration(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const material = {
    paper: new THREE.MeshPhysicalMaterial({ color: 0xfffcf7, roughness: 0.75, clearcoat: 0.12 }),
    paperSide: new THREE.MeshStandardMaterial({ color: 0xc89aa2, roughness: 0.82 }),
    backPaper: new THREE.MeshStandardMaterial({ color: 0xf7d8c4, roughness: 0.85 }),
    pinkPaper: new THREE.MeshStandardMaterial({ color: 0xf9e1e6, roughness: 0.8 }),
    berry: new THREE.MeshPhysicalMaterial({ color: 0x9e2e4a, roughness: 0.48, clearcoat: 0.22, clearcoatRoughness: 0.5 }),
    cap: new THREE.MeshPhysicalMaterial({ color: 0x80233b, roughness: 0.52, clearcoat: 0.25, clearcoatRoughness: 0.5 }),
    capSide: new THREE.MeshStandardMaterial({ color: 0x451622, roughness: 0.64 }),
    ink: new THREE.MeshBasicMaterial({ color: 0xbe8190 }),
    inkSoft: new THREE.MeshBasicMaterial({ color: 0xe5b9c4 }),
    white: new THREE.MeshBasicMaterial({ color: 0xfffcf7 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc98e35, roughness: 0.4, metalness: 0.25 }),
    goldLight: new THREE.MeshStandardMaterial({ color: 0xe6b15b, roughness: 0.45, metalness: 0.2 }),
    wood: new THREE.MeshStandardMaterial({ color: 0xf5d6a1, roughness: 0.8 }),
    graphite: new THREE.MeshStandardMaterial({ color: 0x30232a, roughness: 0.9 }),
    pink: new THREE.MeshPhysicalMaterial({ color: 0xf4bdc9, roughness: 0.42, clearcoat: 0.3 }),
    ferrule: new THREE.MeshStandardMaterial({ color: 0xe7c5cb, metalness: 0.65, roughness: 0.35 }),
  };

  const paper = new THREE.Group();
  paper.position.set(-0.4, -0.12, 0);
  paper.rotation.z = 0.035;
  root.add(paper);
  const back = roundedMesh(2.35, 2.55, 0.035, 0.15, material.backPaper, material.paperSide);
  back.position.set(-0.07, -0.08, -0.13);
  back.rotation.z = 0.075;
  paper.add(back);
  const middle = roundedMesh(2.35, 2.55, 0.035, 0.15, material.pinkPaper, material.paperSide);
  middle.position.set(0.035, -0.045, -0.065);
  middle.rotation.z = -0.055;
  paper.add(middle);
  paper.add(roundedMesh(2.35, 2.55, 0.05, 0.15, material.paper, material.paperSide));

  const addBar = (x, y, width, color = material.ink, height = 0.065) => {
    const bar = roundedMesh(width, height, 0.005, height / 2, color);
    bar.position.set(x, y, 0.078);
    bar.castShadow = false;
    paper.add(bar);
  };
  const emblem = roundedMesh(0.29, 0.29, 0.015, 0.09, material.berry);
  emblem.position.set(-0.82, 0.97, 0.075);
  paper.add(emblem);
  const sparkle = new THREE.Mesh(starGeometry(0.1, 0.03), material.white);
  sparkle.position.set(-0.82, 0.97, 0.113);
  paper.add(sparkle);
  addBar(-0.25, 1.01, 0.7, material.berry);
  addBar(-0.37, 0.88, 0.46, material.inkSoft, 0.045);
  addBar(0, 0.73, 1.98, material.inkSoft, 0.008);
  const score = textMesh("PASS 100", 0.48, 0.12, "#9e2e4a", 50);
  score.position.set(0.77, 0.98, 0.09);
  paper.add(score);
  [0.29, -0.08, -0.45].forEach((y, index) => {
    const circle = new THREE.Mesh(new THREE.CircleGeometry(0.1, 32), material.berry);
    circle.position.set(-0.82, y, 0.082);
    paper.add(circle);
    const tick = line([[-0.86, y, 0.09], [-0.83, y - 0.035, 0.09], [-0.775, y + 0.03, 0.09]], material.white, 0.009);
    paper.add(tick);
    addBar(-0.04 + index * 0.015, y + 0.035, [1.25, 1.02, 1.4][index]);
    addBar(-0.29, y - 0.09, 0.75, material.inkSoft, 0.045);
  });
  addBar(-0.44, -1.04, 0.85, material.goldLight, 0.045);
  addBar(0.76, -1.04, 0.3, material.inkSoft, 0.045);

  const cap = new THREE.Group();
  cap.position.set(0.69, 0.63, 1.6);
  cap.rotation.set(-1.17, -0.05, -0.72);
  root.add(cap);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.59, 0.56, 64), material.capSide);
  base.rotation.x = Math.PI / 2;
  base.position.z = -0.28;
  base.castShadow = true;
  cap.add(base);
  const board = roundedMesh(2.12, 2.12, 0.10, 0.10, material.cap, material.capSide);
  cap.add(board);
  const stitchPoints = roundedRectangle(1.91, 1.91, 0.10).getPoints(90).map(p => new THREE.Vector3(p.x, p.y, 0.119));
  const stitch = new THREE.Line(new THREE.BufferGeometry().setFromPoints(stitchPoints), new THREE.LineDashedMaterial({ color: 0xe9aeba, transparent: true, opacity: 0.5, dashSize: 0.025, gapSize: 0.023 }));
  stitch.computeLineDistances();
  cap.add(stitch);
  const button = new THREE.Mesh(new THREE.SphereGeometry(0.066, 28, 20), material.gold);
  button.scale.z = 0.48;
  button.position.set(0, 0, 0.15);
  cap.add(button);
  cap.add(line([[0, 0, 0.16], [0.27, -0.32, 0.15], [0.5, -0.66, 0.15], [0.7, -1.02, 0.13], [0.74, -1.24, -0.05], [0.73, -1.38, -0.23]], material.gold, 0.012));
  for (let i = 0; i < 8; i += 1) {
    const fringe = line([[0.73 + (i - 3.5) * 0.013, -1.37, -0.23], [0.74 + (i - 3.5) * 0.018, -1.58, -0.29]], i < 3 ? material.gold : material.berry, 0.009);
    cap.add(fringe);
  }

  const pencil = new THREE.Group();
  pencil.position.set(-0.55, -1.53, 0.42);
  pencil.rotation.set(0.12, -0.05, -0.13);
  root.add(pencil);
  const cylinder = (length, radius, x, mat, sides = 6) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, sides), mat);
    mesh.rotation.z = -Math.PI / 2;
    mesh.position.x = x;
    mesh.castShadow = true;
    pencil.add(mesh);
    return mesh;
  };
  cylinder(1.7, 0.055, 0, material.gold, 6);
  cylinder(0.18, 0.059, 0.94, material.ferrule, 24);
  [0.88, 0.94, 1.0].forEach(x => cylinder(0.013, 0.062, x, material.ferrule, 24));
  cylinder(0.18, 0.055, 1.12, material.pink, 24);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.25, 6), material.wood);
  tip.rotation.z = Math.PI / 2;
  tip.position.x = -0.975;
  tip.castShadow = true;
  pencil.add(tip);
  const graphite = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.09, 6), material.graphite);
  graphite.rotation.z = Math.PI / 2;
  graphite.position.x = -1.14;
  pencil.add(graphite);
  const pencilText = textMesh("OCEC  2B", 0.58, 0.075, "#704b25", 44);
  pencilText.position.set(0.25, 0, 0.059);
  pencil.add(pencilText);

  const starTile = new THREE.Group();
  starTile.position.set(-1.65, 1.65, 0.28);
  starTile.rotation.z = -0.12;
  const tile = roundedMesh(0.35, 0.35, 0.09, 0.11, material.gold);
  const tileStar = new THREE.Mesh(starGeometry(0.112, 0.05, 5), material.white);
  tileStar.position.z = 0.115;
  starTile.add(tile, tileStar);
  root.add(starTile);
  const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.075, 32, 24), material.pink);
  pearl.position.set(0.33, 1.55, 0.3);
  pearl.castShadow = true;
  root.add(pearl);
  const pinkOrb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 40, 28), material.pink);
  pinkOrb.position.set(1.68, -0.96, 0.3);
  pinkOrb.castShadow = true;
  root.add(pinkOrb);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.039, 16, 40), material.goldLight);
  ring.position.set(-1.73, -0.97, 0.45);
  ring.rotation.set(0.2, -0.2, 0);
  ring.castShadow = true;
  root.add(ring);
  return { root, starTile, pearl, pinkOrb, ring };
}

export function GraduationCapScene() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const container = containerRef.current, canvas = canvasRef.current;
    if (!container || !canvas) return undefined;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      setSupported(false);
      return undefined;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    // The paper, cap and ornaments move on every frame, so their shadows must too.
    renderer.shadowMap.autoUpdate = true;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-2.6, 2.6, 2.2, -2.2, 0.1, 30);
    camera.position.set(0, 0, 10);
    scene.add(new THREE.HemisphereLight(0xfffbf5, 0xcfa6b0, 1.9));
    const key = new THREE.DirectionalLight(0xfff5e6, 3.5);
    key.position.set(-3, 5, 12);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 20 });
    key.shadow.normalBias = 0.015;
    key.shadow.bias = -0.0002;
    key.shadow.radius = 12;
    key.shadow.blurSamples = 16;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xf7c7d3, 1.1);
    fill.position.set(4, 0, 5);
    scene.add(fill);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.07 }));
    back.position.z = -0.33;
    back.receiveShadow = true;
    scene.add(back);
    const { root, starTile, pearl, pinkOrb, ring } = createIllustration(scene);
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motionPreference.matches, inView = true;
    let pointerX = 0, pointerY = 0, lastTime = 0;
    const render = () => renderer.render(scene, camera);
    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      // CSS controls display size; resize the drawing buffer and camera together.
      // https://threejs.org/manual/pages/responsive.html
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setSize(width, height, false);
      const viewHeight = 4.45, viewWidth = viewHeight * width / height;
      camera.left = -viewWidth / 2;
      camera.right = viewWidth / 2;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
      camera.updateProjectionMatrix();
      render();
    };
    const animate = (time) => {
      const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 1 / 60;
      lastTime = time;
      const blend = 1 - Math.exp(-7 * delta);
      root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, -pointerY * 0.13, blend);
      root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, pointerX * 0.17, blend);
      root.position.y = Math.sin(time * 0.00065) * 0.026;
      starTile.position.y = 1.65 + Math.sin(time * 0.001 + 0.3) * 0.055;
      pearl.position.y = 1.55 + Math.sin(time * 0.0009 + 1.6) * 0.045;
      pinkOrb.position.y = -0.96 + Math.sin(time * 0.0009 + 2.3) * 0.04;
      ring.rotation.y = -0.2 + Math.sin(time * 0.0008) * 0.12;
      render();
    };
    const updateLoop = () => {
      lastTime = 0;
      // https://threejs.org/docs/pages/WebGLRenderer.html
      renderer.setAnimationLoop(!reducedMotion && inView ? animate : null);
      render();
    };
    const onPointerMove = (event) => {
      if (reducedMotion || event.pointerType !== "mouse") return;
      const bounds = container.getBoundingClientRect();
      pointerX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      pointerY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    };
    const onPointerLeave = () => { pointerX = 0; pointerY = 0; };
    const onMotionChange = (event) => {
      reducedMotion = event.matches;
      if (reducedMotion) {
        onPointerLeave();
        root.rotation.set(0, 0, 0);
        root.position.y = 0;
        starTile.position.y = 1.65;
        pearl.position.y = 1.55;
        pinkOrb.position.y = -0.96;
        ring.rotation.y = -0.2;
      }
      updateLoop();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    const visibilityObserver = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; updateLoop(); }, { threshold: 0.01 });
    visibilityObserver.observe(container);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerleave", onPointerLeave);
    motionPreference.addEventListener("change", onMotionChange);
    resize();
    updateLoop();
    return () => {
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
      motionPreference.removeEventListener("change", onMotionChange);
      renderer.setAnimationLoop(null);
      // Dispose GPU resources, including the small text textures on the models.
      // https://threejs.org/manual/pages/how-to-dispose-of-objects.html
      const geometries = new Set(), materials = new Set(), textures = new Set();
      scene.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        const ownedMaterials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
        ownedMaterials.forEach(mat => { materials.add(mat); if (mat.map) textures.add(mat.map); });
      });
      geometries.forEach(geometry => geometry.dispose());
      textures.forEach(texture => texture.dispose());
      materials.forEach(mat => mat.dispose());
      key.shadow.map?.dispose();
      renderer.dispose();
    };
  }, []);
  return (
    <div className="home-3d-scene" ref={containerRef} role="img" aria-label="ฉากสามมิติกระดาษข้อสอบ หมวกรับปริญญาสีเบอร์กันดี และดินสอสีทอง ตอบสนองตามตำแหน่งเมาส์">
      <canvas ref={canvasRef} aria-hidden="true" />
      {!supported ? <span className="home-scene-fallback">OCEC · พร้อมสำหรับความสำเร็จครั้งต่อไป</span> : null}
    </div>
  );
}
