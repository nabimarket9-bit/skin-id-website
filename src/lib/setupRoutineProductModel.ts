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
  camera.position.set(center.x + maxDimension * 0.03, center.y + maxDimension * 0.01, center.z + distance);
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

function setupSingleRoutineProduct(config: RoutineProductConfig) {
  const viewport = document.querySelector<HTMLElement>(config.viewportSelector);
  const canvas = document.getElementById(config.canvasId) as HTMLCanvasElement | null;

  if (!viewport || !canvas) {
    return () => undefined;
  }

  const resources: RoutineProductResources = {
    geometries: new Set(),
    materials: new Set(),
  };
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  const touchDevice = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  const maxPixelRatio = touchDevice ? 1 : 1.5;
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
  const environmentTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.05);
  const loader = new GLTFLoader();
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const shouldAnimate = !prefersReducedMotion && !touchDevice;

  let model: Object3D | null = null;
  let destroyed = false;
  let frameId = 0;
  let baseY = 0;
  let baseRotationX = 0;
  let baseRotationY = 0;
  let baseRotationZ = 0;
  let isVisible = true;

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

  const stopAnimation = () => {
    if (!frameId) {
      return;
    }

    window.cancelAnimationFrame(frameId);
    frameId = 0;
  };

  const startAnimation = () => {
    if (!shouldAnimate || !model || frameId || !isVisible) {
      return;
    }

    frameId = window.requestAnimationFrame(animate);
  };

  const animate = (time: number) => {
    frameId = 0;

    if (destroyed) {
      return;
    }

    if (model && shouldAnimate && isVisible) {
      const drift = time * 0.001;
      model.position.y = baseY + Math.sin(drift * 0.96) * 0.012;
      model.rotation.x = baseRotationX + Math.sin(drift * 0.56) * 0.024;
      model.rotation.y = baseRotationY + Math.sin(drift * 0.82) * 0.28;
      model.rotation.z = baseRotationZ + Math.sin(drift * 0.62) * 0.038;
    }

    renderFrame();

    if (shouldAnimate && isVisible) {
      startAnimation();
    }
  };

  const resize = () => {
    const { clientWidth, clientHeight } = viewport;

    if (!clientWidth || !clientHeight) {
      return;
    }

    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
    renderer.setSize(clientWidth, clientHeight, false);

    if (model) {
      frameCamera(camera, model, viewport);
      renderFrame();
    }
  };

  const resizeObserver = new ResizeObserver(() => resize());
  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      isVisible = entry?.isIntersecting ?? false;

      if (isVisible) {
        if (shouldAnimate) {
          startAnimation();
        } else if (model) {
          renderFrame();
        }
      } else {
        stopAnimation();
      }
    },
    { threshold: 0.2 },
  );
  resizeObserver.observe(viewport);
  visibilityObserver.observe(viewport);

  void loader
    .loadAsync(config.modelUrl)
    .then((gltf) => {
      if (destroyed) {
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
      resize();

      if (shouldAnimate) {
        startAnimation();
      } else {
        renderFrame();
      }
    })
    .catch((error) => {
      console.error("Unable to load routine product model", error);
    });

  window.addEventListener("resize", resize);
  resize();

  return () => {
    destroyed = true;
    stopAnimation();
    resizeObserver.disconnect();
    visibilityObserver.disconnect();
    window.removeEventListener("resize", resize);
    renderer.dispose();
    renderer.forceContextLoss();
    environmentTarget.dispose();
    pmremGenerator.dispose();
    resources.geometries.forEach((geometry) => geometry.dispose());
    resources.materials.forEach((material) => material.dispose());
  };
}

export function setupRoutineProductModel() {
  const baseUrl = import.meta.env.BASE_URL;
  const cleanupHandlers = [
    setupSingleRoutineProduct({
      viewportSelector: ".routine-product-cleanser",
      canvasId: "cleanserProductCanvas",
      modelUrl: `${baseUrl}minimalist_skincare_bottle__3d_model.glb`,
    }),
    setupSingleRoutineProduct({
      viewportSelector: ".routine-product-serum",
      canvasId: "serumProductCanvas",
      modelUrl: `${baseUrl}serum_bottle.glb`,
    }),
    setupSingleRoutineProduct({
      viewportSelector: ".routine-product-moisturizer",
      canvasId: "moisturizerProductCanvas",
      modelUrl: `${baseUrl}simple_3d_skincare_cream_jar_3d_model.glb`,
    }),
    setupSingleRoutineProduct({
      viewportSelector: ".routine-product-spf",
      canvasId: "spfProductCanvas",
      modelUrl: `${baseUrl}skincare_small_tube_pack.glb`,
    }),
  ];

  return () => {
    cleanupHandlers.forEach((cleanup) => cleanup());
  };
}
