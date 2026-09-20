import * as THREE from 'three';

export type CoinControls = { reset: () => void; setMotion: (enabled: boolean) => void; dispose: () => void };

export function createCoinScene(host: HTMLElement, source: string, ready: () => void, failure: () => void): CoinControls {
  let renderer: THREE.WebGLRenderer | undefined;
  let disposed = false, frame = 0, loaded = false, motion = false, previousFrame = 0;
  let drag: { id: number; x: number; y: number } | null = null;
  let observer: ResizeObserver | undefined;
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const coin = new THREE.Group();
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1.2, 1.2, 1.2, -1.2, .1, 20);
  camera.position.set(0, 0, 5);
  const image = new Image();
  image.decoding = 'async';

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    observer?.disconnect();
    image.onload = image.onerror = null;
    host.removeEventListener('pointerdown', down);
    host.removeEventListener('pointermove', move);
    host.removeEventListener('pointerup', end);
    host.removeEventListener('pointercancel', end);
    host.removeEventListener('lostpointercapture', end);
    host.removeEventListener('keydown', key);
    document.removeEventListener('visibilitychange', visibility);
    renderer?.domElement.removeEventListener('webglcontextlost', lost);
    geometries.forEach(value => value.dispose());
    materials.forEach(value => value.dispose());
    textures.forEach(value => value.dispose());
    renderer?.dispose();
    renderer?.domElement.remove();
  }
  function fail() { dispose(); failure(); }
  function lost(event: Event) { event.preventDefault(); fail(); }
  function render(time: number) {
    frame = 0;
    if (disposed || !loaded) return;
    if (motion && !drag && document.visibilityState === 'visible') {
      const elapsed = previousFrame ? Math.min(40, time - previousFrame) : 16;
      coin.rotation.y += elapsed * .00042;
    }
    previousFrame = time;
    try { renderer?.render(scene, camera); } catch { fail(); return; }
    if (motion && document.visibilityState === 'visible') frame = requestAnimationFrame(render);
  }
  function draw() {
    if (disposed || frame || !loaded) return;
    frame = requestAnimationFrame(render);
  }
  function setMotion(enabled: boolean) { motion = enabled; previousFrame = 0; if (!motion && frame) { cancelAnimationFrame(frame); frame = 0; } draw(); }
  function visibility() { if (document.visibilityState === 'visible') draw(); else if (frame) { cancelAnimationFrame(frame); frame = 0; previousFrame = 0; } }
  function reset() { coin.rotation.set(.06, -.16, -.1); draw(); }
  function down(event: PointerEvent) {
    if (!loaded || drag || !event.isPrimary || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    host.setPointerCapture(event.pointerId);
    if (event.pointerType === 'mouse') host.focus({ preventScroll: true });
  }
  function move(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.id) return;
    coin.rotation.y += (event.clientX - drag.x) * .015;
    // Vertical touch gestures belong to page scrolling, not the coin.
    if (event.pointerType !== 'touch') coin.rotation.x = THREE.MathUtils.clamp(coin.rotation.x + (event.clientY - drag.y) * .012, -1.15, 1.15);
    drag.x = event.clientX; drag.y = event.clientY;
    draw();
  }
  function end(event: PointerEvent) {
    if (drag?.id !== event.pointerId) return;
    drag = null;
    if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
  }
  function key(event: KeyboardEvent) {
    if (!loaded || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') { reset(); return; }
    if (event.key === 'ArrowLeft') coin.rotation.y -= .25;
    if (event.key === 'ArrowRight') coin.rotation.y += .25;
    if (event.key === 'ArrowUp') coin.rotation.x = Math.max(-1.15, coin.rotation.x - .15);
    if (event.key === 'ArrowDown') coin.rotation.x = Math.min(1.15, coin.rotation.x + .15);
    draw();
  }
  const geometry = <T extends THREE.BufferGeometry>(value: T) => { geometries.push(value); return value; };
  const material = <T extends THREE.Material>(value: T) => { materials.push(value); return value; };

  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.addEventListener('webglcontextlost', lost);
    host.append(renderer.domElement);
    scene.add(coin);
    scene.add(new THREE.AmbientLight(0xfff4dd, 1.5));
    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.1);
    keyLight.position.set(-3, 4, 5); scene.add(keyLight);
    const fill = new THREE.DirectionalLight(0xf2f5ff, 1.2);
    fill.position.set(4, -1, 2); scene.add(fill);
    const backLight = new THREE.DirectionalLight(0xffdf9e, 1.8);
    backLight.position.set(-2, 2, -4); scene.add(backLight);

    image.onload = () => {
      if (disposed) return;
      try {
        const faceCanvas = document.createElement('canvas');
        faceCanvas.width = image.naturalWidth; faceCanvas.height = image.naturalHeight;
        const faceContext = faceCanvas.getContext('2d', { willReadFrequently: true });
        if (!faceContext) throw new Error('Image preparation unavailable');
        faceContext.drawImage(image, 0, 0);
        const pixels = faceContext.getImageData(0, 0, faceCanvas.width, faceCanvas.height).data;
        let left = faceCanvas.width, top = faceCanvas.height, right = 0, bottom = 0;
        for (let y = 0; y < faceCanvas.height; y++) for (let x = 0; x < faceCanvas.width; x++) {
          if (pixels[(y * faceCanvas.width + x) * 4 + 3] > 180) {
            left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
          }
        }
        if (right <= left || bottom <= top) throw new Error('Empty coin artwork');
        // Remove transparent padding so the artwork meets the solid gold edge.
        faceContext.fillStyle = '#b18a41';
        faceContext.fillRect(0, 0, faceCanvas.width, faceCanvas.height);
        faceContext.drawImage(image, left, top, right - left + 1, bottom - top + 1, 0, 0, faceCanvas.width, faceCanvas.height);
        const faceTexture = new THREE.CanvasTexture(faceCanvas);
        faceTexture.colorSpace = THREE.SRGBColorSpace;
        faceTexture.anisotropy = Math.min(4, renderer!.capabilities.getMaxAnisotropy());
        textures.push(faceTexture);
        const faceMaterial = material(new THREE.MeshPhongMaterial({ map: faceTexture, color: 0xffffff, specular: 0x665027, shininess: 28 }));
        const faceGeometry = geometry(new THREE.CircleGeometry(.994, 128));
        for (const direction of [1, -1]) {
          // Reuse approved artwork on both faces, with readable reverse lettering.
          const face = new THREE.Mesh(faceGeometry, faceMaterial);
          face.position.z = direction * .067;
          if (direction < 0) face.rotation.y = Math.PI;
          coin.add(face);
        }
        const edgeCanvas = document.createElement('canvas');
        edgeCanvas.width = 512; edgeCanvas.height = 16;
        const edgeContext = edgeCanvas.getContext('2d')!;
        for (let x = 0; x < 512; x++) {
          const shade = x % 4;
          edgeContext.fillStyle = ['#76521c', '#ad813a', '#e4bc70', '#b58b43'][shade];
          edgeContext.fillRect(x, 0, 1, 16);
        }
        const edgeTexture = new THREE.CanvasTexture(edgeCanvas);
        edgeTexture.colorSpace = THREE.SRGBColorSpace;
        textures.push(edgeTexture);
        const edgeMaterial = material(new THREE.MeshPhongMaterial({ map: edgeTexture, color: 0xffffff, specular: 0xa2793b, shininess: 45 }));
        const edge = new THREE.Mesh(geometry(new THREE.CylinderGeometry(1, 1, .12, 128, 1, true)), edgeMaterial);
        edge.rotation.x = Math.PI / 2;
        coin.add(edge);
        const rimMaterial = material(new THREE.MeshPhongMaterial({ color: 0xc39a4e, specular: 0xffd98e, shininess: 55 }));
        const rimGeometry = geometry(new THREE.TorusGeometry(.987, .014, 8, 128));
        for (const z of [-.06, .06]) { const rim = new THREE.Mesh(rimGeometry, rimMaterial); rim.position.z = z; coin.add(rim); }
        loaded = true;
        reset();
        renderer!.render(scene, camera);
        ready();
      } catch { fail(); }
    };
    image.onerror = fail;
    observer = new ResizeObserver(() => {
      if (disposed) return;
      const size = Math.round(host.clientWidth);
      if (size > 0) { renderer!.setSize(size, size, false); draw(); }
    });
    observer.observe(host);
    renderer.setSize(Math.max(1, host.clientWidth), Math.max(1, host.clientWidth), false);
    host.addEventListener('pointerdown', down);
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerup', end);
    host.addEventListener('pointercancel', end);
    host.addEventListener('lostpointercapture', end);
    host.addEventListener('keydown', key);
    document.addEventListener('visibilitychange', visibility);
    image.src = source;
  } catch { fail(); }
  return { reset, setMotion, dispose };
}
