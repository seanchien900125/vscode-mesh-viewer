import {
  AmbientLight,
  Box3,
  BufferGeometry,
  Color,
  DoubleSide,
  DirectionalLight,
  Uint32BufferAttribute,
  Float32BufferAttribute,
  FrontSide,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshPhongMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DecodedMeshData, decodeTransferredMesh, TransferredMeshData } from '../src/meshDataTransfer';

// VS Code webview API (injected by VS Code at runtime)
declare const acquireVsCodeApi: () => { postMessage(data: unknown): void };

type DisplayMode =
  | 'solid'
  | 'surface-wireframe'
  | 'mesh-wireframe'
  | 'solid+surface-wireframe'
  | 'solid+mesh-wireframe';

// Show fatal init error without relying on any DOM refs
function showFatal(msg: string): void {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '50%';
  container.style.left = '50%';
  container.style.transform = 'translate(-50%, -50%)';
  container.style.background = '#c0392b';
  container.style.color = '#fff';
  container.style.padding = '20px 28px';
  container.style.borderRadius = '6px';
  container.style.fontFamily = 'monospace';
  container.style.fontSize = '13px';
  container.style.maxWidth = '80vw';
  container.style.wordBreak = 'break-all';
  container.textContent = msg;

  document.body.replaceChildren(container);
}

let renderer: WebGLRenderer;
let scene: Scene;
let camera: PerspectiveCamera;
let controls: OrbitControls;
let solidMesh: Mesh | null = null;
let surfaceWireframeMesh: LineSegments | null = null;
let elementWireframeMesh: LineSegments | null = null;
let currentMode: DisplayMode = 'solid+surface-wireframe';
let currentColor = '#4a90d9';
let currentShellOpacity = 0.9;
let currentHasVolumeElements = false;
let statusEl: HTMLElement;
let errorEl: HTMLElement;

function setStatus(message: string): void {
  statusEl.textContent = message;
}

function showError(message: string): void {
  errorEl.textContent = message;
  errorEl.style.display = 'block';
  setStatus('Failed to load');
}

function updateMaterialState(): void {
  if (solidMesh) {
    const material = solidMesh.material as MeshPhongMaterial;

    material.side = currentHasVolumeElements ? FrontSide : DoubleSide;
    material.transparent = currentShellOpacity < 1 || !currentHasVolumeElements;
    material.opacity = currentShellOpacity;
    material.depthWrite = true;
    material.needsUpdate = true;
  }

  if (surfaceWireframeMesh) {
    const material = surfaceWireframeMesh.material as LineBasicMaterial;
    material.depthTest = true;
    material.opacity = 0.95;
    material.needsUpdate = true;
  }

  if (elementWireframeMesh) {
    const material = elementWireframeMesh.material as LineBasicMaterial;
    material.depthTest = true;
    material.opacity = 0.9;
    material.needsUpdate = true;
  }
}

try {
  // --- VS Code API ---
  const vscode = acquireVsCodeApi();

  // --- DOM refs ---
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  statusEl = document.getElementById('status')!;
  errorEl  = document.getElementById('error')!;
  const colorPicker = document.getElementById('colorPicker') as HTMLInputElement;
  const modeSelect  = document.getElementById('modeSelect') as HTMLSelectElement;
  const opacitySlider = document.getElementById('opacitySlider') as HTMLInputElement;
  const opacityValue = document.getElementById('opacityValue') as HTMLSpanElement;

  setStatus('Initializing viewer...');

  function syncOpacityLabel(): void {
    opacityValue.textContent = `${Math.round(currentShellOpacity * 100)}%`;
  }

  currentShellOpacity = Number.parseFloat(opacitySlider.value);
  syncOpacityLabel();

  // --- Renderer ---
  renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  // --- Scene ---
  scene = new Scene();
  scene.background = new Color(0x1e1e1e);

  // --- Camera ---
  camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.001, 100000);
  camera.position.set(0, 0, 5);

  // --- Controls ---
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  // --- Lighting ---
  scene.add(new AmbientLight(0xffffff, 0.5));
  const dl1 = new DirectionalLight(0xffffff, 1.0);
  dl1.position.set(1, 2, 3);
  scene.add(dl1);
  const dl2 = new DirectionalLight(0xffffff, 0.3);
  dl2.position.set(-2, -1, -1);
  scene.add(dl2);

  // --- Helpers ---
  function disposeCurrent(): void {
    if (solidMesh) {
      scene.remove(solidMesh);
      solidMesh.geometry.dispose();
      (solidMesh.material as Material).dispose();
      solidMesh = null;
    }
    if (surfaceWireframeMesh) {
      scene.remove(surfaceWireframeMesh);
      surfaceWireframeMesh.geometry.dispose();
      (surfaceWireframeMesh.material as Material).dispose();
      surfaceWireframeMesh = null;
    }
    if (elementWireframeMesh) {
      scene.remove(elementWireframeMesh);
      elementWireframeMesh.geometry.dispose();
      (elementWireframeMesh.material as Material).dispose();
      elementWireframeMesh = null;
    }
  }

  function applyDisplayMode(): void {
    updateMaterialState();

    if (solidMesh) {
      scene.remove(solidMesh);
    }
    if (surfaceWireframeMesh) {
      scene.remove(surfaceWireframeMesh);
    }
    if (elementWireframeMesh) {
      scene.remove(elementWireframeMesh);
    }

    switch (currentMode) {
      case 'solid':
        if (solidMesh) {
          scene.add(solidMesh);
        }
        break;
      case 'surface-wireframe':
        if (surfaceWireframeMesh) {
          scene.add(surfaceWireframeMesh);
        }
        break;
      case 'mesh-wireframe':
        if (elementWireframeMesh) {
          scene.add(elementWireframeMesh);
        } else if (surfaceWireframeMesh) {
          scene.add(surfaceWireframeMesh);
        }
        break;
      case 'solid+surface-wireframe':
        if (solidMesh) {
          scene.add(solidMesh);
        }
        if (surfaceWireframeMesh) {
          scene.add(surfaceWireframeMesh);
        }
        break;
      case 'solid+mesh-wireframe':
        if (solidMesh) {
          scene.add(solidMesh);
        }
        if (elementWireframeMesh) {
          scene.add(elementWireframeMesh);
        } else if (surfaceWireframeMesh) {
          scene.add(surfaceWireframeMesh);
        }
        break;
    }
  }

  function setupMesh(data: DecodedMeshData): void {
    let nextSolidMesh: Mesh | null = null;
    let nextSurfaceWireframeMesh: LineSegments | null = null;
    let nextElementWireframeMesh: LineSegments | null = null;

    try {
      const positionAttribute = new Float32BufferAttribute(data.vertices, 3);

      if (data.indices.length > 0) {
        const hasVolumeElements = data.elementCounts.tetrahedra > 0 || data.elementCounts.hexahedra > 0;
        currentHasVolumeElements = hasVolumeElements;
        const surfaceGeometry = new BufferGeometry();
        surfaceGeometry.setAttribute('position', positionAttribute);
        surfaceGeometry.setIndex(new Uint32BufferAttribute(data.indices, 1));
        surfaceGeometry.computeVertexNormals();

        nextSolidMesh = new Mesh(surfaceGeometry, new MeshPhongMaterial({
          color: new Color(currentColor),
          side: hasVolumeElements ? FrontSide : DoubleSide,
          shininess: 40,
          specular: new Color(0x222222),
          transparent: !hasVolumeElements,
          opacity: currentShellOpacity,
          depthWrite: true,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1
        }));
      } else {
        currentHasVolumeElements = false;
      }

      if (data.surfaceEdgeIndices.length > 0) {
        const surfaceEdgeGeometry = new BufferGeometry();
        surfaceEdgeGeometry.setAttribute('position', positionAttribute);
        surfaceEdgeGeometry.setIndex(new Uint32BufferAttribute(data.surfaceEdgeIndices, 1));
        nextSurfaceWireframeMesh = new LineSegments(
          surfaceEdgeGeometry,
          new LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.95, depthTest: true })
        );
      }

      if (data.edgeIndices.length > 0) {
        const elementEdgeGeometry = new BufferGeometry();
        elementEdgeGeometry.setAttribute('position', positionAttribute);
        elementEdgeGeometry.setIndex(new Uint32BufferAttribute(data.edgeIndices, 1));
        nextElementWireframeMesh = new LineSegments(
          elementEdgeGeometry,
          new LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.9, depthTest: true })
        );
      }

      const bounds = new Box3().setFromBufferAttribute(positionAttribute);

      disposeCurrent();
      solidMesh = nextSolidMesh;
      surfaceWireframeMesh = nextSurfaceWireframeMesh;
      elementWireframeMesh = nextElementWireframeMesh;

      applyDisplayMode();

      const center = bounds.getCenter(new Vector3());
      const size = bounds.getSize(new Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      if (solidMesh) {
        solidMesh.position.set(-center.x, -center.y, -center.z);
      }
      if (surfaceWireframeMesh) {
        surfaceWireframeMesh.position.set(-center.x, -center.y, -center.z);
      }
      if (elementWireframeMesh) {
        elementWireframeMesh.position.set(-center.x, -center.y, -center.z);
      }

      const safeMaxDim = Math.max(maxDim, 1);
      camera.near = Math.max(safeMaxDim * 0.0001, 0.001);
      camera.far  = Math.max(safeMaxDim * 200, 1000);
      camera.position.set(0, 0, safeMaxDim * 2.2);
      camera.updateProjectionMatrix();
      controls.target.set(0, 0, 0);
      controls.update();

      const triCount = data.indices.length / 3;
      const surfaceEdgeCount = data.surfaceEdgeIndices.length / 2;
      const edgeCount = data.edgeIndices.length / 2;
      const vtxCount = data.vertices.length / 3;
      const cellSummary = [
        data.elementCounts.tetrahedra > 0 ? `${data.elementCounts.tetrahedra.toLocaleString()} tetrahedra` : '',
        data.elementCounts.hexahedra > 0 ? `${data.elementCounts.hexahedra.toLocaleString()} hexahedra` : '',
        data.elementCounts.triangles > 0 ? `${data.elementCounts.triangles.toLocaleString()} triangles` : '',
        data.elementCounts.quadrilaterals > 0 ? `${data.elementCounts.quadrilaterals.toLocaleString()} quads` : ''
      ].filter(Boolean).join(' · ');

      setStatus(
        `${vtxCount.toLocaleString()} vertices · ${triCount.toLocaleString()} surface triangles · ${surfaceEdgeCount.toLocaleString()} surface edges · ${edgeCount.toLocaleString()} mesh edges${cellSummary ? ` · ${cellSummary}` : ''}`
      );
    } catch (err) {
      nextSolidMesh?.geometry.dispose();
      (nextSolidMesh?.material as Material | undefined)?.dispose();
      nextSurfaceWireframeMesh?.geometry.dispose();
      (nextSurfaceWireframeMesh?.material as Material | undefined)?.dispose();
      nextElementWireframeMesh?.geometry.dispose();
      (nextElementWireframeMesh?.material as Material | undefined)?.dispose();
      showError(`Render error: ${err}`);
    }
  }

  // --- UI handlers ---
  colorPicker.addEventListener('input', () => {
    currentColor = colorPicker.value;
    if (solidMesh) {
      (solidMesh.material as MeshPhongMaterial).color.set(currentColor);
    }
  });
  opacitySlider.addEventListener('input', () => {
    currentShellOpacity = Number.parseFloat(opacitySlider.value);
    syncOpacityLabel();
    updateMaterialState();
  });
  modeSelect.addEventListener('change', () => {
    currentMode = modeSelect.value as DisplayMode;
    applyDisplayMode();
  });

  // --- Resize ---
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // --- Messages from extension host ---
  window.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data as { type: string; data?: TransferredMeshData; message?: string };
    const transferredData = msg.data;

    if (msg.type === 'meshData' && transferredData) {
      setStatus('Building geometry...');
      setTimeout(() => setupMesh(decodeTransferredMesh(transferredData)), 10);
    } else if (msg.type === 'status' && msg.message) {
      setStatus(msg.message);
    } else if (msg.type === 'error') {
      showError(`Parse error: ${msg.message}`);
    }
  });

  // --- Animation loop ---
  (function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  })();

  setStatus('Requesting mesh data...');
  vscode.postMessage({ type: 'ready' });

} catch (err) {
  showFatal(`Init error: ${err}`);
}
