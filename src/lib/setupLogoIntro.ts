import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  BufferGeometry,
  DirectionalLight,
  Group,
  Material,
  Mesh,
  PMREMGenerator,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const INTRO_DURATION_MS = 3600;
const REDUCED_MOTION_DURATION_MS = 1500;

type IntroResources = {
  geometries: Set<BufferGeometry>;
  materials: Set<Material>;
};

function markDisposableMesh(mesh: Mesh, resources: IntroResources) {
  resources.geometries.add(mesh.geometry);

  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((material) => resources.materials.add(material));
    return;
  }

  if (mesh.material) {
    resources.materials.add(mesh.material);
  }
}

function getFacingRotation(size: Vector3) {
  if (size.y <= size.x && size.y <= size.z) {
    return new Vector3(Math.PI / 2, 0, 0);
  }

  if (size.x <= size.y && size.x <= size.z) {
    return new Vector3(0, Math.PI / 2, 0);
  }

  return new Vector3(0, 0, 0);
}

async function loadLogo(resources: IntroResources) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync("/nabi-logo-3d.glb");
  const logo = gltf.scene;

  const initialBox = new Box3().setFromObject(logo);
  const initialSize = initialBox.getSize(new Vector3());
  const facingRotation = getFacingRotation(initialSize);
  const initialMaxAxis = Math.max(initialSize.x, initialSize.y, initialSize.z) || 1;

  logo.rotation.set(facingRotation.x, facingRotation.y, facingRotation.z);
  logo.scale.setScalar(1.5 / initialMaxAxis);
  logo.updateMatrixWorld(true);

  const box = new Box3().setFromObject(logo);
  const center = box.getCenter(new Vector3());

  logo.position.sub(center);
  logo.updateMatrixWorld(true);

  logo.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return;
    }

    markDisposableMesh(child, resources);
  });

  return logo;
}

export function setupLogoIntro() {
  const loader = document.getElementById("loader");
  const canvas = document.getElementById("loaderLogoCanvas") as HTMLCanvasElement | null;

  if (!loader || !canvas) {
    return () => undefined;
  }

  const resources: IntroResources = {
    geometries: new Set(),
    materials: new Set(),
  };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const touchDevice = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  const maxPixelRatio = touchDevice ? 0.85 : 1.5;
  const introDuration = reducedMotion ? REDUCED_MOTION_DURATION_MS : INTRO_DURATION_MS;
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: !touchDevice,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  const scene = new Scene();
  const camera = new PerspectiveCamera(28, 1, 0.1, 100);
  const logoGroup = new Group();
  const ambient = new AmbientLight("#ffffff", 3.2);
  const keyLight = new DirectionalLight("#ffffff", 2.8);
  const rimLight = new DirectionalLight("#ffffff", 1.9);
  const pmremGenerator = new PMREMGenerator(renderer);
  const roomEnvironment = new RoomEnvironment();
  const environmentTarget = pmremGenerator.fromScene(roomEnvironment, 0.04);
  roomEnvironment.dispose();

  let destroyed = false;
  let frameId = 0;
  let startedAt = 0;
  let hideTimeout = 0;
  let fallbackTimeout = 0;
  let exitStarted = false;
  let rendererReleased = false;

  const releaseRenderer = () => {
    if (rendererReleased) {
      return;
    }

    rendererReleased = true;
    destroyed = true;
    window.cancelAnimationFrame(frameId);
    scene.environment = null;
    resources.geometries.forEach((geometry) => geometry.dispose());
    resources.materials.forEach((material) => material.dispose());
    environmentTarget.dispose();
    pmremGenerator.dispose();
    renderer.renderLists.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.width = 1;
    canvas.height = 1;
    canvas.replaceWith(canvas.cloneNode(false));
  };

  document.body.classList.add("intro-lock");

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
  renderer.setClearColor(0x000000, 0);
  scene.environment = environmentTarget.texture;

  camera.position.set(0, 0, 6.8);
  keyLight.position.set(2.4, 1.6, 4.6);
  rimLight.position.set(-2, 0.9, 3.6);

  scene.add(ambient);
  scene.add(keyLight);
  scene.add(rimLight);
  scene.add(logoGroup);

  const resize = () => {
    const { clientWidth, clientHeight } = loader;
    if (!clientWidth || !clientHeight) {
      return;
    }

    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight, false);
  };

  const beginExit = () => {
    if (exitStarted) {
      return;
    }

    exitStarted = true;
    loader.classList.add("is-exiting");
    hideTimeout = window.setTimeout(() => {
      loader.classList.add("is-hidden");
      document.body.classList.remove("intro-lock");
      document.body.classList.add("intro-complete");
      window.removeEventListener("resize", resize);
      releaseRenderer();
    }, reducedMotion ? 260 : 720);
  };

  const animate = (timestamp: number) => {
    if (destroyed) {
      return;
    }

    if (!startedAt) {
      startedAt = timestamp;
      loader.classList.add("is-ready");
    }

    const progress = Math.min(1, (timestamp - startedAt) / introDuration);
    const spin = progress * Math.PI * 2;

    logoGroup.position.set(0, 0, 0);
    logoGroup.rotation.set(spin, 0, 0);
    logoGroup.scale.setScalar(1);

    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);

    if (progress >= 1) {
      beginExit();
      return;
    }

    frameId = window.requestAnimationFrame(animate);
  };

  fallbackTimeout = window.setTimeout(beginExit, reducedMotion ? 1200 : 4200);

  loadLogo(resources)
    .then((logo) => {
      if (destroyed) {
        return;
      }

      window.clearTimeout(fallbackTimeout);
      logoGroup.add(logo);
      frameId = window.requestAnimationFrame(animate);
    })
    .catch(() => {
      if (destroyed) {
        return;
      }

      beginExit();
    });

  window.addEventListener("resize", resize);
  resize();

  return () => {
    destroyed = true;
    window.cancelAnimationFrame(frameId);
    window.clearTimeout(hideTimeout);
    window.clearTimeout(fallbackTimeout);
    window.removeEventListener("resize", resize);
    document.body.classList.remove("intro-lock");
    releaseRenderer();
  };
}
