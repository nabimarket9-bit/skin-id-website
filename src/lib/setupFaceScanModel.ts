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
  Texture,
  Vector3,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type FaceScanResources = {
  geometries: Set<BufferGeometry>;
  materials: Set<Material>;
  textures: Set<Texture>;
};

export type FaceScanModelController = {
  destroy: () => void;
  setHeroVisible: (visible: boolean) => void;
  setSceneVisible: (visible: boolean) => void;
};

function markDisposableMesh(mesh: Mesh, resources: FaceScanResources) {
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

export function createFaceScanModelController(): FaceScanModelController {
  const viewport = document.querySelector<HTMLElement>(".scene-scan .face-visual");
  const canvas = document.getElementById("faceModelCanvas") as HTMLCanvasElement | null;

  if (!viewport || !canvas) {
    return {
      destroy: () => undefined,
      setHeroVisible: () => undefined,
      setSceneVisible: () => undefined,
    };
  }

  const resources: FaceScanResources = {
    geometries: new Set(),
    materials: new Set(),
    textures: new Set(),
  };
  const touchDevice = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  const antialias = !touchDevice;
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias,
    powerPreference: touchDevice ? "low-power" : "high-performance",
  });
  const maxPixelRatio = touchDevice ? 0.75 : 1.5;
  const mobileFramebufferPixelBudget = 240_000;
  const baseUrl = import.meta.env.BASE_URL;
  const modelUrl = touchDevice ? `${baseUrl}face-mobile.glb` : `${baseUrl}face.glb`;
  const containingScene = viewport.closest<HTMLElement>(".hero-scene");
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));

  const scene = new Scene();
  const camera = new PerspectiveCamera(22, 1, 0.01, 1000);
  const ambient = new AmbientLight("#ffffff", 2.2);
  const keyLight = new DirectionalLight("#ffffff", 2.6);
  const fillLight = new DirectionalLight("#d7ecff", 1.6);
  const rimLight = new DirectionalLight("#ffe7a3", 1.15);
  const pmremGenerator = new PMREMGenerator(renderer);
  const roomEnvironment = new RoomEnvironment();
  const environmentTarget = pmremGenerator.fromScene(roomEnvironment, 0.05);
  roomEnvironment.dispose();
  const loader = new GLTFLoader();
  const loadController = new AbortController();
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const shouldAnimate = !prefersReducedMotion;

  let model: Object3D | null = null;
  let destroyed = false;
  let frameId = 0;
  let baseY = 0;
  let baseRotationX = 0;
  let baseRotationY = 0;
  let heroVisible = true;
  let sceneVisible = true;
  let viewportVisible = true;
  let documentVisible = !document.hidden;
  let lastWidth = 0;
  let lastHeight = 0;
  let lastPixelRatio = 0;

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

  const isSceneActive = () => {
    if (!containingScene) {
      return true;
    }

    const opacity = Number.parseFloat(containingScene.style.opacity);
    return Number.isNaN(opacity) || opacity > 0.02;
  };

  const stopAnimation = () => {
    if (!frameId) {
      return;
    }

    window.cancelAnimationFrame(frameId);
    frameId = 0;
  };

  const canRender = () => heroVisible && sceneVisible && viewportVisible && documentVisible;

  const syncCanvasVisibility = () => {
    canvas.style.visibility = canRender() ? "visible" : "hidden";
  };

  const syncRenderState = () => {
    syncCanvasVisibility();

    if (!model || destroyed) {
      stopAnimation();
      return;
    }

    if (shouldAnimate) {
      if (canRender()) {
        startAnimation();
      } else {
        stopAnimation();
      }

      return;
    }

    stopAnimation();

    if (canRender()) {
      renderFrame();
    }
  };

  const startAnimation = () => {
    if (!shouldAnimate || !model || frameId || !canRender()) {
      return;
    }

    frameId = window.requestAnimationFrame(animate);
  };

  const animate = (time: number) => {
    frameId = 0;

    if (destroyed) {
      return;
    }

    if (model && shouldAnimate && canRender() && (touchDevice || isSceneActive())) {
      const drift = time * 0.001;
      model.position.y = baseY + Math.sin(drift * 1.15) * 0.028;
      model.rotation.x = baseRotationX + Math.sin(drift * 0.7) * 0.018;
      model.rotation.y = baseRotationY + Math.sin(drift * 0.9) * 0.028;
      renderFrame();
    }

    if (shouldAnimate && canRender()) {
      startAnimation();
    }
  };

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
    const clientWidth = Math.max(1, Math.round(viewport.clientWidth));
    const clientHeight = Math.max(1, Math.round(viewport.clientHeight));

    if (!clientWidth || !clientHeight) {
      return;
    }

    const pixelRatio = resolvePixelRatio(clientWidth, clientHeight);

    if (
      clientWidth === lastWidth &&
      clientHeight === lastHeight &&
      Math.abs(pixelRatio - lastPixelRatio) < 0.001
    ) {
      return;
    }

    lastWidth = clientWidth;
    lastHeight = clientHeight;
    lastPixelRatio = pixelRatio;
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(clientWidth, clientHeight, false);

    if (model) {
      frameCamera(camera, model, viewport);
      renderFrame();
    }
  };

  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      viewportVisible = entry?.isIntersecting ?? false;
      syncRenderState();
    },
    { threshold: 0.15 },
  );
  visibilityObserver.observe(viewport);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(viewport);
  const onVisibilityChange = () => {
    documentVisible = !document.hidden;
    syncRenderState();
  };

  void fetch(modelUrl, { signal: loadController.signal })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Unable to load face model (${response.status})`);
      }

      return response.arrayBuffer();
    })
    .then((buffer) => {
      if (destroyed) {
        return null;
      }

      return loader.parseAsync(buffer, baseUrl);
    })
    .then((gltf) => {
      if (!gltf) {
        return;
      }

      if (destroyed) {
        gltf.scene.traverse((child) => {
          if (child instanceof Mesh) {
            child.geometry.dispose();

            if (Array.isArray(child.material)) {
              child.material.forEach((material) => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
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
      syncRenderState();
    })
    .catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
  });

  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", onVisibilityChange);
  resize();
  syncCanvasVisibility();

  return {
    destroy: () => {
      destroyed = true;
      loadController.abort();
      stopAnimation();
      visibilityObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      viewport.style.removeProperty("--face-model-ready");
      canvas.style.removeProperty("visibility");
      if (model) {
        scene.remove(model);
        model = null;
      }
      scene.environment = null;
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
    },
    setHeroVisible: (visible) => {
      heroVisible = visible;
      syncRenderState();
    },
    setSceneVisible: (visible) => {
      sceneVisible = visible;
      syncRenderState();
    },
  };
}

export function setupFaceScanModel() {
  const controller = createFaceScanModelController();
  return () => controller.destroy();
}
