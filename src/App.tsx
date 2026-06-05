import { useEffect } from "react";

const calendlyUrl = "https://calendly.com/nabi_";

type ConcernMode = "hydration" | "sensitivity" | "acne" | "aging";
type FacePoint = [number, number, number, number, number, number];
type FaceMeshAsset = { count: number; scale: number; points: FacePoint[] };

type ConcernMeta = {
  concern: string;
  focus: string;
  reading: string;
  summary: string;
  depth: string;
  lens: string;
  primaryColor: string;
  glowColor: string;
  pitch: number;
  hotspot: (x: number, y: number, z: number) => number;
};

const regionFalloff = (
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  radius: number,
) => Math.max(0, 1 - Math.hypot(x - centerX, y - centerY) / radius);

const concernMeta: Record<ConcernMode, ConcernMeta> = {
  hydration: {
    concern: "Hydration depletion",
    focus: "Barrier + cheeks",
    reading: "The routine starts by restoring comfort before actives.",
    summary:
      "The 3D face gives a concrete visual anchor, so the diagnosis feels guided rather than guessed.",
    depth: "Barrier-first scan",
    lens: "Hydration mapping",
    primaryColor: "115,169,255",
    glowColor: "244,221,176",
    pitch: 0.03,
    hotspot: (x, y) =>
      Math.max(
        regionFalloff(x, y, -0.1, 0.02, 0.12),
        regionFalloff(x, y, 0.1, 0.02, 0.12),
        regionFalloff(x, y, 0, -0.05, 0.1) * 0.72,
      ),
  },
  sensitivity: {
    concern: "Reactivity pattern",
    focus: "Cheeks + nose bridge",
    reading: "The visual scan frames irritation as a pattern, not a generic skin type.",
    summary:
      "Instead of forcing the visitor into a quiz answer, the interface isolates where reactivity is likely to appear.",
    depth: "Comfort-led analysis",
    lens: "Sensitivity zoning",
    primaryColor: "184,242,255",
    glowColor: "244,221,176",
    pitch: 0.02,
    hotspot: (x, y) =>
      Math.max(
        regionFalloff(x, y, -0.12, 0.03, 0.11),
        regionFalloff(x, y, 0.12, 0.03, 0.11),
        regionFalloff(x, y, 0, 0.02, 0.08) * 0.88,
      ),
  },
  acne: {
    concern: "Breakout pressure",
    focus: "T-zone + lower face",
    reading: "The system can show imbalance without defaulting to harsh treatment logic.",
    summary:
      "The face model makes the concern feel located and specific, which creates confidence in the routine direction.",
    depth: "Congestion sweep",
    lens: "Sebum + inflammation",
    primaryColor: "255,115,132",
    glowColor: "244,221,176",
    pitch: 0.05,
    hotspot: (x, y) =>
      Math.max(
        regionFalloff(x, y, 0, 0.08, 0.09),
        regionFalloff(x, y, 0, -0.02, 0.1),
        regionFalloff(x, y, -0.08, -0.1, 0.1) * 0.84,
        regionFalloff(x, y, 0.08, -0.1, 0.1) * 0.84,
      ),
  },
  aging: {
    concern: "Texture + fine-line focus",
    focus: "Forehead + eye contour",
    reading: "The model turns fine lines into a premium care pathway instead of a vague anti-age claim.",
    summary:
      "This keeps the story aspirational while still feeling diagnostic, which fits a higher-value skincare positioning.",
    depth: "Texture contouring",
    lens: "Renewal support",
    primaryColor: "244,221,176",
    glowColor: "184,242,255",
    pitch: 0.01,
    hotspot: (x, y) =>
      Math.max(
        regionFalloff(x, y, 0, 0.18, 0.12),
        regionFalloff(x, y, -0.08, 0.08, 0.08),
        regionFalloff(x, y, 0.08, 0.08, 0.08),
      ),
  },
};

let faceMeshPromise: Promise<FaceMeshAsset> | null = null;

function isConcernMode(value: string | undefined): value is ConcernMode {
  return value === "hydration" || value === "sensitivity" || value === "acne" || value === "aging";
}

function loadFaceMesh() {
  if (!faceMeshPromise) {
    faceMeshPromise = fetch("/visitor-face-points.json").then((response) => {
      if (!response.ok) {
        throw new Error("Unable to load face mesh");
      }
      return response.json() as Promise<FaceMeshAsset>;
    });
  }

  return faceMeshPromise;
}

function setupVisitorFaceSection() {
  const choicePanel = document.querySelector<HTMLElement>(".choice-panel");
  const stage = document.querySelector<HTMLElement>(".mesh-stage");
  const canvas = document.getElementById("faceMeshCanvas") as HTMLCanvasElement | null;
  const emptyState = document.getElementById("meshEmpty");
  const concernNode = document.getElementById("meshConcern");
  const focusNode = document.getElementById("meshFocus");
  const readingNode = document.getElementById("meshReading");
  const summaryNode = document.getElementById("meshSummary");
  const depthNode = document.getElementById("meshDepth");
  const lensNode = document.getElementById("meshLens");

  if (
    !choicePanel ||
    !stage ||
    !canvas ||
    !emptyState ||
    !concernNode ||
    !focusNode ||
    !readingNode ||
    !summaryNode ||
    !depthNode ||
    !lensNode
  ) {
    return () => undefined;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return () => undefined;
  }

  let mode: ConcernMode = "hydration";
  let frameId = 0;
  let destroyed = false;
  let width = 0;
  let height = 0;
  let points: FacePoint[] = [];

  const pointer = { x: 0.5, y: 0.5, active: false };

  const applyMode = (nextMode: ConcernMode) => {
    mode = nextMode;
    choicePanel.dataset.concern = nextMode;

    const meta = concernMeta[nextMode];
    concernNode.textContent = meta.concern;
    focusNode.textContent = meta.focus;
    readingNode.textContent = meta.reading;
    summaryNode.textContent = meta.summary;
    depthNode.textContent = meta.depth;
    lensNode.textContent = meta.lens;
  };

  const syncWithActiveChip = () => {
    const activeChip = document.querySelector<HTMLButtonElement>(".chip.active");
    const candidate = activeChip?.dataset.mode;

    if (isConcernMode(candidate)) {
      applyMode(candidate);
    }
  };

  const resizeCanvas = () => {
    const bounds = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);

    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const onPointerMove = (event: PointerEvent) => {
    const bounds = stage.getBoundingClientRect();
    pointer.x = (event.clientX - bounds.left) / bounds.width;
    pointer.y = (event.clientY - bounds.top) / bounds.height;
    pointer.active = true;
  };

  const onPointerLeave = () => {
    pointer.active = false;
  };

  stage.addEventListener("pointermove", onPointerMove);
  stage.addEventListener("pointerleave", onPointerLeave);

  const chipListeners = Array.from(document.querySelectorAll<HTMLButtonElement>(".chip")).map((chip) => {
    const handler = () => {
      const candidate = chip.dataset.mode;

      if (isConcernMode(candidate)) {
        applyMode(candidate);
      }
    };

    chip.addEventListener("click", handler);
    return { chip, handler };
  });

  const resizeObserver = new ResizeObserver(() => resizeCanvas());
  resizeObserver.observe(stage);
  window.addEventListener("resize", resizeCanvas);

  const render = (time: number) => {
    if (destroyed || !points.length) {
      return;
    }

    const meta = concernMeta[mode];
    const sway = Math.sin(time * 0.00055) * (Math.PI / 2);
    const yaw = Math.max(
      -Math.PI / 2,
      Math.min(Math.PI / 2, sway + (pointer.active ? (pointer.x - 0.5) * 0.12 : 0)),
    );
    // Move the straightening correction to the upward tilt axis instead of spinning in screen space.
    const visualStraighten = 0;
    const straightenPivotX = width * 0.3976;
    const straightenPivotY = height * 0.4723;
    const basePitch = -1.64;
    const pitch = meta.pitch + (pointer.active ? (pointer.y - 0.5) * 0.08 : 0);
    const cosBasePitch = Math.cos(basePitch);
    const sinBasePitch = Math.sin(basePitch);
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const cosStraighten = Math.cos(visualStraighten);
    const sinStraighten = Math.sin(visualStraighten);

    context.clearRect(0, 0, width, height);

    const background = context.createRadialGradient(
      width * 0.5,
      height * 0.44,
      12,
      width * 0.5,
      height * 0.48,
      height * 0.72,
    );
    background.addColorStop(0, "rgba(255,255,255,0.04)");
    background.addColorStop(0.45, "rgba(9,11,14,0.09)");
    background.addColorStop(1, "rgba(4,5,6,0)");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    const projectedPoints: Array<{
      screenX: number;
      screenY: number;
      focus: number;
      depthAlpha: number;
      glowAlpha: number;
      radius: number;
      depth: number;
    }> = [];

    for (const point of points) {
      const [x, y, z] = point;
      const yBase = y * cosBasePitch - z * sinBasePitch;
      const zBase = z * cosBasePitch + y * sinBasePitch;
      const xYaw = x * cosYaw + zBase * sinYaw;
      const zYaw = zBase * cosYaw - x * sinYaw;
      const yPitch = yBase * cosPitch - zYaw * sinPitch;
      const zPitch = zYaw * cosPitch + yBase * sinPitch;

      const perspective = 1 / (1.8 - zPitch * 0.65);
      const rawScreenX = width * 0.5 + xYaw * width * 0.82 * perspective;
      const rawScreenY = height * 0.58 - yPitch * height * 0.98 * perspective;
      const dx = rawScreenX - straightenPivotX;
      const dy = rawScreenY - straightenPivotY;
      const screenX = straightenPivotX + dx * cosStraighten - dy * sinStraighten;
      const screenY = straightenPivotY + dx * sinStraighten + dy * cosStraighten;

      if (screenX < -24 || screenX > width + 24 || screenY < -24 || screenY > height + 24) {
        continue;
      }

      const focus = meta.hotspot(x, y, z);
      const depthAlpha = Math.min(0.72, 0.16 + perspective * 0.33);
      const glowAlpha = Math.min(0.92, focus * 0.48 + perspective * 0.2);
      const radius = 0.45 + perspective * 1.28;

      projectedPoints.push({
        screenX,
        screenY,
        focus,
        depthAlpha,
        glowAlpha,
        radius,
        depth: zPitch,
      });
    }

    projectedPoints.sort((left, right) => left.depth - right.depth);

    for (const point of projectedPoints) {
      if (point.focus > 0.28) {
        context.fillStyle = `rgba(${meta.glowColor},${point.glowAlpha * 0.22})`;
        context.beginPath();
        context.arc(point.screenX, point.screenY, point.radius * (2.2 + point.focus), 0, Math.PI * 2);
        context.fill();
      }

      context.fillStyle =
        point.focus > 0.34
          ? `rgba(${meta.primaryColor},${Math.max(point.depthAlpha, point.glowAlpha)})`
          : `rgba(243,245,247,${point.depthAlpha})`;
      context.beginPath();
      context.arc(point.screenX, point.screenY, point.radius + point.focus * 1.08, 0, Math.PI * 2);
      context.fill();
    }

    frameId = window.requestAnimationFrame(render);
  };

  applyMode(mode);
  resizeCanvas();
  syncWithActiveChip();

  loadFaceMesh()
    .then((asset) => {
      if (destroyed) {
        return;
      }

      points = asset.points;
      emptyState.hidden = true;
      frameId = window.requestAnimationFrame(render);
    })
    .catch(() => {
      emptyState.textContent = "Face mesh unavailable";
    });

  return () => {
    destroyed = true;
    window.cancelAnimationFrame(frameId);
    resizeObserver.disconnect();
    window.removeEventListener("resize", resizeCanvas);
    stage.removeEventListener("pointermove", onPointerMove);
    stage.removeEventListener("pointerleave", onPointerLeave);
    chipListeners.forEach(({ chip, handler }) => chip.removeEventListener("click", handler));
  };
}

const landingHtml = `<div class="loader"><div class="loader-brand">NABI</div><div class="loader-slit"></div><div class="loader-sub">private skin intelligence system</div></div>
  <div class="cursor" id="cursor"></div><div class="glow" id="glow"></div><div class="noise"></div>

  <nav class="nav">
    <div class="logo" aria-label="NABI"><img class="logo-img" src="/nabi-logo-cropped.png" alt="NABI" /></div>
    <div class="nav-links"><a href="#problem">Problem</a><a href="#journey">Journey</a><a href="#simulator">Experience</a></div>
    <a class="cta magnetic" href="${calendlyUrl}" target="_blank" rel="noreferrer"><span class="btn-text">Request a Demo</span></a>
  </nav>

  <section class="hero">
    <div class="hero-inner">
      <div>
        <div class="eyebrow"><span class="dot"></span>Private AI conversion system for skincare brands</div>
        <h1>Turn skincare browsing into <span class="gradient-text">personalized buying decisions.</span></h1>
        <p>NABI Skin ID helps skincare brands convert more visitors into <span class="highlight-word highlight-gold">higher-value carts</span> through <span class="highlight-word highlight-blue">AI-powered skin analysis</span>, <span class="highlight-word highlight-cyan">catalog logic</span> and Shopify-native implementation.</p>
        <div class="hero-actions"><a class="cta magnetic" href="${calendlyUrl}" target="_blank" rel="noreferrer"><span class="btn-text">Discover Skin ID</span></a><a class="cta ghost magnetic" href="#simulator"><span class="btn-text">Try the concept</span></a></div>
        <div class="hero-note">No public demo. No marketplace plugin. Every deployment is configured around the brand's catalog, UX, routine logic and revenue goals.</div>
      </div>
      <div class="cinema" id="cinema">
        <canvas id="heroCanvas"></canvas><div class="scanner-beam"></div><div class="status"><span class="dot"></span>Live personalization layer</div>
        <div class="data-panel a"><div class="label">Visitor signal</div><div class="value">Sensitive + dry</div><div class="meter"><span></span></div></div>
        <div class="data-panel b"><div class="label">Primary intent</div><div class="value">Hydration</div><div class="meter"><span></span></div></div>
        <div class="data-panel c"><div class="label">Cart direction</div><div class="value">Routine bundle ready</div><div class="meter"><span></span></div></div>
      </div>
    </div>
  </section>

  <div class="marquee"><div class="marquee-track"><span>Skin analysis</span><span>Catalog logic</span><span>Routine personalization</span><span>Conversion lift</span><span>AOV expansion</span><span>Shopify implementation</span><span>Skin analysis</span><span>Catalog logic</span><span>Routine personalization</span><span>Conversion lift</span><span>AOV expansion</span><span>Shopify implementation</span></div></div>

  <section class="section" id="problem">
    <div class="container split">
      <div class="sticky"><div class="eyebrow"><span class="dot"></span>The expensive leak</div><h2>Most skincare stores still sell like <span class="highlight-word highlight-gold">product catalogs.</span></h2><p class="lead">Customers do not need more choice. They need <span class="highlight-word highlight-cyan">confidence</span>. The store that gives the clearest <span class="highlight-word highlight-blue">decision</span> wins the cart.</p></div>
      <div class="problem-stack">
        <div class="problem-card"><strong><span class="highlight-word highlight-gold">Choice</span> creates hesitation.</strong><p>When every product sounds useful, the visitor delays the <span class="highlight-word highlight-blue">decision</span> or exits completely.</p><div class="animated-icon ico-choice"><svg viewBox="0 0 42 42"><path class="stroke p1" d="M8 21h26"/><path class="stroke p2" d="M21 8v26"/><path class="stroke p3" d="M12 12l18 18"/></svg></div></div>
        <div class="problem-card"><strong>Generic quizzes feel <span class="highlight-word highlight-blue">fake.</span></strong><p>They collect answers, but they rarely make the customer feel genuinely <span class="highlight-word highlight-cyan">understood</span>.</p><div class="animated-icon ico-fake"><svg viewBox="0 0 42 42"><circle class="stroke ring" cx="21" cy="21" r="14"/><path class="stroke slash" d="M12 30L30 12"/><path class="stroke" d="M16 19h10"/></svg></div></div>
        <div class="problem-card"><strong>Skincare is not one <span class="highlight-word highlight-cyan">product.</span></strong><p>The buying logic is <span class="highlight-word highlight-gold">routine-based</span>, but most stores still sell isolated product pages.</p><div class="animated-icon ico-routine"><svg viewBox="0 0 42 42"><path class="stroke" d="M10 28C15 12 27 12 32 28"/><circle class="node n1" cx="10" cy="28" r="4" fill="#ffe7a3"/><circle class="node n2" cx="21" cy="14" r="4" fill="#ffe7a3"/><circle class="node n3" cx="32" cy="28" r="4" fill="#ffe7a3"/></svg></div></div>
        <div class="problem-card"><strong><span class="highlight-word highlight-gold">AOV</span> is hidden in education.</strong><p>If the store cannot explain the <span class="highlight-word highlight-cyan">routine</span>, it cannot naturally sell the routine.</p><div class="animated-icon ico-aov"><svg viewBox="0 0 42 42"><rect class="stroke bar1" x="9" y="24" width="5" height="9"/><rect class="stroke bar2" x="18" y="18" width="5" height="15"/><rect class="stroke bar3" x="27" y="10" width="5" height="23"/><path class="stroke" d="M8 34h27"/></svg></div></div>
      </div>
    </div>
  </section>

  <section class="control-room" id="journey">
    <div class="control-pin">
      <div class="control-stage s1" id="controlStage">
        <div class="control-copy"><div class="kicker" id="stageKicker">Before Skin ID</div><h3 id="stageTitle">A visitor enters. The store shows products. The decision gets harder.</h3></div>
        <div class="cloud" id="productCloud"></div>
        <div class="signal-core"><div class="orbit o1"></div><div class="orbit o2"></div><div class="orbit o3"></div></div>
        <div class="decision-map"><svg viewBox="0 0 900 520"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#73a9ff"/><stop offset=".55" stop-color="#ffe7a3"/><stop offset="1" stop-color="#99ecff"/></linearGradient></defs><path class="path" d="M40 250 C200 60, 320 420, 450 250 S700 70, 860 250"/><path class="path" d="M140 410 C260 250, 390 90, 520 250 S680 420, 800 130"/><path class="path" d="M100 120 C260 250, 320 250, 450 250 S610 250, 760 390"/></svg></div>
        <div class="routine-board"><strong>Personalized routine created</strong><div class="row"><span>Cleanse</span><span>Matched</span></div><div class="row"><span>Treat</span><span>Priority</span></div><div class="row"><span>Hydrate</span><span>Required</span></div><div class="row"><span>Protect</span><span>Recommended</span></div></div>
      </div>
    </div>
  </section>

  <section class="simulator" id="simulator">
    <div class="sim-box">
      <div class="sim-header"><div class="eyebrow"><span class="dot"></span>Interactive concept</div><h2>Make the visitor create the <span class="highlight-word highlight-blue">argument.</span></h2><p class="lead">This is not the real demo. It is a controlled interaction that makes the <span class="highlight-word highlight-gold">value obvious</span> without exposing the product.</p></div>
      <div class="sim-grid">
        <div class="choice-panel" data-concern="hydration"><div class="choice-top"><div><div class="choice-label">Choose visitor concern</div><h3 class="choice-heading">Select the concern. Let the interface isolate the signal before the recommendation appears.</h3></div><div class="mesh-badge"><span class="dot"></span>3D face topology</div></div><div class="chips" id="chips"><button class="chip active" data-mode="hydration">Dryness</button><button class="chip" data-mode="sensitivity">Sensitivity</button><button class="chip" data-mode="acne">Breakouts</button><button class="chip" data-mode="aging">Fine lines</button></div><div class="skin-face mesh-stage"><canvas id="faceMeshCanvas" aria-label="3D face mesh preview"></canvas><div class="mesh-empty" id="meshEmpty">Loading face topology...</div><div class="mesh-grid"></div><div class="mesh-scanline"></div><div class="mesh-hud mesh-hud-a"><span class="hud-label">Concern</span><strong id="meshConcern">Hydration depletion</strong></div><div class="mesh-hud mesh-hud-b"><span class="hud-label">Focus zone</span><strong id="meshFocus">Barrier + cheeks</strong></div><div class="mesh-hud mesh-hud-c"><span class="hud-label">Reading</span><strong id="meshReading">The routine starts by restoring comfort before actives.</strong></div></div><div class="choice-summary"><p id="meshSummary">The 3D face gives a concrete visual anchor, so the diagnosis feels guided rather than guessed.</p><div class="choice-stats"><div class="choice-stat"><span class="stat-label">Depth</span><strong id="meshDepth">Barrier-first scan</strong></div><div class="choice-stat"><span class="stat-label">Lens</span><strong id="meshLens">Hydration mapping</strong></div></div></div></div>
        <div class="result-panel"><div class="result-top"><div><div class="choice-label">Skin ID output</div><h3 id="resultTitle" style="font-size:34px;letter-spacing:-.06em;margin:0;">Hydration-first routine</h3></div><div class="score" id="score">91</div></div><div class="result-list"><div class="result-item"><span>Main decision</span><span id="decision">Repair barrier first</span></div><div class="result-item"><span>Routine direction</span><span id="routine">Cleanser + serum + cream</span></div><div class="result-item"><span>Cart logic</span><span id="cart">Bundle recommended</span></div><div class="result-item"><span>Customer feeling</span><span id="feeling">Clear next step</span></div></div></div>
      </div>
    </div>
  </section>

  <section class="deep-system">
    <div class="container">
      <div class="eyebrow"><span class="dot"></span>What gets installed</div><h2>A <span class="highlight-word highlight-cyan">conversion layer</span> built around the brand.</h2><p class="lead">The site should not expose the real product. It should make the <span class="highlight-word highlight-blue">system</span> feel deeper than a quiz widget.</p>
      <div class="depth-grid">
        <div class="depth-card"><div class="card-icon ci-profile"><svg viewBox="0 0 42 42"><circle cx="21" cy="16" r="8" fill="none" stroke-width="2.4"/><circle cx="21" cy="16" r="4" fill="none" stroke-width="2.4"/><path d="M10 34c3-8 19-8 22 0" fill="none" stroke-width="2.4"/></svg></div><div class="index">01</div><h4>Skin <span class="highlight-word highlight-blue">profile</span></h4><p>Turns visitor inputs into a structured profile that can guide product choice.</p></div>
        <div class="depth-card"><div class="card-icon ci-ai"><svg viewBox="0 0 42 42"><path d="M10 22c7-15 15-15 22 0-7 15-15 15-22 0Z" fill="none" stroke-width="2.4"/><circle cx="21" cy="22" r="5" fill="none" stroke-width="2.4"/></svg></div><div class="index">02</div><h4>AI <span class="highlight-word highlight-cyan">analysis</span></h4><p>Uses face-driven signals to make personalization feel real, not declarative.</p></div>
        <div class="depth-card"><div class="card-icon ci-catalog"><svg viewBox="0 0 42 42"><rect x="9" y="9" width="10" height="10" rx="3" fill="none" stroke-width="2.4"/><rect x="23" y="9" width="10" height="10" rx="3" fill="none" stroke-width="2.4"/><rect x="9" y="23" width="10" height="10" rx="3" fill="none" stroke-width="2.4"/><rect x="23" y="23" width="10" height="10" rx="3" fill="none" stroke-width="2.4"/></svg></div><div class="index">03</div><h4>Catalog <span class="highlight-word highlight-gold">logic</span></h4><p>Adapts recommendations to the brand's actual products and priorities.</p></div>
        <div class="depth-card"><div class="card-icon ci-routine"><svg viewBox="0 0 42 42"><path d="M9 30C18 9 28 9 33 30" fill="none" stroke-width="2.4"/><path d="M12 21h18" fill="none" stroke-width="2.4"/><path d="M18 13v18" fill="none" stroke-width="2.4"/></svg></div><div class="index">04</div><h4>Routine <span class="highlight-word highlight-cyan">engine</span></h4><p>Builds a coherent buying path instead of isolated product suggestions.</p></div>
        <div class="depth-card"><div class="card-icon ci-cart"><svg viewBox="0 0 42 42"><path d="M10 12h4l4 17h14l3-11H17" fill="none" stroke-width="2.4"/><circle cx="20" cy="33" r="3" fill="none" stroke-width="2.4"/><circle cx="31" cy="33" r="3" fill="none" stroke-width="2.4"/></svg></div><div class="index">05</div><h4>Cart <span class="highlight-word highlight-gold">direction</span></h4><p>Pushes the customer toward a confident, higher-value basket.</p></div>
      </div>
    </div>
  </section>

  <section class="belief-section">
    <div class="belief"><p id="beliefText">Most skincare stores sell <span class="change word-products">products.</span></p><div class="range-wrap"><div class="range-track-glow"></div><div class="range-fill" id="rangeFill"></div><input id="beliefRange" type="range" min="0" max="100" value="14"/></div></div>
  </section>

  <section class="blackout" id="apply">
    <div class="blackout-pin"><canvas class="final-canvas" id="finalCanvas"></canvas><div class="blackout-bg" id="blackoutBg"></div><div class="final-word"><h2><span class="final-line" id="f1">Your <span class="highlight-word highlight-gold">visitors</span> already have questions.</span><span class="final-line" id="f2">Your store needs to <span class="highlight-word highlight-blue">answer</span> them.</span></h2><p class="final-line" id="f3">Skin ID turns <span class="highlight-word highlight-gold">product confusion</span> into a <span class="highlight-word highlight-cyan">personalized buying path</span> configured around your catalog, UX and growth goals.</p><a class="cta magnetic final-line" id="f4" href="${calendlyUrl}" target="_blank" rel="noreferrer"><span class="btn-text">Discover Skin ID</span></a></div></div>
  </section>`;

const landingScript = "document.querySelectorAll(\".problem-card,.depth-card\").forEach(card=>{\n  card.addEventListener(\"mousemove\",e=>{\n    const r=card.getBoundingClientRect();\n    card.style.setProperty(\"--mx\", ((e.clientX-r.left)/r.width*100)+\"%\");\n    card.style.setProperty(\"--my\", ((e.clientY-r.top)/r.height*100)+\"%\");\n  });\n});\n\nconst cursor=document.getElementById(\"cursor\"),glow=document.getElementById(\"glow\"),magnets=document.querySelectorAll(\".magnetic\");\nwindow.addEventListener(\"mousemove\",e=>{cursor.style.left=e.clientX+\"px\";cursor.style.top=e.clientY+\"px\";glow.style.left=e.clientX+\"px\";glow.style.top=e.clientY+\"px\";let active=false;magnets.forEach(el=>{const r=el.getBoundingClientRect(),x=e.clientX-(r.left+r.width/2),y=e.clientY-(r.top+r.height/2),d=Math.sqrt(x*x+y*y);if(d<140){el.style.transform=`translate(${x*.14}px,${y*.2}px)`;active=true}else el.style.transform=\"translate(0,0)\"});cursor.style.width=active?\"48px\":\"18px\";cursor.style.height=active?\"48px\":\"18px\";cursor.style.background=active?\"rgba(255,231,163,.14)\":\"transparent\"});\ndocument.querySelectorAll(\".problem-card\").forEach(c=>new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add(\"reveal\")}),{threshold:.22}).observe(c));\n\nconst canvas=document.getElementById(\"heroCanvas\"),ctx=canvas.getContext(\"2d\"),cinema=document.getElementById(\"cinema\");let pts=[],mouse={x:.5,y:.5};\nfunction resizeHero(){const dpr=Math.min(devicePixelRatio||1,2);canvas.width=cinema.clientWidth*dpr;canvas.height=cinema.clientHeight*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);buildHero()}\nfunction buildHero(){pts=[];const w=cinema.clientWidth,h=cinema.clientHeight;for(let i=0;i<470;i++){const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*Math.min(w,h)*.35;pts.push({ox:w/2+Math.cos(a)*r,oy:h/2+Math.sin(a)*r*.82,x:w/2+Math.cos(a)*r,y:h/2+Math.sin(a)*r*.82,vx:0,vy:0,s:Math.random()*2.2+.65,g:Math.floor(Math.random()*5),ph:Math.random()*Math.PI*2})}}\ncinema.addEventListener(\"mousemove\",e=>{const r=cinema.getBoundingClientRect();mouse.x=(e.clientX-r.left)/r.width;mouse.y=(e.clientY-r.top)/r.height;cinema.style.transform=`perspective(1000px) rotateY(${(mouse.x-.5)*4.5}deg) rotateX(${-(mouse.y-.5)*4.5}deg)`});\nfunction drawHero(t){const w=cinema.clientWidth,h=cinema.clientHeight;ctx.clearRect(0,0,w,h);const centers=[{x:w*.30,y:h*.32},{x:w*.67,y:h*.28},{x:w*.36,y:h*.65},{x:w*.70,y:h*.62},{x:w*.50,y:h*.45}],pull=Math.min(1,(Math.abs(mouse.x-.5)+Math.abs(mouse.y-.5))*1.65);for(const p of pts){const c=centers[p.g],wave=Math.sin(t*.0015+p.ph)*13,tx=p.ox*(1-pull)+c.x*pull,ty=(p.oy+wave)*(1-pull)+c.y*pull;p.vx+=(tx-p.x)*.014;p.vy+=(ty-p.y)*.014;p.vx*=.87;p.vy*=.87;p.x+=p.vx;p.y+=p.vy;ctx.beginPath();ctx.arc(p.x,p.y,p.s,0,Math.PI*2);ctx.fillStyle=p.g%2===0?\"rgba(115,169,255,.73)\":\"rgba(255,231,163,.68)\";ctx.fill()}requestAnimationFrame(drawHero)}\naddEventListener(\"resize\",resizeHero);resizeHero();requestAnimationFrame(drawHero);\n\nconst cloud=document.getElementById(\"productCloud\");[[74,420,-19],[240,255,15],[450,435,28],[690,210,-25],[875,395,19],[145,570,22],[555,260,-8],[930,120,8],[360,92,-16],[760,565,-10],[1010,520,14],[70,165,24],[515,585,-22],[640,90,11],[995,255,-17],[315,590,18]].forEach((p,i)=>{const el=document.createElement(\"div\");el.className=\"product\";el.style.left=p[0]+\"px\";el.style.top=p[1]+\"px\";el.style.setProperty(\"--r\",p[2]+\"deg\");el.style.animation=`float${i%4} ${5+i%5}s ease-in-out infinite alternate`;cloud.appendChild(el)});\nconst st=document.createElement(\"style\");st.textContent=`@keyframes float0{to{transform:translateY(-24px) rotate(8deg)}}@keyframes float1{to{transform:translate(14px,18px) rotate(-12deg)}}@keyframes float2{to{transform:translate(18px,-12px) rotate(18deg)}}@keyframes float3{to{transform:translate(-14px,16px) rotate(-8deg)}}`;document.head.appendChild(st);\n\nconst control=document.querySelector(\".control-room\"),stage=document.getElementById(\"controlStage\"),kicker=document.getElementById(\"stageKicker\"),title=document.getElementById(\"stageTitle\");\nconst copy=[[\"Before Skin ID\",\"A visitor enters. The store shows products. The decision gets harder.\"],[\"The leak\",\"Too many options. No personal answer. No reason to buy the routine.\"],[\"Skin ID activated\",\"Signals become structure. Product chaos becomes decision logic.\"],[\"Decision engine\",\"Skin profile, catalog logic and buying intent connect in one path.\"],[\"After Skin ID\",\"The customer leaves with a complete routine, not confusion.\"]];\naddEventListener(\"scroll\",()=>{const r=control.getBoundingClientRect(),total=control.offsetHeight-innerHeight,p=Math.min(1,Math.max(0,-r.top/total));let s=p<.13?1:p<.30?2:p<.50?3:p<.68?4:5;stage.className=\"control-stage s\"+s;kicker.textContent=copy[s-1][0];title.textContent=copy[s-1][1];const black=document.querySelector(\".blackout\"),br=black.getBoundingClientRect(),bt=black.offsetHeight-innerHeight,bp=Math.min(1,Math.max(0,-br.top/bt));document.getElementById(\"blackoutBg\").style.opacity=.05+bp*.78;[\"f1\",\"f2\",\"f3\",\"f4\"].forEach((id,i)=>document.getElementById(id).classList.toggle(\"show\",bp>0.14+i*.16))});\n\nconst data={hydration:[\"Hydration-first routine\",\"91\",\"Repair barrier first\",\"Cleanser + serum + cream\",\"Bundle recommended\",\"Clear next step\"],sensitivity:[\"Sensitivity-safe routine\",\"88\",\"Reduce irritation risk\",\"Gentle cleanse + barrier cream\",\"Low-friction bundle\",\"Feels understood\"],acne:[\"Breakout-control routine\",\"86\",\"Clarify without stripping\",\"Cleanser + treatment + SPF\",\"Problem-solution bundle\",\"Confident choice\"],aging:[\"Texture-support routine\",\"90\",\"Support renewal gradually\",\"Serum + cream + SPF\",\"Premium routine path\",\"Higher trust\"]};\ndocument.querySelectorAll(\".chip\").forEach(chip=>chip.addEventListener(\"click\",()=>{document.querySelectorAll(\".chip\").forEach(c=>c.classList.remove(\"active\"));chip.classList.add(\"active\");const d=data[chip.dataset.mode];document.getElementById(\"resultTitle\").textContent=d[0];document.getElementById(\"score\").textContent=d[1];document.getElementById(\"decision\").textContent=d[2];document.getElementById(\"routine\").textContent=d[3];document.getElementById(\"cart\").textContent=d[4];document.getElementById(\"feeling\").textContent=d[5]}));\nconst range=document.getElementById(\"beliefRange\"),fill=document.getElementById(\"rangeFill\"),belief=document.getElementById(\"beliefText\");range.addEventListener(\"input\",()=>{const v=+range.value;fill.style.width=`calc(${v}% - 24px)`;belief.innerHTML=v<35?`Most skincare stores sell <span class=\"change word-products\">products.</span>`:v<70?`Better skincare stores sell <span class=\"change word-routines\">routines.</span>`:`Top skincare brands sell <span class=\"change word-decisions\">decisions.</span>`});\n\nconst fc=document.getElementById(\"finalCanvas\"),fctx=fc.getContext(\"2d\");let fps=[];\nfunction fsize(){fc.width=innerWidth;fc.height=innerHeight;fps=Array.from({length:120},()=>({x:Math.random()*fc.width,y:Math.random()*fc.height,vx:(Math.random()-.5)*.6,vy:(Math.random()-.5)*.6,s:Math.random()*2+1}))}\nfunction fdraw(){fctx.clearRect(0,0,fc.width,fc.height);for(let i=0;i<fps.length;i++){let p=fps[i];p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>fc.width)p.vx*=-1;if(p.y<0||p.y>fc.height)p.vy*=-1;fctx.beginPath();fctx.arc(p.x,p.y,p.s,0,Math.PI*2);fctx.fillStyle=i%2?\"rgba(255,231,163,.35)\":\"rgba(115,169,255,.32)\";fctx.fill();for(let j=i+1;j<fps.length;j++){let q=fps[j],dx=p.x-q.x,dy=p.y-q.y,d=Math.sqrt(dx*dx+dy*dy);if(d<110){fctx.beginPath();fctx.moveTo(p.x,p.y);fctx.lineTo(q.x,q.y);fctx.strokeStyle=`rgba(255,231,163,${(1-d/110)*.12})`;fctx.stroke()}}}requestAnimationFrame(fdraw)}\naddEventListener(\"resize\",fsize);fsize();fdraw();";

export default function App() {
  useEffect(() => {
    if (!(window as any).__nabiLandingInitialized) {
      (window as any).__nabiLandingInitialized = true;

      const runLandingScript = new Function(landingScript);
      runLandingScript();
    }

    const cleanupFaceSection = setupVisitorFaceSection();

    return () => {
      cleanupFaceSection();
    };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: landingHtml }} />;
}
