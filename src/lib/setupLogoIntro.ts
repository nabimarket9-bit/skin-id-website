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
  Texture,
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
  textures: Set<Texture>;
};

function markDisposableMesh(mesh: Mesh, resources: IntroResources) {
  resources.geometries.add(mesh.geometry);

  const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];

  materials.forEach((material) => {
    resources.materials.add(material);

    Object.values(material).forEach((value) => {
      if (value instanceof Texture) {
        resources.textures.add(value);
      }
    });
  });
}

function resetLoaderState(loader: HTMLElement) {
  loader.classList.remove("is-ready", "is-exiting", "is-hidden", "is-fallback");
}

function hideLoader(loader: HTMLElement) {
  loader.classList.add("is-hidden");
  document.body.classList.remove("intro-lock");
  document.body.classList.add("intro-complete");
}

function isTouchDevice() {
  return window.matchMedia("(hover: none), (pointer: coarse)").matches;
}

function getMaxPixelRatio(touchDevice: boolean) {
  return touchDevice ? 1 : 1.5;
}

function getPowerPreference(touchDevice: boolean): WebGLPowerPreference {
  return touchDevice ? "low-power" : "high-performance";
}

function getMobileFramebufferPixelBudget(touchDevice: boolean) {
  return touchDevice ? 430_000 : Number.POSITIVE_INFINITY;
}

function canResumeIntro(exitStarted: boolean, destroyed: boolean, logoLoaded: boolean) {
  return !exitStarted && !destroyed && logoLoaded;
}

function pauseIntroFrame(frameId: number) {
  window.cancelAnimationFrame(frameId);
  return 0;
}

function resumeIntroFrame(
  frameId: number,
  animate: FrameRequestCallback,
  exitStarted: boolean,
  destroyed: boolean,
  logoLoaded: boolean,
) {
  if (frameId || !canResumeIntro(exitStarted, destroyed, logoLoaded)) {
    return frameId;
  }

  return window.requestAnimationFrame(animate);
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
    textures: new Set(),
  };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const touchDevice = isTouchDevice();
  const maxPixelRatio = getMaxPixelRatio(touchDevice);
  const mobileFramebufferPixelBudget = getMobileFramebufferPixelBudget(touchDevice);
  const introDuration = reducedMotion ? REDUCED_MOTION_DURATION_MS : INTRO_DURATION_MS;
  resetLoaderState(loader);
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: !touchDevice,
    powerPreference: getPowerPreference(touchDevice),
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
  let logoLoaded = false;
  let pausedAt = 0;

  const releaseRenderer = () => {
    if (rendererReleased) {
      return;
    }

    rendererReleased = true;
    destroyed = true;
    frameId = pauseIntroFrame(frameId);
    scene.environment = null;
    logoGroup.clear();
    resources.geometries.forEach((geometry) => geometry.dispose());
    resources.materials.forEach((material) => material.dispose());
    resources.textures.forEach((texture) => texture.dispose());
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

  const resolvePixelRatio = (width: number, height: number) => {
    let pixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);

    if (touchDevice) {
      const projectedPixels = width * height * pixelRatio * pixelRatio;

      if (projectedPixels > mobileFramebufferPixelBudget) {
        pixelRatio = Math.sqrt(mobileFramebufferPixelBudget / Math.max(1, width * height));
      }
    }

    return pixelRatio;
  };

  const resize = () => {
    const { clientWidth, clientHeight } = loader;
    if (!clientWidth || !clientHeight) {
      return;
    }

    const pixelRatio = resolvePixelRatio(clientWidth, clientHeight);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(clientWidth, clientHeight, false);
  };

  const beginExit = () => {
    if (exitStarted) {
      return;
    }

    exitStarted = true;
    frameId = pauseIntroFrame(frameId);
    loader.classList.add("is-exiting");
    hideTimeout = window.setTimeout(() => {
      hideLoader(loader);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
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

  const onVisibilityChange = () => {
    if (document.hidden) {
      pausedAt = performance.now();
      frameId = pauseIntroFrame(frameId);
      return;
    }

    if (pausedAt && startedAt) {
      startedAt += performance.now() - pausedAt;
      pausedAt = 0;
    }

    frameId = resumeIntroFrame(frameId, animate, exitStarted, destroyed, logoLoaded);
  };

  fallbackTimeout = window.setTimeout(beginExit, reducedMotion ? 1200 : 4200);

  loadLogo(resources)
    .then((logo) => {
      if (destroyed) {
        return;
      }

      window.clearTimeout(fallbackTimeout);
      logoLoaded = true;
      logoGroup.add(logo);
      frameId = resumeIntroFrame(frameId, animate, exitStarted, destroyed, logoLoaded);
    })
    .catch(() => {
      if (destroyed) {
        return;
      }

      beginExit();
    });

  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", onVisibilityChange);
  resize();

  return () => {
    destroyed = true;
    frameId = pauseIntroFrame(frameId);
    window.clearTimeout(hideTimeout);
    window.clearTimeout(fallbackTimeout);
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    document.body.classList.remove("intro-lock");
    releaseRenderer();
  };
}
