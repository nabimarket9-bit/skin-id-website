import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  BufferGeometry,
  DirectionalLight,
  Material,
  Mesh,
  Object3D,
  PMREMGenerator,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type FaceScanResources = {
  geometries: Set<BufferGeometry>;
  materials: Set<Material>;
};

function markDisposableMesh(mesh: Mesh, resources: FaceScanResources) {
  resources.geometries.add(mesh.geometry);

  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((material) => resources.materials.add(material));
    return;
  }

  if (mesh.material) {
    resources.materials.add(mesh.material);
  }
}

function frameCamera(camera: PerspectiveCamera, object: Object3D, viewport: HTMLElement) {
  const bounds = new Box3().setFromObject(object);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z) || 1;
  const fovRadians = (camera.fov * Math.PI) / 180;
  const fitHeightDistance = maxDimension / (2 * Math.tan(fovRadians / 2));
  const fitWidthDistance = fitHeightDistance / Math.max(camera.aspect, 0.5);
  const distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.14;

  camera.near = Math.max(0.01, maxDimension / 100);
  camera.far = Math.max(100, maxDimension * 20);
  camera.position.set(center.x, center.y, center.z + distance);
  camera.lookAt(center);
  camera.updateProjectionMatrix();

  viewport.style.setProperty("--face-model-ready", "1");
}

export function setupFaceScanModel() {
  const viewport = document.querySelector<HTMLElement>(".scene-scan .face-visual");
  const canvas = document.getElementById("faceModelCanvas") as HTMLCanvasElement | null;

  if (!viewport || !canvas) {
    return () => undefined;
  }

  const resources: FaceScanResources = {
    geometries: new Set(),
    materials: new Set(),
  };
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new Scene();
  const camera = new PerspectiveCamera(22, 1, 0.01, 1000);
  const ambient = new AmbientLight("#ffffff", 2.2);
  const keyLight = new DirectionalLight("#ffffff", 2.6);
  const fillLight = new DirectionalLight("#d7ecff", 1.6);
  const rimLight = new DirectionalLight("#ffe7a3", 1.15);
  const pmremGenerator = new PMREMGenerator(renderer);
  const environmentTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.05);
  const loader = new GLTFLoader();
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let model: Object3D | null = null;
  let destroyed = false;
  let frameId = 0;
  let baseY = 0;
  let baseRotationX = 0;
  let baseRotationY = 0;

  scene.environment = environmentTarget.texture;
  keyLight.position.set(1.8, 1.3, 3.4);
  fillLight.position.set(-1.6, 0.5, 2.8);
  rimLight.position.set(0.4, 1.2, -2.4);

  scene.add(ambient);
  scene.add(keyLight);
  scene.add(fillLight);
  scene.add(rimLight);

  const renderFrame = () => {
    renderer.render(scene, camera);
  };

  const animate = (time: number) => {
    if (destroyed) {
      return;
    }

    if (model && !prefersReducedMotion) {
      const drift = time * 0.001;
      model.position.y = baseY + Math.sin(drift * 1.15) * 0.028;
      model.rotation.x = baseRotationX + Math.sin(drift * 0.7) * 0.018;
      model.rotation.y = baseRotationY + Math.sin(drift * 0.9) * 0.028;
    }

    renderFrame();
    frameId = window.requestAnimationFrame(animate);
  };

  const resize = () => {
    const { clientWidth, clientHeight } = viewport;

    if (!clientWidth || !clientHeight) {
      return;
    }

    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(clientWidth, clientHeight, false);

    if (model) {
      frameCamera(camera, model, viewport);
      renderFrame();
    }
  };

  void loader
    .loadAsync("/face.glb")
    .then((gltf) => {
      if (destroyed) {
        return;
      }

      model = gltf.scene;
      model.traverse((child) => {
        if (child instanceof Mesh) {
          markDisposableMesh(child, resources);
        }
      });

      scene.add(model);
      baseY = model.position.y;
      baseRotationX = model.rotation.x;
      baseRotationY = model.rotation.y;
      resize();
      frameId = window.requestAnimationFrame(animate);
    })
    .catch(() => undefined);

  window.addEventListener("resize", resize);
  resize();

  return () => {
    destroyed = true;
    window.cancelAnimationFrame(frameId);
    window.removeEventListener("resize", resize);
    renderer.dispose();
    renderer.forceContextLoss();
    environmentTarget.dispose();
    pmremGenerator.dispose();
    resources.geometries.forEach((geometry) => geometry.dispose());
    resources.materials.forEach((material) => material.dispose());
  };
}
