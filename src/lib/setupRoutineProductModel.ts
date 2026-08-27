import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  BufferGeometry,
  DirectionalLight,
  DoubleSide,
  HemisphereLight,
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

type RoutineProductResources = {
  geometries: Set<BufferGeometry>;
  materials: Set<Material>;
};

type RoutineProductConfig = {
  canvasId: string;
  modelUrl: string;
  viewportSelector: string;
};

export type RoutineProductModelController = {
  destroy: () => void;
  setHeroVisible: (visible: boolean) => void;
  setSceneVisible: (visible: boolean) => void;
};

function markDisposableMesh(mesh: Mesh, resources: RoutineProductResources) {
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
  const distance = Math.max(fitHeightDistance, fitWidthDistance) * 0.96;

  camera.near = Math.max(0.01, maxDimension / 100);
  camera.far = Math.max(100, maxDimension * 20);
  camera.position.set(
    center.x + maxDimension * 0.03,
    center.y + maxDimension * 0.01,
    center.z + distance,
  );
  camera.lookAt(center);
  camera.updateProjectionMatrix();

  viewport.style.setProperty("--routine-product-ready", "1");
}

function normalizeProductModel(object: Object3D) {
  object.position.set(0, 0, 0);
  object.scale.setScalar(1);
  object.rotation.set(0, 0, 0);
  object.updateMatrixWorld(true);

  const initialBounds = new Box3().setFromObject(object);
  const initialSize = initialBounds.getSize(new Vector3());
  const scale = 1.82 / (Math.max(initialSize.x, initialSize.y, initialSize.z) || 1);

  object.scale.setScalar(scale);
  object.updateMatrixWorld(true);

  const scaledBounds = new Box3().setFromObject(object);
  const scaledCenter = scaledBounds.getCenter(new Vector3());
  object.position.sub(scaledCenter);
  object.rotation.x = -0.2;
  object.rotation.y = 0.96;
  object.rotation.z = -0.12;
  object.updateMatrixWorld(true);
}

function enhanceMaterialVisibility(material: Material) {
  if ("side" in material) {
    material.side = DoubleSide;
  }

  if ("envMapIntensity" in material && typeof material.envMapIntensity === "number") {
    material.envMapIntensity = Math.max(material.envMapIntensity, 1.6);
  }

  if ("thickness" in material && typeof material.thickness === "number") {
    material.thickness = Math.max(material.thickness, 0.28);
  }

  material.needsUpdate = true;
}

function createSingleRoutineProductController(config: RoutineProductConfig): RoutineProductModelController {
  const viewport = document.querySelector<HTMLElement>(config.viewportSelector);
  const canvas = document.getElementById(config.canvasId) as HTMLCanvasElement | null;

  if (!viewport || !canvas) {
    return {
      destroy: () => undefined,
      setHeroVisible: () => undefined,
      setSceneVisible: () => undefined,
    };
  }

  const resources: RoutineProductResources = {
    geometries: new Set(),
    materials: new Set(),
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
  const mobileFramebufferPixelBudget = 120_000;
  const baseUrl = import.meta.env.BASE_URL;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));

  const scene = new Scene();
  const camera = new PerspectiveCamera(20, 1, 0.01, 1000);
  const ambient = new AmbientLight("#ffffff", 4.6);
  const hemisphere = new HemisphereLight("#f7fbff", "#8ea0bc", 2.3);
  const keyLight = new DirectionalLight("#ffffff", 6.2);
  const fillLight = new DirectionalLight("#d9ecff", 3.9);
  const rimLight = new DirectionalLight("#ffe7a3", 3.2);
  const backLight = new DirectionalLight("#bfe3ff", 2.5);
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
  let baseRotationZ = 0;
  let heroVisible = true;
  let sceneVisible = true;
  let viewportVisible = true;
  let documentVisible = !document.hidden;
  let lastWidth = 0;
  let lastHeight = 0;
  let lastPixelRatio = 0;
  let modelFramed = false;

  scene.environment = environmentTarget.texture;
  keyLight.position.set(2.8, 2.7, 4.6);
  fillLight.position.set(-2.4, 1.2, 3.3);
  rimLight.position.set(1.9, 1.8, -3.2);
  backLight.position.set(-1.1, 0.8, -2.6);

  scene.add(ambient);
  scene.add(hemisphere);
  scene.add(keyLight);
  scene.add(fillLight);
  scene.add(rimLight);
  scene.add(backLight);

  const renderFrame = () => {
    renderer.render(scene, camera);
  };

  const frameLoadedModel = () => {
    if (!model) {
      return;
    }

    frameCamera(camera, model, viewport);
    modelFramed = true;
    renderFrame();
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

    if (model && shouldAnimate && canRender()) {
      const drift = time * 0.001;
      model.position.y = baseY + Math.sin(drift * 0.96) * 0.012;
      model.rotation.x = baseRotationX + Math.sin(drift * 0.56) * 0.024;
      model.rotation.y = baseRotationY + Math.sin(drift * 0.82) * 0.28;
      model.rotation.z = baseRotationZ + Math.sin(drift * 0.62) * 0.038;
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

  const resize = (forceFrame = false) => {
    const clientWidth = Math.max(1, Math.round(viewport.clientWidth));
    const clientHeight = Math.max(1, Math.round(viewport.clientHeight));

    if (!clientWidth || !clientHeight) {
      return;
    }

    const pixelRatio = resolvePixelRatio(clientWidth, clientHeight);

    if (
      !forceFrame &&
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

    if (model && (forceFrame || !modelFramed)) {
      frameLoadedModel();
    }
  };

  const resizeViewport = () => {
    resize(false);
  };

  const resizeObserver = new ResizeObserver(() => {
    resizeViewport();
  });
  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      viewportVisible = entry?.isIntersecting ?? false;
      syncRenderState();
    },
    { threshold: 0.2 },
  );
  const onVisibilityChange = () => {
    documentVisible = !document.hidden;
    syncRenderState();
  };

  resizeObserver.observe(viewport);
  visibilityObserver.observe(viewport);

  void fetch(config.modelUrl, { signal: loadController.signal })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Unable to load routine product model (${response.status})`);
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

          if (Array.isArray(child.material)) {
            child.material.forEach(enhanceMaterialVisibility);
          } else if (child.material) {
            enhanceMaterialVisibility(child.material);
          }
        }
      });

      normalizeProductModel(model);
      scene.add(model);
      baseY = model.position.y;
      baseRotationX = model.rotation.x;
      baseRotationY = model.rotation.y;
      baseRotationZ = model.rotation.z;
      resize(true);
      syncRenderState();
    })
    .catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      console.error("Unable to load routine product model", error);
    });

  window.addEventListener("resize", resizeViewport);
  document.addEventListener("visibilitychange", onVisibilityChange);
  resizeViewport();
  syncCanvasVisibility();

  return {
    destroy: () => {
      destroyed = true;
      loadController.abort();
      stopAnimation();
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      window.removeEventListener("resize", resizeViewport);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      viewport.style.removeProperty("--routine-product-ready");
      canvas.style.removeProperty("visibility");
      if (model) {
        scene.remove(model);
        model = null;
      }
      modelFramed = false;
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

export function createRoutineProductModelController(): RoutineProductModelController {
  const baseUrl = import.meta.env.BASE_URL;
  const controllers = [
    createSingleRoutineProductController({
      viewportSelector: ".routine-product-serum",
      canvasId: "serumProductCanvas",
      modelUrl: `${baseUrl}serum-bottle-mobile.glb`,
    }),
    createSingleRoutineProductController({
      viewportSelector: ".routine-product-moisturizer",
      canvasId: "moisturizerProductCanvas",
      modelUrl: `${baseUrl}skincare-cream-jar-mobile.glb`,
    }),
  ];

  return {
    destroy: () => {
      controllers.forEach((controller) => controller.destroy());
    },
    setHeroVisible: (visible) => {
      controllers.forEach((controller) => controller.setHeroVisible(visible));
    },
    setSceneVisible: (visible) => {
      controllers.forEach((controller) => controller.setSceneVisible(visible));
    },
  };
}

export function setupRoutineProductModel() {
  const baseUrl = import.meta.env.BASE_URL;
  const touchDevice = window.matchMedia("(hover: none), (pointer: coarse)").matches;

  if (touchDevice) {
    const controller = createRoutineProductModelController();
    return () => controller.destroy();
  }

  const cleanupHandlers = [
    createSingleRoutineProductController({
      viewportSelector: ".routine-product-cleanser",
      canvasId: "cleanserProductCanvas",
      modelUrl: `${baseUrl}minimalist_skincare_bottle__3d_model.glb`,
    }),
    createSingleRoutineProductController({
      viewportSelector: ".routine-product-serum",
      canvasId: "serumProductCanvas",
      modelUrl: `${baseUrl}serum_bottle.glb`,
    }),
    createSingleRoutineProductController({
      viewportSelector: ".routine-product-moisturizer",
      canvasId: "moisturizerProductCanvas",
      modelUrl: `${baseUrl}simple_3d_skincare_cream_jar_3d_model.glb`,
    }),
    createSingleRoutineProductController({
      viewportSelector: ".routine-product-spf",
      canvasId: "spfProductCanvas",
      modelUrl: `${baseUrl}skincare_small_tube_pack.glb`,
    }),
  ];

  return () => {
    cleanupHandlers.forEach((controller) => controller.destroy());
  };
}
