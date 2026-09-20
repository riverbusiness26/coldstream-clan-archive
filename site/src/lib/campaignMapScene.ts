import * as THREE from 'three';

export const MAP_POSITIONS: Record<string, [number, number]> = { camp: [-9, 6], crossing: [-4, 3.1], orchard: [.1, 2.4], windmill: [-7, -2.7], village: [-.4, -3.1], depot: [5.5, 2.8], redoubt: [5.7, -3], fort: [9, -6.4] };
export type MapExpedition = { currentNode: string; owned: string[]; operation: { nodeId: string; name: string; phase: number; phaseName: string } | null; victory: boolean };
export type MapActivity = { id: string; kind: string; nodeId: string; at: string };
export type MapControls = { select: (id: string) => void; turn: (direction: number) => void; zoom: (direction: number) => void; reset: () => void; setMotion: (enabled: boolean) => void; updateExpedition: (state?: MapExpedition) => void; updateKitchen: (completed: boolean, started: boolean) => void; react: (kind: string, nodeId: string) => void; dispose: () => void };
type Options = { completedKitchen: boolean; startedKitchen: boolean; expedition?: MapExpedition; motion?: boolean; edges: string[][]; onPins: (pins: Record<string, { x: number; y: number }>) => void; onReady: () => void; onFailure: () => void; onZoom?: (zoom: number) => void };

export function createCampaignMap(host: HTMLElement, options: Options): MapControls {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-20, 20, 15, -15, .1, 150);
  const resources: Array<{ dispose: () => void }> = [];
  const models = new THREE.Group(); scene.add(models);
  let renderer: THREE.WebGLRenderer | undefined, observer: ResizeObserver | undefined, visibilityObserver: IntersectionObserver | undefined, disposed = false, frame = 0, angle = .68;
  let zoom = 1, panX = 0, panZ = 0, visible = true, dirty = true, sizeDirty = true, ready = false, failed = false, elapsed = 0, lastTime = 0;
  let expedition = options.expedition, motion = options.motion !== false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animated = () => motion && !reducedMotion.matches;
  const flags: THREE.Mesh[] = [], crowns: THREE.Mesh[] = [], ripples: THREE.Mesh[] = [];
  const smoke: Array<{ mesh: THREE.Mesh; x: number; y: number; z: number; offset: number }> = [];
  const routeModels: Array<{ a: string; b: string; curve: THREE.CatmullRomCurve3; dashes: THREE.Mesh[]; arrows: THREE.Mesh[]; roadMaterial: THREE.MeshStandardMaterial; material: THREE.MeshStandardMaterial; status: string }> = [];
  const interaction = host.parentElement || host;
  const material = (color: number, roughness = .88, metalness = 0) => { const value = new THREE.MeshStandardMaterial({ color, roughness, metalness }); resources.push(value); return value; };
  const earth = material(0x454536), soil = material(0x66563c), grass = material(0x7b8250), brass = material(0xc6a66b, .4, .6), timber = material(0x66503c), wood = material(0xa28a60), bark = material(0x68543c), stone = material(0xb2a58a), darkStone = material(0x8d8d79), roof = material(0x70483b), slate = material(0x515d5d), canvas = material(0xe2d6ad), scarlet = material(0x8c3b30), shadow = material(0x2d332d), leaves = [material(0x536348), material(0x6e7950), material(0x8a8d55)], gold = material(0xe2c782, .45, .3);
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1); resources.push(boxGeometry);
  function mesh(geometry: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = models) { const value = new THREE.Mesh(geometry, mat); value.castShadow = true; value.receiveShadow = true; parent.add(value); return value; }
  function box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) { const value = mesh(boxGeometry, mat, parent); value.position.set(x, y, z); value.scale.set(w, h, d); return value; }
  function geometry<T extends THREE.BufferGeometry>(g: T) { resources.push(g); return g; }
  function cylinder(parent: THREE.Object3D, x: number, y: number, z: number, top: number, bottom: number, h: number, mat: THREE.Material, sides = 10) { const value = mesh(geometry(new THREE.CylinderGeometry(top, bottom, h, sides)), mat, parent); value.position.set(x, y, z); return value; }
  const riverX = (z: number) => -4.5 + Math.sin(z * .46) * .85;
  function terrainY(x: number, z: number) {
    const hill = 1.6 * Math.exp(-((x - 8.2) ** 2 / 25 + (z + 5.5) ** 2 / 16));
    const rolling = .14 * Math.sin(x * .56) * Math.cos(z * .46);
    const river = Math.exp(-((x - riverX(z)) ** 2) / .8);
    return .48 + hill + rolling - river * .37;
  }
  function groupAt(x: number, z: number) { const g = new THREE.Group(); g.position.set(x, terrainY(x, z), z); models.add(g); return g; }
  function gable(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) {
    const shape = new THREE.Shape().moveTo(-w / 2, 0).lineTo(w / 2, 0).lineTo(0, h).closePath();
    const value = mesh(geometry(new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false })), mat, parent); value.position.set(x, y, z - d / 2); return value;
  }
  function house(parent: THREE.Object3D, x: number, z: number, w = 1.2, h = .85, d = 1, roofMat = roof) {
    box(parent, x, h / 2, z, w, h, d, stone); gable(parent, x, h, z, w + .18, .55, d + .18, roofMat);
    box(parent, x - w * .18, .25, z + d / 2 + .01, .25, .5, .035, timber);
    for (const dx of [-.32, .32]) { box(parent, x + dx, .61, z + d / 2 + .02, .18, .22, .045, shadow); box(parent, x + dx, .61, z + d / 2 + .047, .02, .23, .02, wood); }
    box(parent, x + w * .27, h + .52, z - d * .25, .19, .62, .23, darkStone);
    for (let i = 0; i < 3; i++) { const puffMat = material(0xcec8b1); puffMat.transparent = true; puffMat.opacity = .22; puffMat.depthWrite = false; const puff = mesh(geometry(new THREE.IcosahedronGeometry(.09, 1)), puffMat, parent); puff.castShadow = false; const sx = x + w * .27, sy = h + .83, sz = z - d * .25; puff.position.set(sx, sy + i * .2, sz); smoke.push({ mesh: puff, x: sx, y: sy, z: sz, offset: i / 3 }); }
    for (const side of [-1, 1]) { const beam = box(parent, x + side * w / 4, h + .25, z + d / 2 + .095, Math.sqrt((w / 2) ** 2 + .55 ** 2), .055, .04, timber); beam.rotation.z = -side * Math.atan2(.55, w / 2); }
  }
  const treeGeo = geometry(new THREE.IcosahedronGeometry(1, 1));
  function tree(x: number, z: number, size: number, kind: number, apple = false) {
    const g = groupAt(x, z); cylinder(g, 0, size * .35, 0, .055, .09, size * .7, bark, 5);
    const crown = mesh(treeGeo, leaves[kind % leaves.length], g); crown.position.y = size * .95; crown.scale.set(size * .4, size * .56, size * .42); crown.rotation.y = x; crowns.push(crown);
    if (apple) for (let i = 0; i < 4; i++) { const fruit = mesh(treeGeo, scarlet, g); fruit.position.set(Math.cos(i * 1.8) * size * .3, size * (.75 + i * .11), Math.sin(i * 1.8) * size * .31); fruit.scale.setScalar(.066); }
  }
  function flag(parent: THREE.Object3D, x: number, z: number, h = 1.5) { cylinder(parent, x, h / 2, z, .025, .025, h, brass, 6); const shape = new THREE.Shape().moveTo(0, 0).lineTo(.72, -.06).lineTo(.57, -.23).lineTo(.7, -.4).lineTo(0, -.37).closePath(); const value = mesh(geometry(new THREE.ShapeGeometry(shape)), scarlet, parent); value.material = scarlet; scarlet.side = THREE.DoubleSide; value.position.set(x, h - .1, z); flags.push(value); }
  function tent(parent: THREE.Object3D, x: number, z: number, scale = 1) { gable(parent, x, .02, z, 1.2 * scale, .9 * scale, 1.45 * scale, canvas); const flap = gable(parent, x, .03, z + .74 * scale, .42 * scale, .72 * scale, .025, shadow); flap.position.z = z + .725 * scale; for (const side of [-1, 1]) box(parent, x + side * .66 * scale, .055, z + .85 * scale, .07, .11, .07, timber); }
  function crate(parent: THREE.Object3D, x: number, y: number, z: number, size = .45) { box(parent, x, y + size / 2, z, size, size, size, wood); for (const dx of [-.35, .35]) box(parent, x + size * dx, y + size / 2, z + size * .51, .035, size, .025, timber); }
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;
    renderer.domElement.setAttribute('aria-hidden', 'true'); host.append(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xfff1cf, 0x465340, 2.6));
    const sun = new THREE.DirectionalLight(0xffecc9, 3.2); sun.position.set(-12, 24, 15); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -25; sun.shadow.camera.right = 25; sun.shadow.camera.top = 25; sun.shadow.camera.bottom = -25; sun.shadow.normalBias = .035; sun.shadow.bias = -.0001; scene.add(sun);
    const fill = new THREE.DirectionalLight(0xb9d0d1, 1.15); fill.position.set(14, 7, -15); scene.add(fill);
    box(models, 0, -.5, 0, 26.2, 1.2, 18.2, timber); box(models, 0, .01, 0, 26.3, .12, 18.3, brass); box(models, 0, .13, 0, 26.1, .12, 18.1, earth);
    for (const x of [-12.6, 12.6]) for (const z of [-8.6, 8.6]) cylinder(models, x, -.92, z, .5, .42, .7, timber);
    const surface = geometry(new THREE.PlaneGeometry(26, 18, 100, 72)); surface.rotateX(-Math.PI / 2);
    const positions = surface.attributes.position; const colors = [];
    for (let i = 0; i < positions.count; i++) { const x = positions.getX(i), z = positions.getZ(i); positions.setY(i, terrainY(x, z)); const t = (Math.sin(x * 2.1 + z * 3) + Math.cos(z * 2.4)) * .025; const color = new THREE.Color(Math.abs(x - riverX(z)) < .85 ? 0x9a9572 : 0x80865a); color.offsetHSL(0, -.03, t); colors.push(color.r, color.g, color.b); }
    surface.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); surface.computeVertexNormals(); const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }); resources.push(terrainMat); mesh(surface, terrainMat);
    const waterPoints = [], waterIndices = [];
    for (let i = 0; i <= 90; i++) { const z = -9 + i * .2, x = riverX(z); waterPoints.push(x - .45, .265, z, x + .45, .265, z); if (i < 90) { const a = i * 2; waterIndices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
    const waterGeo = geometry(new THREE.BufferGeometry()); waterGeo.setAttribute('position', new THREE.Float32BufferAttribute(waterPoints, 3)); waterGeo.setIndex(waterIndices); waterGeo.computeVertexNormals(); const water = material(0x6b9994, .22, .25); water.side = THREE.DoubleSide; mesh(waterGeo, water);
    const rippleMat = material(0xa2bcb0, .3);
    for (let z = -8.5; z < 9; z += .65) ripples.push(box(models, riverX(z), .276, z, .25, .012, .018, rippleMat));
    const arrowGeometry = geometry(new THREE.BufferGeometry()); arrowGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-.25, 0, -.22, .25, 0, -.22, 0, 0, .37], 3)); arrowGeometry.computeVertexNormals();
    for (const [a, b] of options.edges) {
      const start = MAP_POSITIONS[a], end = MAP_POSITIONS[b]; if (!start || !end) continue;
      const guide = new THREE.CatmullRomCurve3([start, [(start[0] + end[0]) / 2 + .35, (start[1] + end[1]) / 2 + .18], end].map(([x, z]) => new THREE.Vector3(x, terrainY(x, z), z)));
      const curve = new THREE.CatmullRomCurve3(guide.getPoints(48).map(point => new THREE.Vector3(point.x, terrainY(point.x, point.z) + .12, point.z)));
      const roadMat = material(0x393b28); roadMat.transparent = true; roadMat.opacity = .72;
      const road = mesh(geometry(new THREE.TubeGeometry(curve, 72, .155, 6, false)), roadMat); road.castShadow = false;
      const routeMat = material(0xe7c77c, .4, .25); routeMat.transparent = true; routeMat.depthWrite = false; routeMat.side = THREE.DoubleSide;
      const dashes: THREE.Mesh[] = [];
      const count = Math.ceil(curve.getLength() * 1.8);
      for (let i = 0; i < count; i++) { const dash = box(models, 0, 0, 0, .19, .055, .34, routeMat); dash.castShadow = false; dashes.push(dash); }
      const arrows = [.3, .7].map(t => { const arrow = mesh(arrowGeometry, routeMat); const point = curve.getPoint(t), tangent = curve.getTangent(t); arrow.position.set(point.x, terrainY(point.x, point.z) + .34, point.z); arrow.rotation.y = Math.atan2(tangent.x, tangent.z); arrow.castShadow = false; return arrow; });
      routeModels.push({ a, b, curve, dashes, arrows, roadMaterial: roadMat, material: routeMat, status: 'locked' });
    }
    // Every landmark is an authored model with its own silhouette and materials.
    const camp = groupAt(...MAP_POSITIONS.camp); tent(camp, -1, -.15); tent(camp, .45, .05, .8); tent(camp, -.65, -1.8, .8); flag(camp, 1.35, .3, 2.1); crate(camp, .65, 0, 1.1); crate(camp, 1.18, 0, 1.1);
    const kitchen = new THREE.Group(), foundation = new THREE.Group(), scaffold = new THREE.Group(); camp.add(kitchen, foundation, scaffold);
    house(kitchen, 1.05, -1.65, 1.3, .85, 1, slate); box(foundation, 1.05, .06, -1.65, 1.45, .12, 1.3, soil);
    for (const x of [.43, 1.67]) for (const z of [-2.17, -1.13]) box(scaffold, x, .55, z, .06, 1, .06, timber); box(scaffold, 1.05, 1.08, -1.65, .07, .07, 1.2, timber);
    function updateKitchen(completed: boolean, started: boolean) { kitchen.visible = completed; foundation.visible = !completed; scaffold.visible = !completed && started; dirty = true; render(); }
    const cross = groupAt(...MAP_POSITIONS.crossing); cross.position.y = .32; cross.position.x = riverX(3.1);
    for (let i = 0; i < 15; i++) box(cross, -1.1 + i * .16, .18, 0, .145, .12, 1.1, wood);
    for (const z of [-.5, .5]) { box(cross, 0, .52, z, 2.5, .07, .065, timber); for (const x of [-1.1, -.35, .4, 1.15]) box(cross, x, .3, z, .075, .65, .075, timber); }
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) tree(-.8 + col * .87, 1.7 + row * .82, 1.05, col + row, true);
    const mill = groupAt(...MAP_POSITIONS.windmill); cylinder(mill, 0, .8, 0, .41, .7, 1.6, stone, 12); cylinder(mill, 0, 1.95, 0, 0, .7, .75, roof, 12); box(mill, 0, .27, .65, .33, .54, .035, timber);
    const sails = new THREE.Group(); sails.position.set(0, 1.42, .76); sails.rotation.z = .5; mill.add(sails);
    for (const r of [0, Math.PI / 2]) { const arm = new THREE.Group(); arm.rotation.z = r; sails.add(arm); box(arm, 0, 0, 0, .07, 2.7, .075, timber); for (const side of [-1, 1]) { box(arm, .12 * side, .8 * side, .04, .26, 1.05, .04, canvas); for (let j = 0; j < 6; j++) box(arm, .12 * side, (.37 + j * .17) * side, .065, .32, .028, .02, wood); } }
    const village = groupAt(...MAP_POSITIONS.village); house(village, -1.1, -.55, 1.05); house(village, .5, -.75, 1.1, 1); house(village, 1.1, .75, .85, .65, .85); house(village, -.6, 1, 1.1, .7); house(village, .1, -2, 1, 1.25, 1.4, slate); box(village, .1, 1.1, -2.2, .65, 2.2, .65, stone); cylinder(village, .1, 2.6, -2.2, 0, .55, .8, slate, 4);
    const depot = groupAt(...MAP_POSITIONS.depot); house(depot, 0, -.2, 2, .9, 1.25, slate); for (let i = 0; i < 5; i++) crate(depot, -.8 + i * .45, 0, 1.05, .4); crate(depot, -.5, .4, 1.05, .4); box(depot, 1.55, .38, .5, .8, .1, 1.1, wood); gable(depot, 1.55, .44, .5, .85, .43, 1, canvas); for (const x of [1.1, 2]) for (const z of [.13, .9]) { const wheel = cylinder(depot, x, .22, z, .2, .2, .08, timber); wheel.rotation.z = Math.PI / 2; }
    const redoubt = groupAt(...MAP_POSITIONS.redoubt);
    for (const z of [-.75, .75]) { box(redoubt, 0, .24, z, 2.8, .45, .35, soil); box(redoubt, 0, .49, z, 2.85, .1, .4, grass); }
    for (const x of [-1.25, 1.25]) { box(redoubt, x, .23, 0, .35, .45, 1.8, soil); box(redoubt, x, .49, 0, .4, .1, 1.8, grass); }
    for (const x of [-.65, .6]) { const barrel = cylinder(redoubt, x, .58, .58, .105, .14, .9, shadow); barrel.rotation.x = Math.PI / 2 - .15; for (const side of [-1, 1]) { const wheel = cylinder(redoubt, x + side * .22, .26, .24, .24, .24, .08, timber); wheel.rotation.z = Math.PI / 2; } }
    const fort = groupAt(...MAP_POSITIONS.fort);
    for (const z of [-1.1, 1.1]) box(fort, 0, .7, z, 3, 1.4, .4, darkStone);
    for (const x of [-1.3, 1.3]) box(fort, x, .7, 0, .4, 1.4, 2.3, darkStone);
    for (const x of [-1.35, 1.35]) for (const z of [-1.1, 1.1]) { cylinder(fort, x, 1, z, .5, .58, 2, stone, 12); for (let i = 0; i < 8; i++) box(fort, x + Math.cos(i * Math.PI / 4) * .43, 2.12, z + Math.sin(i * Math.PI / 4) * .43, .18, .25, .18, stone); }
    for (let i = 0; i < 9; i++) for (const z of [-1.1, 1.1]) box(fort, -1.15 + i * .28, 1.53, z, .14, .27, .43, darkStone);
    house(fort, 0, -.05, 1.25, 1.6, 1.2, slate); box(fort, 0, .48, 1.315, .66, .96, .025, shadow);
    for (let i = 0; i < 6; i++) box(fort, -.27 + i * .11, .47, 1.337, .035, .9, .035, wood);
    // Deterministic foliage avoids visual changes on reload or any gameplay RNG.
    let seed = 31873; const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 125; i++) { const x = (random() - .5) * 24.7, z = (random() - .5) * 16.8; if (Math.abs(x - riverX(z)) < 1.15 || Object.values(MAP_POSITIONS).some(([px, pz]) => Math.hypot(px - x, pz - z) < 2)) continue; tree(x, z, .75 + random() * .6, i); }
    for (const [x, z] of [[-11, -6], [3, 6], [10, 5]] as Array<[number, number]>) { const plot = groupAt(x, z); box(plot, 0, .03, 0, 2.3, .05, 1.5, soil); for (let i = 0; i < 8; i++) box(plot, -.97 + i * .28, .1, 0, .07, .11, 1.4, gold); }
    const ringGeometry = geometry(new THREE.TorusGeometry(1, .032, 6, 64));
    const selection = mesh(ringGeometry, material(0xf0ecd6)); selection.rotation.x = -Math.PI / 2; selection.scale.setScalar(1.72); selection.position.set(-9, terrainY(-9, 6) + .15, 6);
    const objective = mesh(ringGeometry, gold); objective.rotation.x = -Math.PI / 2; objective.scale.setScalar(2); objective.visible = false;
    const company = new THREE.Group(); models.add(company);
    const companyBase = cylinder(company, 0, .1, 0, .65, .7, .16, brass, 24);
    cylinder(company, 0, .2, 0, .52, .55, .08, shadow, 24);
    const guards: THREE.Group[] = [];
    function guard(parent: THREE.Object3D, x: number, z: number) {
      const soldier = new THREE.Group(); soldier.position.set(x, .22, z); parent.add(soldier);
      box(soldier, -.065, .13, 0, .07, .25, .085, shadow); box(soldier, .065, .13, 0, .07, .25, .085, shadow);
      box(soldier, 0, .35, 0, .22, .25, .15, scarlet); box(soldier, 0, .37, .083, .027, .26, .022, canvas);
      cylinder(soldier, 0, .55, 0, .078, .078, .13, wood, 8); cylinder(soldier, 0, .69, 0, .1, .09, .2, shadow, 8);
      box(soldier, .16, .43, 0, .028, .65, .028, timber); return soldier;
    }
    guards.push(guard(company, -.25, .1), guard(company, .23, .16), guard(company, -.05, -.23)); flag(company, .28, -.25, 1.8);
    const companyPoint = (id: string) => { const [x, z] = MAP_POSITIONS[id] || MAP_POSITIONS.camp; return new THREE.Vector3(x + 1.05, terrainY(x + 1.05, z + 1.12) + .12, z + 1.12); };
    company.position.copy(companyPoint(expedition?.currentNode || 'camp'));
    let journey: { curve: THREE.CatmullRomCurve3; began: number; destination: THREE.Vector3 } | null = null;
    let objectivePulse = -10;
    // Reusable action pieces are bounded, including during long shared sessions.
    const feedback = Array.from({ length: 6 }, () => {
      const root = new THREE.Group(); root.visible = false; models.add(root);
      const pulse = mesh(ringGeometry, gold, root); pulse.rotation.x = -Math.PI / 2;
      const wagon = new THREE.Group(); root.add(wagon); box(wagon, 0, .4, 0, .75, .15, 1.05, wood); gable(wagon, 0, .48, 0, .82, .45, 1, canvas);
      for (const x of [-.42, .42]) for (const z of [-.32, .32]) { const wheel = cylinder(wagon, x, .24, z, .21, .21, .065, timber); wheel.rotation.z = Math.PI / 2; }
      const scout = new THREE.Group(); root.add(scout); guard(scout, 0, 0); const glass = cylinder(scout, .08, .8, .15, .045, .045, .35, brass); glass.rotation.x = Math.PI / 2;
      const build = new THREE.Group(); root.add(build); crate(build, -.2, .05, 0, .48); crate(build, .28, .05, .12, .35); const hammer = new THREE.Group(); build.add(hammer); box(hammer, 0, .72, 0, .055, .75, .055, timber); box(hammer, 0, 1.08, 0, .4, .17, .16, darkStone);
      const banner = new THREE.Group(); root.add(banner); flag(banner, 0, 0, 1.6);
      return { root, pulse, wagon, scout, build, hammer, banner, began: -10, kind: '', start: new THREE.Vector3(), end: new THREE.Vector3() };
    });
    const pendingActions: Array<{ kind: string; nodeId: string }> = [];
    function react(kind: string, nodeId: string) {
      if (!animated() || !visible || document.hidden) return;
      const item = feedback.find(value => !value.root.visible);
      if (!item) { if (pendingActions.length < 120) pendingActions.push({ kind, nodeId }); return; }
      const [x, z] = MAP_POSITIONS[nodeId] || MAP_POSITIONS[expedition?.operation?.nodeId || 'camp'] || MAP_POSITIONS.camp;
      item.kind = kind; item.began = elapsed; item.end.set(x + .65, terrainY(x + .65, z + .8) + .15, z + .8); item.start.copy(company.position); item.root.position.copy(item.end); item.root.visible = true;
      item.wagon.visible = /escort|supply|supplies|contribut|packet|fund/.test(kind); item.scout.visible = /scout|recon/.test(kind); item.build.visible = /build|gather|material|project/.test(kind); item.banner.visible = !item.wagon.visible && !item.scout.visible && !item.build.visible;
      render();
    }
    function updateExpedition(state?: MapExpedition) {
      const previous = expedition; expedition = state;
      const owned = new Set(state?.owned || ['camp']), destination = state?.operation?.nodeId;
      for (const route of routeModels) {
        route.status = owned.has(route.a) && owned.has(route.b) ? 'secured' : owned.has(route.a) && route.b === destination ? 'active' : owned.has(route.a) ? 'available' : 'locked';
        route.material.color.setHex(route.status === 'secured' ? 0x95b184 : route.status === 'active' ? 0xffd778 : route.status === 'available' ? 0xe3cc93 : 0xb0ad89);
        route.material.opacity = route.status === 'locked' ? .7 : route.status === 'secured' ? .85 : 1;
        route.roadMaterial.opacity = route.status === 'locked' ? .5 : .95;
        route.arrows.forEach(arrow => { arrow.visible = route.status === 'active' || route.status === 'available'; });
        route.material.emissive.setHex(route.status === 'active' ? 0x8a4f0a : 0x000000); route.material.emissiveIntensity = .45;
      }
      objective.visible = !!destination && !!MAP_POSITIONS[destination];
      if (destination && MAP_POSITIONS[destination]) { const [x, z] = MAP_POSITIONS[destination]; objective.position.set(x, terrainY(x, z) + .18, z); if (previous?.operation?.nodeId !== destination) objectivePulse = elapsed; }
      const next = companyPoint(state?.currentNode || 'camp');
      if (previous?.currentNode !== state?.currentNode && animated() && ready) {
        const source = previous?.currentNode || 'camp', target = state?.currentNode || 'camp';
        const queue: string[][] = [[source]], visited = new Set([source]); let road: string[] = [];
        while (queue.length) {
          const candidate = queue.shift()!, last = candidate[candidate.length - 1]; if (last === target) { road = candidate; break; }
          for (const [a, b] of options.edges) { const neighbor = a === last ? b : b === last ? a : ''; if (neighbor && !visited.has(neighbor) && (owned.has(neighbor) || neighbor === target)) { visited.add(neighbor); queue.push([...candidate, neighbor]); } }
        }
        const waypoints = [company.position.clone()];
        for (let i = 1; i < road.length; i++) {
          const route = routeModels.find(value => value.a === road[i - 1] && value.b === road[i] || value.b === road[i - 1] && value.a === road[i]);
          if (route) for (const step of [.15, .35, .55, .75, .9]) waypoints.push(route.curve.getPoint(route.a === road[i - 1] ? step : 1 - step));
        }
        waypoints.push(next); journey = { curve: new THREE.CatmullRomCurve3(waypoints), began: elapsed, destination: next };
      } else if (!journey) company.position.copy(next);
      dirty = true; render();
    }
    function animate(delta: number) {
      elapsed += delta; sails.rotation.z += delta * .28;
      flags.forEach((value, i) => { value.rotation.y = Math.sin(elapsed * 2.5 + i * .9) * .22; value.rotation.x = Math.sin(elapsed * 3.4 + i) * .075; });
      crowns.forEach((value, i) => { value.rotation.z = Math.sin(elapsed * 1.1 + i * .7) * .018; });
      ripples.forEach((value, i) => { value.position.x = riverX(value.position.z) + Math.sin(elapsed * .8 + i) * .16; value.scale.x = .2 + (Math.sin(elapsed * 1.4 + i) + 1) * .13; });
      smoke.forEach(value => { const age = (elapsed * .2 + value.offset) % 1; value.mesh.position.set(value.x + age * .22 + Math.sin(elapsed + value.offset) * .035, value.y + age * .85, value.z + age * .12); value.mesh.scale.setScalar(.55 + age * 1.8); (value.mesh.material as THREE.MeshStandardMaterial).opacity = (1 - age) * .23; });
      objective.scale.setScalar(2 + Math.sin(elapsed * 2.1) * .065 + Math.max(0, 1 - (elapsed - objectivePulse) / 1.8) * .35);
      companyBase.rotation.y += delta * .04;
      if (journey) { const progress = Math.min(1, (elapsed - journey.began) / 2.7), eased = progress * progress * (3 - 2 * progress); company.position.copy(journey.curve.getPoint(eased)); company.position.y = terrainY(company.position.x, company.position.z) + .13; if (progress >= 1) { company.position.copy(journey.destination); journey = null; } }
      guards.forEach((value, i) => { value.position.y = .22 + (journey ? Math.abs(Math.sin(elapsed * 11 + i * 2)) * .1 : Math.sin(elapsed * 1.7 + i) * .014); value.rotation.z = journey ? Math.sin(elapsed * 11 + i * 2) * .1 : 0; });
      for (const item of feedback) {
        if (!item.root.visible) continue; const age = (elapsed - item.began) / 3.2;
        if (age >= 1) { item.root.visible = false; continue; }
        const envelope = Math.min(1, age * 8, (1 - age) * 7); item.root.scale.setScalar(envelope); item.pulse.scale.setScalar(.55 + age * 1.3); item.pulse.position.y = .06;
        if (item.wagon.visible || item.scout.visible) { item.root.position.copy(item.start).lerp(item.end, Math.min(1, age * 1.4)); item.root.position.y = terrainY(item.root.position.x, item.root.position.z) + .18; item.wagon.rotation.y = Math.atan2(item.end.x - item.start.x, item.end.z - item.start.z); item.scout.rotation.y = Math.sin(age * 8) * .7; }
        item.hammer.rotation.z = -.5 + Math.sin(age * 25) * .65; item.banner.rotation.y = Math.sin(age * 6) * .4;
      }
      while (pendingActions.length && feedback.some(item => !item.root.visible)) { const next = pendingActions.shift()!; react(next.kind, next.nodeId); }
    }
    function updateRoutes() {
      for (const route of routeModels) route.dashes.forEach((dash, i) => {
        const t = (i / route.dashes.length + (route.status === 'active' && animated() ? elapsed * .055 : 0)) % 1;
        const point = route.curve.getPoint(t), tangent = route.curve.getTangent(t); dash.position.set(point.x, terrainY(point.x, point.z) + .3, point.z); dash.rotation.y = Math.atan2(tangent.x, tangent.z); dash.visible = route.status !== 'locked' || i % 2 === 0;
      });
    }
    function render() {
      if (disposed || failed || frame || !visible || document.hidden) return;
      frame = requestAnimationFrame(draw);
    }
    function draw(time: number) {
      frame = 0; if (disposed || failed || !renderer || !visible || document.hidden) return;
      try {
        const width = host.clientWidth, height = host.clientHeight; if (!width || !height) return;
        const delta = lastTime ? Math.min(.05, (time - lastTime) / 1000) : 0; lastTime = time;
        if (animated()) animate(delta);
        updateRoutes();
        if (dirty || sizeDirty) {
          const ratio = width / height, half = Math.max(12.2, 17.2 / ratio) / zoom; camera.left = -half * ratio; camera.right = half * ratio; camera.top = half; camera.bottom = -half; camera.position.set(Math.sin(angle) * 34 + panX, 32, Math.cos(angle) * 34 + panZ); camera.lookAt(panX, .2, panZ); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
          if (sizeDirty) renderer.setSize(width, height, false);
          const pins: Record<string, { x: number; y: number }> = {}; for (const [id, [x, z]] of Object.entries(MAP_POSITIONS)) { const point = new THREE.Vector3(x, terrainY(x, z) + (id === 'fort' ? 3.5 : 2.5), z).project(camera); pins[id] = { x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2 }; } options.onPins(pins);
          dirty = false; sizeDirty = false;
        }
        renderer.render(scene, camera); if (!ready) { ready = true; options.onReady(); }
        if (animated()) render();
      } catch { failed = true; options.onFailure(); }
    }
    const requestView = () => { dirty = true; render(); };
    function setZoom(value: number) { zoom = THREE.MathUtils.clamp(value, .7, 2.6); options.onZoom?.(zoom); requestView(); }
    function pan(dx: number, dy: number) { const unit = (camera.top - camera.bottom) / Math.max(1, host.clientHeight); panX = THREE.MathUtils.clamp(panX - dx * unit * Math.cos(angle) - dy * unit * Math.sin(angle) * 1.45, -15, 15); panZ = THREE.MathUtils.clamp(panZ + dx * unit * Math.sin(angle) - dy * unit * Math.cos(angle) * 1.45, -12, 12); requestView(); }
    function reset() { angle = .68; panX = panZ = 0; setZoom(1); }
    function setMotion(enabled: boolean) { motion = enabled; lastTime = 0; if (!animated()) { pendingActions.length = 0; feedback.forEach(item => { item.root.visible = false; }); if (journey) { company.position.copy(journey.destination); journey = null; } guards.forEach(value => { value.position.y = .22; value.rotation.z = 0; }); } render(); }
    const pointers = new Map<number, { x: number; y: number; originX: number; originY: number }>();
    let dragging = false, suppressUntil = 0;
    const blocked = (event: Event) => (event.target as HTMLElement).closest?.('[data-map-controls]');
    const pointerDown = (event: PointerEvent) => { if (blocked(event) || (event.pointerType === 'mouse' && event.button !== 0)) return; if (!pointers.size) suppressUntil = 0; pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, originX: event.clientX, originY: event.clientY }); if (pointers.size > 1) dragging = true; };
    const pointerMove = (event: PointerEvent) => {
      const current = pointers.get(event.pointerId); if (!current) return;
      const before = [...pointers.values()], oldX = before.reduce((v, p) => v + p.x, 0) / before.length, oldY = before.reduce((v, p) => v + p.y, 0) / before.length, oldDistance = before.length === 2 ? Math.hypot(before[0].x - before[1].x, before[0].y - before[1].y) : 0;
      dragging ||= Math.hypot(event.clientX - current.originX, event.clientY - current.originY) > 5;
      current.x = event.clientX; current.y = event.clientY;
      if (!dragging) return; event.preventDefault(); interaction.setPointerCapture(event.pointerId); interaction.classList.add('is-dragging');
      const after = [...pointers.values()], newX = after.reduce((v, p) => v + p.x, 0) / after.length, newY = after.reduce((v, p) => v + p.y, 0) / after.length;
      pan(newX - oldX, newY - oldY); if (after.length === 2 && oldDistance > 0) setZoom(zoom * Math.hypot(after[0].x - after[1].x, after[0].y - after[1].y) / oldDistance);
    };
    const pointerUp = (event: PointerEvent) => { if (!pointers.has(event.pointerId)) return; pointers.delete(event.pointerId); if (dragging) suppressUntil = performance.now() + 400; if (interaction.hasPointerCapture(event.pointerId)) interaction.releasePointerCapture(event.pointerId); if (!pointers.size) { dragging = false; interaction.classList.remove('is-dragging'); } };
    const click = (event: MouseEvent) => { if (performance.now() < suppressUntil && !blocked(event) && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); } };
    const wheel = (event: WheelEvent) => { if (blocked(event)) return; event.preventDefault(); const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientHeight : 1); setZoom(zoom * Math.exp(-delta * .0012)); };
    const key = (event: KeyboardEvent) => { if (event.target !== interaction) return; const moves: Record<string, [number, number]> = { ArrowLeft: [35, 0], ArrowRight: [-35, 0], ArrowUp: [0, 35], ArrowDown: [0, -35] }; if (moves[event.key]) { event.preventDefault(); pan(...moves[event.key]); } else if (['+', '=', '-', '_', '0', 'Home'].includes(event.key)) { event.preventDefault(); if (event.key === '0' || event.key === 'Home') reset(); else setZoom(zoom * (event.key === '-' || event.key === '_' ? 1 / 1.15 : 1.15)); } };
    const visibilityChanged = () => { lastTime = 0; if (document.hidden || !visible) { cancelAnimationFrame(frame); frame = 0; pendingActions.length = 0; feedback.forEach(item => { item.root.visible = false; }); if (journey) { company.position.copy(journey.destination); journey = null; } } else render(); };
    const preferenceChanged = () => setMotion(motion);
    interaction.addEventListener('pointerdown', pointerDown); interaction.addEventListener('pointermove', pointerMove); interaction.addEventListener('pointerup', pointerUp); interaction.addEventListener('pointercancel', pointerUp); interaction.addEventListener('click', click, true); interaction.addEventListener('wheel', wheel, { passive: false }); interaction.addEventListener('keydown', key);
    document.addEventListener('visibilitychange', visibilityChanged); reducedMotion.addEventListener('change', preferenceChanged);
    observer = new ResizeObserver(() => { sizeDirty = true; render(); }); observer.observe(host);
    visibilityObserver = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? true; visibilityChanged(); }, { rootMargin: '60px' }); visibilityObserver.observe(host);
    const lost = (event: Event) => { event.preventDefault(); failed = true; cancelAnimationFrame(frame); frame = 0; options.onFailure(); }; renderer.domElement.addEventListener('webglcontextlost', lost);
    updateKitchen(options.completedKitchen, options.startedKitchen); updateExpedition(expedition); render();
    return { select: id => { const p = MAP_POSITIONS[id]; if (p) { selection.position.set(p[0], terrainY(...p) + .15, p[1]); render(); } }, turn: direction => { angle = THREE.MathUtils.clamp(angle + direction * .16, -.8, 1.8); requestView(); }, zoom: direction => setZoom(zoom * (direction > 0 ? 1.18 : 1 / 1.18)), reset, setMotion, updateExpedition, updateKitchen, react,
      dispose: () => { disposed = true; cancelAnimationFrame(frame); observer?.disconnect(); visibilityObserver?.disconnect(); interaction.removeEventListener('pointerdown', pointerDown); interaction.removeEventListener('pointermove', pointerMove); interaction.removeEventListener('pointerup', pointerUp); interaction.removeEventListener('pointercancel', pointerUp); interaction.removeEventListener('click', click, true); interaction.removeEventListener('wheel', wheel); interaction.removeEventListener('keydown', key); interaction.classList.remove('is-dragging'); document.removeEventListener('visibilitychange', visibilityChanged); reducedMotion.removeEventListener('change', preferenceChanged); resources.forEach(r => r.dispose()); sun.shadow.dispose(); renderer?.domElement.removeEventListener('webglcontextlost', lost); renderer?.dispose(); renderer?.domElement.remove(); } };
  } catch { resources.forEach(r => r.dispose()); renderer?.dispose(); renderer?.domElement.remove(); options.onFailure(); const noop = () => {}; return { select: noop, turn: noop, zoom: noop, reset: noop, setMotion: noop, updateExpedition: noop, updateKitchen: noop, react: noop, dispose: noop }; }
}
