import { useEffect } from "react";

const calendlyUrl = "https://calendly.com/nabi_";
const heroModelSceneEvent = "nabi:hero-model-scene";

type HeroModelSceneDetail = {
  sceneIndex: number | null;
};

type StoryMetricCounter = {
  node: HTMLElement;
  suffix: string;
  target: number;
};

type ContrastSlideController = {
  slide: HTMLElement;
  setActive: (isActive: boolean) => void;
  destroy: () => void;
};

type FlowSlideController = {
  slide: HTMLElement;
  setActive: (isActive: boolean) => void;
  destroy: () => void;
};

function setupContrastSlides(root: HTMLElement): ContrastSlideController[] {
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  return Array.from(root.querySelectorAll<HTMLElement>(".story-slide-contrast")).map((slide) => {
    const grid = slide.querySelector<HTMLElement>(".story-contrast-grid");
    const bridge = slide.querySelector<HTMLElement>(".story-contrast-bridge");
    const rows = Array.from(slide.querySelectorAll<HTMLElement>(".story-contrast-row"));

    let settleTimeout = 0;

    const clearActivePair = () => {
      delete slide.dataset.activePair;
      rows.forEach((row) => {
        row.classList.remove("is-linked", "is-dimmed");
      });
      bridge?.classList.remove("is-active");
    };

    const positionBridge = (pairId: string) => {
      if (!grid || !bridge) {
        return;
      }

      const leftRow = slide.querySelector<HTMLElement>(
        `.story-contrast-row[data-pair="${pairId}"][data-side="left"]`,
      );
      const rightRow = slide.querySelector<HTMLElement>(
        `.story-contrast-row[data-pair="${pairId}"][data-side="right"]`,
      );

      if (!leftRow || !rightRow) {
        bridge.classList.remove("is-active");
        return;
      }

      const gridRect = grid.getBoundingClientRect();
      const leftRect = leftRow.getBoundingClientRect();
      const rightRect = rightRow.getBoundingClientRect();
      const startX = leftRect.right - gridRect.left - 16;
      const endX = rightRect.left - gridRect.left + 16;
      const startY = leftRect.top - gridRect.top + leftRect.height / 2;
      const endY = rightRect.top - gridRect.top + rightRect.height / 2;
      const dx = endX - startX;
      const dy = endY - startY;
      const distance = Math.max(0, Math.hypot(dx, dy));
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      bridge.style.setProperty("--story-contrast-line-left", `${startX}px`);
      bridge.style.setProperty("--story-contrast-line-top", `${startY}px`);
      bridge.style.setProperty("--story-contrast-line-width", `${distance}px`);
      bridge.style.setProperty("--story-contrast-line-angle", `${angle}deg`);
      bridge.classList.remove("is-active");
      void bridge.offsetWidth;
      bridge.classList.add("is-active");
    };

    const activatePair = (pairId?: string) => {
      if (!pairId || !slide.classList.contains("is-active")) {
        return;
      }

      slide.dataset.activePair = pairId;
      rows.forEach((row) => {
        const isLinked = row.dataset.pair === pairId;
        row.classList.toggle("is-linked", isLinked);
        row.classList.toggle("is-dimmed", !isLinked);
      });
      positionBridge(pairId);
    };

    const rowListeners = rows.map((row) => {
      const onPointerEnter = () => activatePair(row.dataset.pair);
      row.addEventListener("pointerenter", onPointerEnter);
      return { row, onPointerEnter };
    });

    const onGridPointerLeave = () => clearActivePair();
    grid?.addEventListener("pointerleave", onGridPointerLeave);

    const setActive = (isActive: boolean) => {
      window.clearTimeout(settleTimeout);
      slide.classList.remove("is-settled");

      if (!isActive) {
        clearActivePair();
        return;
      }

      if (reduceMotionQuery.matches) {
        slide.classList.add("is-settled");
        return;
      }

      settleTimeout = window.setTimeout(() => {
        slide.classList.add("is-settled");
      }, 1800);
    };

    return {
      slide,
      setActive,
      destroy: () => {
        window.clearTimeout(settleTimeout);
        clearActivePair();
        grid?.removeEventListener("pointerleave", onGridPointerLeave);
        rowListeners.forEach(({ row, onPointerEnter }) => {
          row.removeEventListener("pointerenter", onPointerEnter);
        });
      },
    };
  });
}

function setupFlowSlides(root: HTMLElement): FlowSlideController[] {
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  return Array.from(root.querySelectorAll<HTMLElement>(".story-slide-flow")).map((slide) => {
    const line = slide.querySelector<HTMLElement>(".story-flow-line");
    const steps = Array.from(slide.querySelectorAll<HTMLElement>(".story-flow-step"));
    const totalSteps = steps.length;
    const sequenceTimeouts: number[] = [];
    const replayTimeouts = new Map<HTMLElement, number>();
    let isActiveState = false;
    let currentStep = 0;

    const clearSequence = () => {
      sequenceTimeouts.forEach((timeout) => window.clearTimeout(timeout));
      sequenceTimeouts.length = 0;
      slide.classList.remove("is-settled");
      slide.style.setProperty("--story-flow-progress", "0%");
      currentStep = 0;

      steps.forEach((step) => {
        step.classList.remove("is-current", "is-complete", "is-replaying");
        step.dataset.state = "upcoming";
        step.setAttribute("aria-current", "false");
      });
    };

    const getStepProgress = (stepNumber: number) => {
      if (stepNumber >= totalSteps) {
        return "100%";
      }

      if (!line) {
        return totalSteps > 1 ? `${((stepNumber - 1) / (totalSteps - 1)) * 100}%` : "100%";
      }

      const step = steps[stepNumber - 1];
      const node = step?.querySelector<HTMLElement>(".story-flow-node");

      if (!step || !node) {
        return totalSteps > 1 ? `${((stepNumber - 1) / (totalSteps - 1)) * 100}%` : "100%";
      }

      const lineRect = line.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      const isVertical = lineRect.height > lineRect.width;

      if (isVertical) {
        const target = nodeRect.top + nodeRect.height * 0.5 - lineRect.top;
        const progress = lineRect.height > 0 ? target / lineRect.height : 0;
        return `${Math.max(0, Math.min(1, progress)) * 100}%`;
      }

      const target = nodeRect.left + nodeRect.width * 0.5 - lineRect.left;
      const progress = lineRect.width > 0 ? target / lineRect.width : 0;
      return `${Math.max(0, Math.min(1, progress)) * 100}%`;
    };

    const setStepState = (stepNumber: number) => {
      currentStep = stepNumber;
      slide.classList.toggle("is-settled", stepNumber === totalSteps);

      steps.forEach((step, index) => {
        const nextIndex = index + 1;
        const isCurrent = nextIndex === stepNumber;
        const isComplete = nextIndex < stepNumber;
        const state = isCurrent ? "current" : isComplete ? "complete" : "upcoming";

        step.classList.toggle("is-current", isCurrent);
        step.classList.toggle("is-complete", isComplete);
        step.dataset.state = state;
        step.setAttribute("aria-current", String(isCurrent));
      });

      slide.style.setProperty("--story-flow-progress", getStepProgress(stepNumber));
    };

    const replayStep = (step: HTMLElement) => {
      if (!slide.classList.contains("is-active") || !step.classList.contains("is-complete")) {
        return;
      }

      window.clearTimeout(replayTimeouts.get(step));
      step.classList.remove("is-replaying");
      void step.offsetWidth;
      step.classList.add("is-replaying");

      const timeout = window.setTimeout(() => {
        step.classList.remove("is-replaying");
        replayTimeouts.delete(step);
      }, 900);

      replayTimeouts.set(step, timeout);
    };

    const hoverListeners = steps.map((step) => {
      const onPointerEnter = () => replayStep(step);
      step.addEventListener("pointerenter", onPointerEnter);
      return { step, onPointerEnter };
    });

    const setActive = (isActive: boolean) => {
      if (isActive === isActiveState) {
        if (isActive && currentStep > 0) {
          slide.style.setProperty("--story-flow-progress", getStepProgress(currentStep));
        }

        return;
      }

      isActiveState = isActive;
      clearSequence();

      replayTimeouts.forEach((timeout) => window.clearTimeout(timeout));
      replayTimeouts.clear();

      if (!isActive) {
        return;
      }

      if (reduceMotionQuery.matches) {
        setStepState(totalSteps);
        return;
      }

      steps.forEach((_, index) => {
        const timeout = window.setTimeout(() => {
          if (!slide.classList.contains("is-active")) {
            return;
          }

          setStepState(index + 1);
        }, 260 + index * 1100);

        sequenceTimeouts.push(timeout);
      });
    };

    return {
      slide,
      setActive,
      destroy: () => {
        clearSequence();
        replayTimeouts.forEach((timeout) => window.clearTimeout(timeout));
        replayTimeouts.clear();
        hoverListeners.forEach(({ step, onPointerEnter }) => {
          step.removeEventListener("pointerenter", onPointerEnter);
        });
      },
    };
  });
}

function setupBrandStoryCarousel() {
  const root = document.querySelector<HTMLElement>(".brand-story");
  const track = root?.querySelector<HTMLElement>(".brand-story-track");
  const prevButton = root?.querySelector<HTMLButtonElement>('[data-story-nav="prev"]');
  const nextButton = root?.querySelector<HTMLButtonElement>('[data-story-nav="next"]');
  const currentNode = document.getElementById("brandStoryCurrent");
  const totalNode = document.getElementById("brandStoryTotal");
  const progressFill = document.getElementById("brandStoryProgressFill");
  const slides = track ? Array.from(track.querySelectorAll<HTMLElement>(".story-slide")) : [];
  const dotButtons = root
    ? Array.from(root.querySelectorAll<HTMLButtonElement>(".story-dot"))
    : [];

  if (
    !root ||
    !track ||
    !prevButton ||
    !nextButton ||
    !currentNode ||
    !totalNode ||
    !progressFill ||
    slides.length === 0
  ) {
    return () => undefined;
  }

  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const metricCounters: StoryMetricCounter[] = Array.from(
    root.querySelectorAll<HTMLElement>(".story-slide-scale .story-metric-value[data-target]"),
  )
    .map((node) => ({
      node,
      suffix: node.dataset.suffix ?? "",
      target: Number(node.dataset.target ?? "0"),
    }))
    .filter((counter) => Number.isFinite(counter.target));
  const mobileCompareToggleCleanups: Array<() => void> = [];
  const contrastSlideControllers: ContrastSlideController[] = [];
  const flowSlideControllers: FlowSlideController[] = [];

  let activeIndex = 0;
  let metricFrame = 0;
  let scrollFrame = 0;
  let settleTimeout = 0;
  let activePointerId: number | null = null;
  let dragStartX = 0;
  let dragStartScrollLeft = 0;
  let hasInitialized = false;
  let storyVisible = false;
  let storyAnimationFrame = 0;

  const resizeObserver = new ResizeObserver(() => {
    const nearestIndex = getNearestIndex();

    if (nearestIndex !== activeIndex) {
      updateActiveSlide(nearestIndex, false);
      return;
    }

    flowSlideControllers.forEach((controller) => {
      controller.setActive(controller.slide.classList.contains("is-active"));
    });
  });

  const formatMetric = (value: number, suffix: string) => `${Math.round(value)}${suffix}`;

  const syncStoryAnimations = () => {
    storyAnimationFrame = 0;

    root.getAnimations({ subtree: true }).forEach((animation) => {
      const target = (animation.effect as KeyframeEffect | null)?.target;
      const slide = target instanceof Element ? target.closest(".story-slide") : null;
      const shouldPlay =
        storyVisible && (!slide || slide.classList.contains("is-active"));

      if (shouldPlay && animation.playState === "paused") {
        animation.play();
      } else if (!shouldPlay && animation.playState === "running") {
        animation.pause();
      }
    });
  };

  const scheduleStoryAnimationSync = () => {
    window.cancelAnimationFrame(storyAnimationFrame);
    storyAnimationFrame = window.requestAnimationFrame(syncStoryAnimations);
  };

  const storyVisibilityObserver:
    | IntersectionObserver
    | { disconnect: () => void; observe: (target: Element) => void } = new IntersectionObserver(
    ([entry]) => {
      storyVisible = entry?.isIntersecting ?? false;
      scheduleStoryAnimationSync();
    },
    { threshold: 0.01 },
  );

  const storyRect = root.getBoundingClientRect();
  storyVisible = storyRect.bottom > 0 && storyRect.top < window.innerHeight;
  storyVisibilityObserver.observe(root);

  const cancelMetricAnimation = () => {
    window.cancelAnimationFrame(metricFrame);
    metricFrame = 0;
  };

  const setMetricsToTarget = () => {
    metricCounters.forEach((counter) => {
      counter.node.textContent = formatMetric(counter.target, counter.suffix);
    });
  };

  const animateMetrics = () => {
    cancelMetricAnimation();

    if (!metricCounters.length) {
      return;
    }

    if (reduceMotionQuery.matches) {
      setMetricsToTarget();
      return;
    }

    const durationMs = 880;
    const staggerMs = 85;
    const startedAt = performance.now();

    metricCounters.forEach((counter) => {
      counter.node.textContent = formatMetric(0, counter.suffix);
    });

    const render = (now: number) => {
      let hasPendingAnimation = false;

      metricCounters.forEach((counter, index) => {
        const localElapsed = now - startedAt - index * staggerMs;
        const localProgress = Math.min(1, Math.max(0, localElapsed / durationMs));
        const easedProgress = 1 - Math.pow(1 - localProgress, 3);

        counter.node.textContent = formatMetric(counter.target * easedProgress, counter.suffix);

        if (localProgress < 1) {
          hasPendingAnimation = true;
        }
      });

      if (hasPendingAnimation) {
        metricFrame = window.requestAnimationFrame(render);
      } else {
        setMetricsToTarget();
        metricFrame = 0;
      }
    };

    metricFrame = window.requestAnimationFrame(render);
  };

  const clampIndex = (value: number) => Math.max(0, Math.min(slides.length - 1, value));

  const getScrollTarget = (index: number) => {
    const style = window.getComputedStyle(track);
    const startPadding = Number.parseFloat(style.paddingLeft) || 0;
    return Math.max(0, slides[index].offsetLeft - startPadding);
  };

  const updateProgress = (index: number) => {
    currentNode.textContent = String(index + 1).padStart(2, "0");
    totalNode.textContent = String(slides.length).padStart(2, "0");
    progressFill.style.transform = `scaleX(${(index + 1) / slides.length})`;

    slides.forEach((slide, slideIndex) => {
      const state =
        slideIndex === index
          ? "active"
          : slideIndex === index + 1
            ? "peek"
            : slideIndex < index
              ? "past"
              : "upcoming";
      const isActive = slideIndex === index;

      slide.dataset.state = state;
      slide.classList.toggle("is-active", isActive);
      slide.classList.toggle("is-near-active", Math.abs(slideIndex - index) <= 1);
      slide.setAttribute("aria-current", isActive ? "true" : "false");
    });

    contrastSlideControllers.forEach((controller) => {
      controller.setActive(controller.slide.classList.contains("is-active"));
    });

    flowSlideControllers.forEach((controller) => {
      controller.setActive(controller.slide.classList.contains("is-active"));
    });

    dotButtons.forEach((button, buttonIndex) => {
      const isActive = buttonIndex === index;

      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    });

    prevButton.disabled = index === 0;
    nextButton.disabled = index === slides.length - 1;
    scheduleStoryAnimationSync();
  };

  const updateActiveSlide = (index: number, animateScaleMetrics = false) => {
    const nextIndex = clampIndex(index);
    const didChange = !hasInitialized || nextIndex !== activeIndex;

    if (!didChange) {
      if (nextIndex === 0 && animateScaleMetrics) {
        animateMetrics();
      }
      return;
    }

    activeIndex = nextIndex;
    hasInitialized = true;
    updateProgress(nextIndex);

    if (nextIndex === 0) {
      animateMetrics();
    }
  };

  const getNearestIndex = () => {
    const center = track.scrollLeft + track.clientWidth * 0.5;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    slides.forEach((slide, index) => {
      const slideCenter = slide.offsetLeft + slide.offsetWidth * 0.5;
      const distance = Math.abs(slideCenter - center);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    return nearestIndex;
  };

  const scrollToIndex = (index: number) => {
    const nextIndex = clampIndex(index);
    track.scrollTo({
      behavior: reduceMotionQuery.matches ? "auto" : "smooth",
      left: getScrollTarget(nextIndex),
    });
    updateActiveSlide(nextIndex, nextIndex === 0);
  };

  const onTrackScroll = () => {
    window.cancelAnimationFrame(scrollFrame);
    window.clearTimeout(settleTimeout);

    scrollFrame = window.requestAnimationFrame(() => {
      updateActiveSlide(getNearestIndex(), false);
    });

    settleTimeout = window.setTimeout(() => {
      updateActiveSlide(getNearestIndex(), true);
    }, 120);
  };

  const releasePointer = (pointerId?: number) => {
    if (activePointerId === null) {
      return;
    }

    const releasedPointerId = pointerId ?? activePointerId;

    if (track.hasPointerCapture(releasedPointerId)) {
      track.releasePointerCapture(releasedPointerId);
    }

    activePointerId = null;
    track.classList.remove("is-dragging");
    updateActiveSlide(getNearestIndex(), false);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || (event.pointerType !== "mouse" && event.pointerType !== "pen")) {
      return;
    }

    activePointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartScrollLeft = track.scrollLeft;
    track.classList.add("is-dragging");
    track.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (activePointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragStartX;
    track.scrollLeft = dragStartScrollLeft - deltaX;
  };

  const onPointerUp = (event: PointerEvent) => {
    releasePointer(event.pointerId);
  };

  const onLostPointerCapture = () => {
    releasePointer();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollToIndex(activeIndex + 1);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollToIndex(activeIndex - 1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      scrollToIndex(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      scrollToIndex(slides.length - 1);
    }
  };

  const onPrevClick = () => {
    scrollToIndex(activeIndex - 1);
  };

  const onNextClick = () => {
    scrollToIndex(activeIndex + 1);
  };

  const dotListeners = dotButtons.map((button, index) => {
    const handler = () => scrollToIndex(index);
    button.addEventListener("click", handler);
    return { button, handler };
  });
  const compareSlides = Array.from(root.querySelectorAll<HTMLElement>(".story-slide-scale"));

  compareSlides.forEach((slide) => {
    const compare = slide.querySelector<HTMLElement>(".story-commerce-compare[data-mobile-view]");
    const toggle = slide.querySelector<HTMLElement>(".story-commerce-toggle");

    if (!compare || !toggle) {
      return;
    }

    const buttons = Array.from(toggle.querySelectorAll<HTMLButtonElement>("[data-mobile-view-option]"));

    if (!buttons.length) {
      return;
    }

    const setMobileView = (nextView: string) => {
      const view = nextView === "chaos" ? "chaos" : "guided";
      compare.dataset.mobileView = view;

      buttons.forEach((button) => {
        const isActive = button.dataset.mobileViewOption === view;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });
    };

    buttons.forEach((button) => {
      const handler = () => setMobileView(button.dataset.mobileViewOption ?? "guided");
      button.addEventListener("click", handler);
      mobileCompareToggleCleanups.push(() => button.removeEventListener("click", handler));
    });

    setMobileView(compare.dataset.mobileView ?? buttons[0]?.dataset.mobileViewOption ?? "guided");
  });

  contrastSlideControllers.push(...setupContrastSlides(root));
  flowSlideControllers.push(...setupFlowSlides(root));

  prevButton.addEventListener("click", onPrevClick);
  nextButton.addEventListener("click", onNextClick);
  track.addEventListener("scroll", onTrackScroll, { passive: true });
  track.addEventListener("pointerdown", onPointerDown);
  track.addEventListener("pointermove", onPointerMove);
  track.addEventListener("pointerup", onPointerUp);
  track.addEventListener("pointercancel", onPointerUp);
  track.addEventListener("lostpointercapture", onLostPointerCapture);
  root.addEventListener("keydown", onKeyDown);
  resizeObserver.observe(track);

  updateActiveSlide(0, true);

  return () => {
    cancelMetricAnimation();
    window.cancelAnimationFrame(scrollFrame);
    window.cancelAnimationFrame(storyAnimationFrame);
    window.clearTimeout(settleTimeout);
    releasePointer();
    resizeObserver.disconnect();
    storyVisibilityObserver.disconnect();
    prevButton.removeEventListener("click", onPrevClick);
    nextButton.removeEventListener("click", onNextClick);
    track.removeEventListener("scroll", onTrackScroll);
    track.removeEventListener("pointerdown", onPointerDown);
    track.removeEventListener("pointermove", onPointerMove);
    track.removeEventListener("pointerup", onPointerUp);
    track.removeEventListener("pointercancel", onPointerUp);
    track.removeEventListener("lostpointercapture", onLostPointerCapture);
    root.removeEventListener("keydown", onKeyDown);
    dotListeners.forEach(({ button, handler }) => button.removeEventListener("click", handler));
    mobileCompareToggleCleanups.forEach((cleanup) => cleanup());
    contrastSlideControllers.forEach((controller) => controller.destroy());
    flowSlideControllers.forEach((controller) => controller.destroy());
  };
}

function setupHeroPlatformToggle() {
  const root = document.querySelector<HTMLElement>(".hero-platforms");
  const button = root?.querySelector<HTMLButtonElement>(".hero-platform-toggle");
  const panel = root?.querySelector<HTMLElement>(".hero-platform-panel");

  if (!root || !button || !panel) {
    return () => undefined;
  }

  let isOpen = false;

  const syncOpenState = (nextOpen: boolean) => {
    isOpen = nextOpen;
    root.dataset.open = nextOpen ? "true" : "false";
    button.setAttribute("aria-expanded", String(nextOpen));
    panel.setAttribute("aria-hidden", String(!nextOpen));
  };

  const onToggle = () => {
    syncOpenState(!isOpen);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!isOpen) {
      return;
    }

    const target = event.target;

    if (target instanceof Node && !root.contains(target)) {
      syncOpenState(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && isOpen) {
      syncOpenState(false);
      button.blur();
    }
  };

  syncOpenState(false);
  button.addEventListener("click", onToggle);
  document.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("keydown", onKeyDown);

  return () => {
    button.removeEventListener("click", onToggle);
    document.removeEventListener("pointerdown", onPointerDown);
    document.removeEventListener("keydown", onKeyDown);
  };
}

type HeroPoint = { x: number; y: number };
type HeroRect = { left: number; top: number; width: number; height: number };
type HeroParticle = {
  angle: number;
  alpha: number;
  color: string;
  depth: number;
  orbit: number;
  size: number;
  speed: number;
};

function setupHeroValueEngine() {
  const statement = document.querySelector<HTMLElement>(".hero-statement");
  const reel = statement?.querySelector<HTMLElement>(".hero-slot-reel");

  if (!statement || !reel) {
    return () => undefined;
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return () => undefined;
  }

  const touchDevice = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  const heroSection = statement.closest<HTMLElement>(".hero");
  statement.classList.add("is-enhanced");

  if (!touchDevice || !heroSection) {
    return () => {
      statement.classList.remove("is-enhanced");
    };
  }

  let heroVisible = false;
  let documentVisible = !document.hidden;
  const syncAnimationState = () => {
    reel.style.animationPlayState = heroVisible && documentVisible ? "running" : "paused";
  };
  const onVisibilityChange = () => {
    documentVisible = !document.hidden;
    syncAnimationState();
  };
  const heroObserver = new IntersectionObserver(
    ([entry]) => {
      heroVisible = entry?.isIntersecting ?? false;
      syncAnimationState();
    },
    { threshold: 0.01 },
  );
  const heroRect = heroSection.getBoundingClientRect();
  heroVisible = heroRect.bottom > 0 && heroRect.top < window.innerHeight;
  syncAnimationState();
  heroObserver.observe(heroSection);
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    heroObserver.disconnect();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    reel.style.removeProperty("animation-play-state");
    statement.classList.remove("is-enhanced");
  };
}

function setupDecisionSummaryBoard() {
  const stage = document.getElementById("controlStage");
  const boardModule = document.getElementById("decisionSummaryModule");
  const board = document.getElementById("decisionSummaryBoard");
  const action = document.getElementById("decisionSummaryAction") as HTMLButtonElement | null;
  const actionLabel = action?.querySelector<HTMLElement>(".decision-summary-action-label");
  const badge = document.getElementById("decisionSummaryBadge");
  const status = document.getElementById("decisionSummaryStatus");
  const confidenceFill = document.getElementById("decisionSummaryConfidenceFill");
  const confidenceValue = document.getElementById("decisionSummaryConfidenceValue");
  const completionGlow = document.getElementById("decisionSummaryCompletionGlow");
  const successWave = document.getElementById("decisionSummarySuccessWave");
  const checkIcon = document.getElementById("decisionSummaryCheckIcon");
  const scannedValue = document.getElementById("decisionSummaryScanned");
  const compatibleValue = document.getElementById("decisionSummaryCompatible");
  const candidatesValue = document.getElementById("decisionSummaryCandidates");
  const selectedValue = document.getElementById("decisionSummarySelected");
  const timelineSteps = Array.from(
    document.querySelectorAll<HTMLElement>(".decision-summary-timeline-step"),
  );
  const rows = {
    scanned: document.querySelector<HTMLElement>('.decision-summary-row[data-key="scanned"]'),
    compatible: document.querySelector<HTMLElement>('.decision-summary-row[data-key="compatible"]'),
    candidates: document.querySelector<HTMLElement>('.decision-summary-row[data-key="candidates"]'),
    selected: document.querySelector<HTMLElement>('.decision-summary-row[data-key="selected"]'),
    confidence: document.querySelector<HTMLElement>('.decision-summary-row[data-key="confidence"]'),
    status: document.querySelector<HTMLElement>('.decision-summary-row[data-key="status"]'),
  };

  if (
    !stage ||
    !board ||
    !action ||
    !actionLabel ||
    !badge ||
    !status ||
    !confidenceFill ||
    !confidenceValue ||
    !completionGlow ||
    !successWave ||
    !checkIcon ||
    !scannedValue ||
    !compatibleValue ||
    !candidatesValue ||
    !selectedValue ||
    timelineSteps.length !== 4 ||
    !rows.scanned ||
    !rows.compatible ||
    !rows.candidates ||
    !rows.selected ||
    !rows.confidence ||
    !rows.status
  ) {
    return () => undefined;
  }

  const stageNode = stage;
  const boardVisibilityTarget = boardModule ?? board;
  const boardNode = board;
  const actionNode = action;
  const actionLabelNode = actionLabel;
  const badgeNode = badge;
  const statusNode = status;
  const confidenceValueNode = confidenceValue;
  const completionGlowNode = completionGlow;
  const successWaveNode = successWave;
  const checkIconNode = checkIcon;
  const scannedValueNode = scannedValue;
  const compatibleValueNode = compatibleValue;
  const candidatesValueNode = candidatesValue;
  const selectedValueNode = selectedValue;
  const timelineOrder = ["scan", "profile", "matching", "routine"] as const;
  type TimelineKey = (typeof timelineOrder)[number];
  const timelineNodes = timelineSteps.reduce<Record<TimelineKey, HTMLElement>>(
    (accumulator, step) => {
      const key = step.dataset.stage as TimelineKey | undefined;

      if (key && timelineOrder.includes(key)) {
        accumulator[key] = step;
      }

      return accumulator;
    },
    {} as Record<TimelineKey, HTMLElement>,
  );

  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const steps = [
    {
      key: "scanned" as const,
      startMs: 180,
      durationMs: 580,
      target: 247,
      label: "Scanning products",
      render: (value: number) => {
        scannedValueNode.textContent = `${Math.round(value)}`;
      },
      complete: () => {
        scannedValueNode.textContent = "247";
      },
    },
    {
      key: "compatible" as const,
      startMs: 860,
      durationMs: 560,
      target: 81,
      label: "Filtering compatibility",
      render: (value: number, progress: number) => {
        compatibleValueNode.textContent = `${Math.round(value)}`;
        boardNode.style.setProperty("--decision-prune", (1 - progress * 0.64).toFixed(4));
      },
      complete: () => {
        compatibleValueNode.textContent = "81";
        boardNode.style.setProperty("--decision-prune", "0.36");
      },
    },
    {
      key: "candidates" as const,
      startMs: 1580,
      durationMs: 500,
      target: 19,
      label: "Ranking final candidates",
      render: (value: number) => {
        candidatesValueNode.textContent = `${Math.round(value)}`;
      },
      complete: () => {
        candidatesValueNode.textContent = "19";
      },
    },
    {
      key: "selected" as const,
      startMs: 2260,
      durationMs: 460,
      target: 4,
      label: "Selecting the routine",
      render: (value: number) => {
        selectedValueNode.textContent = `${Math.round(value)}`;
      },
      complete: () => {
        selectedValueNode.textContent = "4";
      },
    },
    {
      key: "confidence" as const,
      startMs: 2940,
      durationMs: 760,
      target: 96,
      label: "Calibrating confidence",
      render: (value: number, progress: number) => {
        const rounded = Math.round(value);
        confidenceValueNode.textContent = `${rounded}%`;
        boardNode.style.setProperty("--decision-confidence", `${rounded / 100}`);
        boardNode.style.setProperty("--decision-confidence-ring", progress.toFixed(4));
      },
      complete: () => {
        confidenceValueNode.textContent = "96%";
        boardNode.style.setProperty("--decision-confidence", "0.96");
        boardNode.style.setProperty("--decision-confidence-ring", "1");
      },
    },
    {
      key: "status" as const,
      startMs: 3880,
      durationMs: 360,
      target: 1,
      label: "Finalizing summary",
      render: (_value: number, progress: number) => {
        if (progress > 0.16) {
          statusNode.textContent = "Routine ready";
        }

        if (progress > 0.22) {
          checkIconNode.classList.add("is-done");
        }

        boardNode.style.setProperty("--decision-success", progress.toFixed(4));
        boardNode.style.setProperty("--decision-status-reveal", progress.toFixed(4));
      },
      complete: () => {
        boardNode.style.setProperty("--decision-success", "1");
        boardNode.style.setProperty("--decision-status-reveal", "1");
      },
    },
  ];
  const totalDurationMs = 4420;
  const placeholder = "\u2014";
  const completedKeys = new Set<string>();
  const rowPulseTimeouts = new Map<HTMLElement, number>();
  let animationFrame = 0;
  let runStartedAt = 0;
  let hasTriggered = false;
  let isRunning = false;
  let isComplete = false;
  let boardVisible = false;
  let documentVisible = !document.hidden;
  let replayRevealTimeout = 0;
  let stageLinkTimeout = 0;
  let activeRowKey: keyof typeof rows | null = null;

  function cancelBoardAnimationFrame() {
    window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  function setActionMode(mode: "run" | "running" | "replay") {
    actionNode.dataset.mode = mode;
    actionNode.disabled = mode === "running";
    actionLabelNode.textContent =
      mode === "replay"
        ? "Replay Analysis"
        : mode === "running"
          ? "Running analysis"
          : "Run the decision engine";
  }

  function clearReplayRevealTimeout() {
    window.clearTimeout(replayRevealTimeout);
    replayRevealTimeout = 0;
  }

  function clearStageLinkTimeout() {
    window.clearTimeout(stageLinkTimeout);
    stageLinkTimeout = 0;
  }

  function clearRowPulseTimeouts() {
    rowPulseTimeouts.forEach((timeout) => window.clearTimeout(timeout));
    rowPulseTimeouts.clear();
  }

  function getTimelineKeyForRow(key: keyof typeof rows): TimelineKey {
    if (key === "scanned") {
      return "scan";
    }

    if (key === "compatible") {
      return "profile";
    }

    if (key === "candidates" || key === "selected") {
      return "matching";
    }

    return "routine";
  }

  function setActiveTimeline(key: TimelineKey | null) {
    const activeIndex = key ? timelineOrder.indexOf(key) : -1;

    timelineOrder.forEach((timelineKey, index) => {
      const node = timelineNodes[timelineKey];

      node.classList.toggle("is-active", timelineKey === key);
      node.classList.toggle("is-complete", activeIndex > index);
    });
  }

  function completeTimeline() {
    timelineOrder.forEach((timelineKey) => {
      const node = timelineNodes[timelineKey];

      node.classList.remove("is-active");
      node.classList.add("is-complete");
    });
  }

  function resetTimeline() {
    timelineOrder.forEach((timelineKey) => {
      const node = timelineNodes[timelineKey];

      node.classList.remove("is-active", "is-complete");
    });
  }

  function triggerStageLinkPulse() {
    stageNode.classList.remove("is-decision-linked");
    clearStageLinkTimeout();
    void stageNode.offsetWidth;
    stageNode.classList.add("is-decision-linked");
    stageLinkTimeout = window.setTimeout(() => {
      stageNode.classList.remove("is-decision-linked");
      stageLinkTimeout = 0;
    }, 1500);
  }

  function setActiveRow(key: keyof typeof rows | null) {
    if (activeRowKey === key) {
      return;
    }

    if (activeRowKey) {
      rows[activeRowKey]?.classList.remove("is-active");
    }

    activeRowKey = key;

    if (key) {
      rows[key]?.classList.add("is-active");
      setActiveTimeline(getTimelineKeyForRow(key));
    } else {
      setActiveTimeline(null);
    }
  }

  function markRowComplete(key: keyof typeof rows) {
    const row = rows[key];

    row?.classList.add("is-complete", "is-settling");
    row?.classList.remove("is-active");

    if (!row) {
      return;
    }

    const existing = rowPulseTimeouts.get(row);

    if (existing) {
      window.clearTimeout(existing);
    }

    const timeout = window.setTimeout(() => {
      row.classList.remove("is-settling");
      rowPulseTimeouts.delete(row);
    }, 560);

    rowPulseTimeouts.set(row, timeout);
  }

  function resetBoard() {
    completedKeys.clear();
    clearReplayRevealTimeout();
    clearStageLinkTimeout();
    clearRowPulseTimeouts();
    setActiveRow(null);
    resetTimeline();
    boardNode.dataset.state = "idle";
    boardNode.style.setProperty("--decision-confidence", "0");
    boardNode.style.setProperty("--decision-confidence-ring", "0");
    boardNode.style.setProperty("--decision-prune", "1");
    boardNode.style.setProperty("--decision-success", "0");
    boardNode.style.setProperty("--decision-status-reveal", "0");
    badgeNode.textContent = "\u2713 Analysis Complete";
    statusNode.textContent = "Waiting for analysis";
    scannedValueNode.textContent = placeholder;
    compatibleValueNode.textContent = placeholder;
    candidatesValueNode.textContent = placeholder;
    selectedValueNode.textContent = placeholder;
    confidenceValueNode.textContent = placeholder;
    [rows.scanned, rows.compatible, rows.candidates, rows.selected, rows.confidence, rows.status].forEach((row) => {
      row?.classList.remove("is-complete", "is-active", "is-settling");
    });
    completionGlowNode.classList.remove("is-visible");
    successWaveNode.classList.remove("is-visible");
    checkIconNode.classList.remove("is-done");
    actionNode.classList.remove("is-replay-visible");
    stageNode.classList.remove("is-decision-linked");
    setActionMode("run");
    isRunning = false;
    isComplete = false;
  }

  function finishBoard(showReplayImmediately = false) {
    isRunning = false;
    isComplete = true;
    setActiveRow(null);
    boardNode.dataset.state = "complete";
    badgeNode.textContent = "\u2713 Analysis Complete";
    statusNode.textContent = "Routine ready";
    boardNode.style.setProperty("--decision-confidence", "0.96");
    boardNode.style.setProperty("--decision-confidence-ring", "1");
    boardNode.style.setProperty("--decision-prune", "0.36");
    boardNode.style.setProperty("--decision-success", "1");
    boardNode.style.setProperty("--decision-status-reveal", "1");
    completionGlowNode.classList.add("is-visible");
    checkIconNode.classList.add("is-done");
    completeTimeline();
    [rows.scanned, rows.compatible, rows.candidates, rows.selected, rows.confidence, rows.status].forEach((row) => {
      row?.classList.add("is-complete");
      row?.classList.remove("is-active");
    });
    successWaveNode.classList.remove("is-visible");
    void successWaveNode.offsetWidth;
    successWaveNode.classList.add("is-visible");
    triggerStageLinkPulse();
    setActionMode("replay");
    actionNode.classList.remove("is-replay-visible");

    if (showReplayImmediately) {
      actionNode.classList.add("is-replay-visible");
    } else {
      replayRevealTimeout = window.setTimeout(() => {
        actionNode.classList.add("is-replay-visible");
      }, 2000);
    }
  }

  function setReducedMotionComplete() {
    resetBoard();
    scannedValueNode.textContent = "247";
    compatibleValueNode.textContent = "81";
    candidatesValueNode.textContent = "19";
    selectedValueNode.textContent = "4";
    confidenceValueNode.textContent = "96%";
    finishBoard(true);
  }

  function animateFrame(now: number) {
    const elapsed = now - runStartedAt;
    const overallProgress = Math.min(1, elapsed / totalDurationMs);

    boardNode.style.setProperty("--decision-overall", overallProgress.toFixed(4));

    for (const step of steps) {
      const localProgress = Math.min(1, Math.max(0, (elapsed - step.startMs) / step.durationMs));

      if (localProgress > 0 && localProgress < 1) {
        boardNode.dataset.state = "running";
        setActiveRow(step.key);
      }

      if (localProgress > 0) {
        if (step.key !== "status") {
          const currentValue = step.target * localProgress;
          step.render(currentValue, localProgress);
        } else {
          step.render(localProgress, localProgress);
        }
      }

      if (localProgress >= 1 && !completedKeys.has(step.key)) {
        completedKeys.add(step.key);
        step.complete();
        markRowComplete(step.key);
      }
    }

    if (elapsed >= totalDurationMs) {
      finishBoard();
      return;
    }

    animationFrame = window.requestAnimationFrame(animateFrame);
  }

  function runBoard() {
    cancelBoardAnimationFrame();
    hasTriggered = true;

    if (reduceMotionQuery.matches) {
      setReducedMotionComplete();
      return;
    }

    resetBoard();
    isRunning = true;
    boardNode.dataset.state = "running";
    setActionMode("running");
    runStartedAt = performance.now();
    animationFrame = window.requestAnimationFrame(animateFrame);
  }

  function canAutoRun() {
    return boardVisible && documentVisible && stageNode.classList.contains("s5");
  }

  function resetBoardForVisibilityLoss() {
    if (!isRunning) {
      return;
    }

    cancelBoardAnimationFrame();
    resetBoard();
    hasTriggered = false;
  }

  function maybeAutoRun() {
    if (hasTriggered || !canAutoRun()) {
      return;
    }

    runBoard();
  }

  const onActionClick = () => {
    if (isRunning) {
      return;
    }

    if (isComplete) {
      runBoard();
      return;
    }

    runBoard();
  };

  const stageObserver = new MutationObserver(maybeAutoRun);
  const boardVisibilityObserver = new IntersectionObserver(
    ([entry]) => {
      boardVisible = entry?.isIntersecting ?? false;

      if (!boardVisible) {
        resetBoardForVisibilityLoss();
        return;
      }

      maybeAutoRun();
    },
    { threshold: 0.18 },
  );
  const onVisibilityChange = () => {
    documentVisible = !document.hidden;

    if (!documentVisible) {
      resetBoardForVisibilityLoss();
      return;
    }

    maybeAutoRun();
  };

  stageObserver.observe(stageNode, { attributes: true, attributeFilter: ["class"] });
  actionNode.addEventListener("click", onActionClick);
  const boardRect = boardVisibilityTarget.getBoundingClientRect();
  boardVisible = boardRect.bottom > 0 && boardRect.top < window.innerHeight;
  boardVisibilityObserver.observe(boardVisibilityTarget);
  document.addEventListener("visibilitychange", onVisibilityChange);
  resetBoard();
  maybeAutoRun();

  return () => {
    cancelBoardAnimationFrame();
    clearReplayRevealTimeout();
    clearStageLinkTimeout();
    clearRowPulseTimeouts();
    actionNode.removeEventListener("click", onActionClick);
    stageObserver.disconnect();
    boardVisibilityObserver.disconnect();
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}

function setupHeroSceneTransitions() {
  const cinema = document.getElementById("cinema");
  const heroSim = cinema?.querySelector<HTMLElement>(".hero-sim");
  const scenes = heroSim ? Array.from(heroSim.querySelectorAll<HTMLElement>(".hero-scene")) : [];
  const touchDevice = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  const mobileDiagnostic = touchDevice && document.body.classList.contains("mobile-diagnostic");

  if (!cinema || !heroSim || scenes.length !== 5) {
    return () => undefined;
  }

  const canvas = document.getElementById("heroCanvas") as HTMLCanvasElement | null;

  if (!canvas) {
    return () => undefined;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return () => undefined;
  }

  const heroCinema = cinema;
  const heroSection = heroCinema.closest<HTMLElement>(".hero");
  const heroCanvas = canvas;
  const heroContext = context;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const maxPixelRatio = touchDevice ? 1 : 1.5;
  const palette = ["115,169,255", "244,221,176", "247,241,232"];
  const holdMs = 5000;
  const profilePulseDurationMs = 2500;
  const profileSceneHoldMs = profilePulseDurationMs * 4;
  const matchSceneHoldMs = holdMs + 1500;
  const routineSceneHoldMs = holdMs + 4000;
  const resultSceneHoldMs = routineSceneHoldMs + 2000;
  const transitionMs = 1200;
  const sceneHoldDurations = [
    holdMs,
    profileSceneHoldMs,
    matchSceneHoldMs,
    routineSceneHoldMs,
    resultSceneHoldMs,
  ];
  const sceneSegmentDurations = sceneHoldDurations.map((sceneHold) => sceneHold + transitionMs);
  const loopMs = sceneSegmentDurations.reduce((total, duration) => total + duration, 0);
  const particleCount = touchDevice ? 144 : 320;
  const mouse = { x: 0.5, y: 0.5 };
  const scanConfirmationMs = 420;
  const scanAnalysisMs = Math.max(holdMs - scanConfirmationMs, 1);
  const scanPhaseLabels = ["Initializing", "Surface read", "Profile mapping", "Finalizing"];
  const scanScene = heroCinema.querySelector<HTMLElement>(".scene-scan");
  const scanFrame = heroCinema.querySelector<HTMLElement>(".scene-scan .face-shell");
  const scanPhaseValue = heroCinema.querySelector<HTMLElement>(".scene-scan .scan-phase-value");
  const scanPhaseMarkers = Array.from(
    heroCinema.querySelectorAll<HTMLElement>(".scene-scan .scan-phase-marker"),
  );
  const profilePhaseLabels = [
    "Resolving skin type",
    "Mapping sensitivity",
    "Linking exposure profile",
    "Inferring primary goal",
    "Profile assembled",
  ];
  const profileScene = heroCinema.querySelector<HTMLElement>(".scene-profile");
  const profilePhaseValue = heroCinema.querySelector<HTMLElement>(".scene-profile .profile-phase-value");
  const matchSceneIndex = 2;
  const matchScene = heroCinema.querySelector<HTMLElement>(".scene-match");
  const matchPhaseValue = heroCinema.querySelector<HTMLElement>(".scene-match .match-phase-value");
  const matchCoreLabel = heroCinema.querySelector<HTMLElement>(".scene-match .engine-core-label");
  const matchCounterLabel = heroCinema.querySelector<HTMLElement>(".scene-match .match-counter-label");
  const matchCounterValue = heroCinema.querySelector<HTMLElement>(".scene-match .match-counter-value");
  const matchCatalogChips = Array.from(heroCinema.querySelectorAll<HTMLElement>(".scene-match .catalog-chip"));
  const matchTargetChips = Array.from(
    heroCinema.querySelectorAll<HTMLElement>(".scene-match .catalog-chip.is-target"),
  );
  const matchSelectionDurationMs = 860;
  const matchSelectionStartMs = 2350;
  const matchSelectionStaggerMs = 850;
  const matchNonTargetFadeMs = 2600;
  const matchPhaseLabels = [
    "Catalog search live",
    "Compatibility matching",
    "Decision ranking",
    "Selection locking",
    "Routine ready",
  ];
  const matchEngineLabels = ["Searching...", "Matching...", "Ranking...", "Selecting..."];
  const matchSelectionLabels = ["Cleanser", "Serum", "Moisturizer", "SPF"];
  const matchCounterStates = [
    { label: "Catalog", value: "247 products" },
    { label: "Compatible", value: "81 products" },
    { label: "Candidates", value: "19 products" },
    { label: "Selected", value: "4 products" },
  ];
  const matchTargetFamilies = ["cleanser", "serum", "moisturizer", "spf"];
  const routineSceneIndex = 3;
  const routineMeterFill = heroCinema.querySelector<HTMLElement>(".scene-routine .sheet-meter span");
  const routineSceneRows = Array.from(heroCinema.querySelectorAll<HTMLElement>(".scene-routine .sheet-row"));
  const routineRevealStarts = [450, 700, 950, 1200];
  const routineRevealDurationMs = 360;
  const routineMeterDurationMs = 1100;
  const resultSceneIndex = 4;
  const resultScene = heroCinema.querySelector<HTMLElement>(".scene-result");
  const resultTitle = heroCinema.querySelector<HTMLElement>(".scene-result .result-title");
  const resultLead = heroCinema.querySelector<HTMLElement>(".scene-result .result-lead");
  const resultStatus = heroCinema.querySelector<HTMLElement>(".scene-result .result-status-value");
  const resultChecklist = Array.from(
    heroCinema.querySelectorAll<HTMLElement>(".scene-result .result-check-item"),
  );
  const resultRoutineChips = Array.from(
    heroCinema.querySelectorAll<HTMLElement>(".scene-result .result-routine-chip"),
  );
  const resultChecklistStarts = [650, 1100, 1550, 2000];
  const resultChecklistDurationMs = 420;
  const resultRoutineStartMs = 2550;
  const resultRoutineStaggerMs = 150;
  const resultRoutineDurationMs = 320;
  const sceneTargetNodes = {
    faceShell: heroCinema.querySelector<HTMLElement>(".scene-scan .face-shell"),
    faceCore: heroCinema.querySelector<HTMLElement>(".scene-scan .face-core"),
    faceVisual: heroCinema.querySelector<HTMLElement>(".scene-scan .face-visual"),
    faceBeam: heroCinema.querySelector<HTMLElement>(".scene-scan .face-beam"),
    faceRing: heroCinema.querySelector<HTMLElement>(".scene-scan .face-ring"),
    analysisZones: Array.from(heroCinema.querySelectorAll<HTMLElement>(".scene-scan .analysis-zone")),
    scanTrack: heroCinema.querySelector<HTMLElement>(".scene-scan .scan-phase-track"),
    scanMarkers: Array.from(heroCinema.querySelectorAll<HTMLElement>(".scene-scan .scan-phase-marker")),
    scanConfirmation: heroCinema.querySelector<HTMLElement>(".scene-scan .scan-confirmation"),
    profilePills: Array.from(heroCinema.querySelectorAll<HTMLElement>(".scene-profile .profile-pill")),
    matchCore: heroCinema.querySelector<HTMLElement>(".scene-match .selection-engine-core"),
    matchChips: Array.from(heroCinema.querySelectorAll<HTMLElement>(".scene-match .catalog-chip")),
    routineTitle: heroCinema.querySelector<HTMLElement>(".scene-routine .sheet-title"),
    routineRows: Array.from(heroCinema.querySelectorAll<HTMLElement>(".scene-routine .sheet-row")),
    resultTitleNode: heroCinema.querySelector<HTMLElement>(".scene-result .result-title"),
    resultLeadNode: heroCinema.querySelector<HTMLElement>(".scene-result .result-lead"),
    resultStatusNode: heroCinema.querySelector<HTMLElement>(".scene-result .result-status"),
    resultCheckNode: heroCinema.querySelector<HTMLElement>(".scene-result .result-checkmark"),
    resultItems: Array.from(heroCinema.querySelectorAll<HTMLElement>(".scene-result .result-check-item")),
    resultSummary: Array.from(
      heroCinema.querySelectorAll<HTMLElement>(".scene-result .result-routine-chip"),
    ),
  };
  const particles: HeroParticle[] = Array.from({ length: particleCount }, (_, index) => {
    const seed = index + 1;

    return {
      angle: ((seed * 29) % 360) * (Math.PI / 180),
      alpha: 0.52 + seededNoise(seed * 11) * 0.34,
      color: palette[index % palette.length],
      depth: 0.8 + seededNoise(seed * 17) * 0.8,
      orbit: 28 + seededNoise(seed * 7) * 62,
      size: 0.9 + seededNoise(seed * 5) * 2.9,
      speed: 0.85 + seededNoise(seed * 19) * 1.55,
    };
  });

  let animationFrame = 0;
  let destroyed = false;
  let width = 0;
  let height = 0;
  let sceneTargets: HeroPoint[][] = [];
  let loopStartTime: number | null = null;
  let activeScanPhase = -1;
  let activeProfilePhase = -1;
  let isVisible = true;
  let documentVisible = !document.hidden;
  let publishedModelScene: number | null | undefined;
  let pauseTimestamp: number | null = null;
  const sceneAnimationStates = new WeakMap<HTMLElement, boolean>();

  heroCinema.style.setProperty("--hero-loop", `${loopMs / 1000}s`);

  function seededNoise(seed: number) {
    const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
    return value - Math.floor(value);
  }

  function lerp(start: number, end: number, progress: number) {
    return start + (end - start) * progress;
  }

  function clamp(value: number, min = 0, max = 1) {
    return Math.min(max, Math.max(min, value));
  }

  function easeInOut(progress: number) {
    if (progress <= 0) {
      return 0;
    }

    if (progress >= 1) {
      return 1;
    }

    return progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
  }

  function relativeRect(element: Element): HeroRect {
    const cinemaRect = heroCinema.getBoundingClientRect();
    const rect = element.getBoundingClientRect();

    return {
      left: rect.left - cinemaRect.left,
      top: rect.top - cinemaRect.top,
      width: rect.width,
      height: rect.height,
    };
  }

  function centerPoint(rect: HeroRect): HeroPoint {
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function normalizePoints(points: HeroPoint[], count: number): HeroPoint[] {
    if (!points.length) {
      return Array.from({ length: count }, () => ({ x: width / 2, y: height / 2 }));
    }

    return Array.from({ length: count }, (_, index) => {
      const mappedIndex = Math.floor((index / count) * points.length);
      return points[mappedIndex] ?? points[points.length - 1];
    });
  }

  function sampleRectFill(rect: HeroRect, count: number, seedOffset: number) {
    return Array.from({ length: count }, (_, index) => {
      const px = seededNoise(seedOffset + index * 2 + 1);
      const py = seededNoise(seedOffset + index * 2 + 2);
      return {
        x: rect.left + rect.width * (0.12 + px * 0.76),
        y: rect.top + rect.height * (0.16 + py * 0.68),
      };
    });
  }

  function sampleRectOutline(rect: HeroRect, count: number) {
    return Array.from({ length: count }, (_, index) => {
      const progress = index / Math.max(1, count - 1);
      const perimeter = 2 * (rect.width + rect.height);
      const distance = progress * perimeter;

      if (distance <= rect.width) {
        return { x: rect.left + distance, y: rect.top };
      }

      if (distance <= rect.width + rect.height) {
        return { x: rect.left + rect.width, y: rect.top + (distance - rect.width) };
      }

      if (distance <= rect.width * 2 + rect.height) {
        return {
          x: rect.left + rect.width - (distance - rect.width - rect.height),
          y: rect.top + rect.height,
        };
      }

      return {
        x: rect.left,
        y: rect.top + rect.height - (distance - rect.width * 2 - rect.height),
      };
    });
  }

  function sampleLine(start: HeroPoint, end: HeroPoint, count: number) {
    return Array.from({ length: count }, (_, index) => {
      const progress = index / Math.max(1, count - 1);
      return {
        x: lerp(start.x, end.x, progress),
        y: lerp(start.y, end.y, progress),
      };
    });
  }

  function sampleEllipse(rect: HeroRect, count: number, insetX = 0.18, insetY = 0.12) {
    const center = centerPoint(rect);
    const radiusX = rect.width * (0.5 - insetX);
    const radiusY = rect.height * (0.5 - insetY);

    return Array.from({ length: count }, (_, index) => {
      const angle = (index / count) * Math.PI * 2;
      return {
        x: center.x + Math.cos(angle) * radiusX,
        y: center.y + Math.sin(angle) * radiusY,
      };
    });
  }

  function sampleCluster(rect: HeroRect, count: number, seedOffset: number) {
    const center = centerPoint(rect);
    const radiusX = rect.width * 0.9;
    const radiusY = rect.height * 0.9;

    return Array.from({ length: count }, (_, index) => {
      const angle = seededNoise(seedOffset + index * 3 + 1) * Math.PI * 2;
      const spread = Math.sqrt(seededNoise(seedOffset + index * 3 + 2));
      return {
        x: center.x + Math.cos(angle) * radiusX * spread,
        y: center.y + Math.sin(angle) * radiusY * spread,
      };
    });
  }

  function beamGlow(progress: number, center: number, widthValue: number) {
    return Math.pow(clamp(1 - Math.abs(progress - center) / widthValue), 1.8);
  }

  function pulseWindowMs(progressMs: number, startMs: number, durationMs: number) {
    const local = clamp((progressMs - startMs) / Math.max(durationMs, 1));

    if (local <= 0 || local >= 1) {
      return 0;
    }

    return Math.sin(local * Math.PI);
  }

  function setScanSceneVar(name: string, value: number | string) {
    scanScene?.style.setProperty(name, typeof value === "number" ? value.toFixed(4) : value);
  }

  function setProfileSceneVar(name: string, value: number | string) {
    profileScene?.style.setProperty(name, typeof value === "number" ? value.toFixed(4) : value);
  }

  function setMatchSceneVar(name: string, value: number | string) {
    matchScene?.style.setProperty(name, typeof value === "number" ? value.toFixed(4) : value);
  }

  function updateScanPhaseMarkers(activeIndex: number, completedCount: number) {
    scanPhaseMarkers.forEach((marker, index) => {
      marker.classList.toggle("is-active", index === activeIndex);
      marker.classList.toggle("is-complete", index < completedCount);
    });
  }

  function resetScanSceneState() {
    if (scanPhaseValue) {
      scanPhaseValue.textContent = scanPhaseLabels[0];
    }

    activeScanPhase = 0;
    scanScene?.classList.remove("is-confirming", "is-transitioning");
    setScanSceneVar("--scan-progress", 0);
    setScanSceneVar("--scan-readout", 1);
    setScanSceneVar("--scan-confirmation", 0);
    setScanSceneVar("--scan-beam-y", "22%");
    setScanSceneVar("--scan-beam-opacity", 0.28);
    setScanSceneVar("--scan-ambient", 0.48);
    setScanSceneVar("--wire-major", 0.1);
    setScanSceneVar("--wire-secondary", 0);
    setScanSceneVar("--wire-tertiary", 0);
    setScanSceneVar("--orbit-opacity", 0.22);
    setScanSceneVar("--scan-transition", 0);
    setScanSceneVar("--zone-hydration-a", 0);
    setScanSceneVar("--zone-hydration-b", 0);
    setScanSceneVar("--zone-barrier", 0);
    setScanSceneVar("--zone-sensitivity", 0);
    updateScanPhaseMarkers(0, 0);
  }

  function resetProfileSceneState() {
    if (profilePhaseValue) {
      profilePhaseValue.textContent = "Analyzing profile";
    }

    activeProfilePhase = 0;
    profileScene?.classList.remove("is-holding", "is-transitioning");
    setProfileSceneVar("--profile-reveal-a", 0);
    setProfileSceneVar("--profile-reveal-b", 0);
    setProfileSceneVar("--profile-reveal-c", 0);
    setProfileSceneVar("--profile-reveal-d", 0);
    setProfileSceneVar("--profile-pulse-a", 0);
    setProfileSceneVar("--profile-pulse-b", 0);
    setProfileSceneVar("--profile-pulse-c", 0);
    setProfileSceneVar("--profile-pulse-d", 0);
    setProfileSceneVar("--profile-ambient", 0.18);
    setProfileSceneVar("--profile-line", 0.08);
    setProfileSceneVar("--profile-status", 0.42);
  }

  function resetRoutineSceneState() {
    if (routineMeterFill) {
      routineMeterFill.style.transform = "scaleX(0)";
    }

    routineSceneRows.forEach((row) => {
      row.style.opacity = "0";
      row.style.transform = "translate3d(0,12px,0)";
      row.style.setProperty("--routine-row-progress", "0");
    });
  }

  function resetResultSceneState() {
    if (resultTitle) {
      resultTitle.textContent = "Personalization complete";
    }

    if (resultLead) {
      resultLead.textContent =
        "Skin ID finished the routine with a profile match, a curated selection, and a cart-ready bundle.";
    }

    if (resultStatus) {
      resultStatus.textContent = "Routine successfully generated";
    }

    resultScene?.classList.remove("is-transitioning", "is-settled");
    resultScene?.style.setProperty("--result-arrival", "0");
    resultScene?.style.setProperty("--result-glow", "0");
    resultScene?.style.setProperty("--result-bloom", "0");
    resultScene?.style.setProperty("--result-idle", "0");
    resultScene?.style.setProperty("--result-transition", "0");

    resultChecklist.forEach((item) => {
      item.style.opacity = "0";
      item.style.transform = "translate3d(0,14px,0) scale(.97)";
    });

    resultRoutineChips.forEach((chip) => {
      chip.style.opacity = "0";
      chip.style.transform = "translate3d(0,12px,0) scale(.96)";
    });
  }

  function resetMatchSceneState() {
    if (matchPhaseValue) {
      matchPhaseValue.textContent = matchPhaseLabels[0];
    }

    if (matchCoreLabel) {
      matchCoreLabel.textContent = matchEngineLabels[0];
    }

    if (matchCounterLabel) {
      matchCounterLabel.textContent = matchCounterStates[0].label;
    }

    if (matchCounterValue) {
      matchCounterValue.textContent = matchCounterStates[0].value;
    }

    matchScene?.classList.remove("is-evaluating", "has-selection", "is-transitioning");
    setMatchSceneVar("--match-ambient", 0.18);
    setMatchSceneVar("--match-core-pulse", 0.18);
    setMatchSceneVar("--match-dim", 0);
    setMatchSceneVar("--match-wave", 0);
    setMatchSceneVar("--match-flash", 0);
    setMatchSceneVar("--match-transition", 0);

    matchCatalogChips.forEach((chip) => {
      chip.classList.remove("is-dimmed", "is-receding", "is-selected", "is-active");
      chip.style.removeProperty("--match-selected-x");
      chip.style.removeProperty("--match-selected-y");
      chip.style.removeProperty("--match-selected-rotate");
      chip.style.removeProperty("--match-selected-opacity");
      chip.style.removeProperty("--match-reject-x");
      chip.style.removeProperty("--match-reject-y");
      chip.style.removeProperty("--match-reject-rotate");
    });
  }

  function updateScanSceneState(
    current: number,
    next: number,
    segmentProgress: number,
    transition: boolean,
    transitionProgress: number,
  ) {
    if (!scanScene || !scanFrame) {
      return;
    }

    if (current !== 0) {
      resetScanSceneState();
      return;
    }

    const analysisProgress = clamp(segmentProgress / scanAnalysisMs);
    const isConfirming = !transition && segmentProgress >= scanAnalysisMs;
    const beamProgress = isConfirming
      ? 1
      : easeInOut(clamp((analysisProgress - 0.06) / 0.94));
    const phaseIndex = isConfirming
      ? scanPhaseLabels.length - 1
      : analysisProgress < 0.18
        ? 0
        : analysisProgress < 0.46
          ? 1
          : analysisProgress < 0.78
            ? 2
            : 3;
    const completedCount = isConfirming ? scanPhaseLabels.length : phaseIndex;
    const majorReveal = clamp((analysisProgress - 0.06) / 0.24);
    const secondaryReveal = clamp((analysisProgress - 0.24) / 0.24);
    const tertiaryReveal = clamp((analysisProgress - 0.54) / 0.24);
    const completionProgress = isConfirming
      ? easeInOut(clamp((segmentProgress - scanAnalysisMs) / scanConfirmationMs))
      : 0;
    const transitionMix = transition ? transitionProgress : 0;
    const readoutOpacity = isConfirming ? lerp(1, 0.38, completionProgress) : 1;
    const beamOpacity = transition
      ? lerp(0.8, 0.16, transitionProgress)
      : isConfirming
        ? lerp(0.9, 0.42, completionProgress)
        : 0.82;
    const zoneFade = 1 - transitionMix * 0.82;
    const hydrationA =
      beamGlow(beamProgress, 0.3, 0.21) * clamp((analysisProgress - 0.2) / 0.2) * zoneFade;
    const barrier =
      beamGlow(beamProgress, 0.48, 0.18) * clamp((analysisProgress - 0.42) / 0.18) * zoneFade;
    const sensitivity =
      beamGlow(beamProgress, 0.62, 0.18) * clamp((analysisProgress - 0.58) / 0.16) * zoneFade;
    const hydrationB =
      beamGlow(beamProgress, 0.78, 0.16) * clamp((analysisProgress - 0.72) / 0.14) * zoneFade;

    if (activeScanPhase !== phaseIndex && scanPhaseValue) {
      scanPhaseValue.textContent = scanPhaseLabels[phaseIndex];
      activeScanPhase = phaseIndex;
    }

    scanScene.classList.toggle("is-confirming", isConfirming || (transition && next === 1));
    scanScene.classList.toggle("is-transitioning", transition);
    setScanSceneVar("--scan-progress", isConfirming ? 1 : analysisProgress);
    setScanSceneVar("--scan-readout", readoutOpacity);
    setScanSceneVar(
      "--scan-confirmation",
      transition ? 1 - transitionProgress * 0.18 : completionProgress,
    );
    setScanSceneVar("--scan-beam-y", `${lerp(22, 74, beamProgress).toFixed(2)}%`);
    setScanSceneVar("--scan-beam-opacity", beamOpacity);
    setScanSceneVar("--scan-ambient", 0.5 + majorReveal * 0.18 + secondaryReveal * 0.12);
    setScanSceneVar("--wire-major", majorReveal);
    setScanSceneVar("--wire-secondary", secondaryReveal);
    setScanSceneVar("--wire-tertiary", tertiaryReveal);
    setScanSceneVar("--orbit-opacity", 0.28 + majorReveal * 0.22 + tertiaryReveal * 0.18);
    setScanSceneVar("--scan-transition", transitionMix);
    setScanSceneVar("--zone-hydration-a", hydrationA);
    setScanSceneVar("--zone-hydration-b", hydrationB);
    setScanSceneVar("--zone-barrier", barrier);
    setScanSceneVar("--zone-sensitivity", sensitivity);
    updateScanPhaseMarkers(isConfirming ? -1 : phaseIndex, completedCount);
  }

  function updateProfileSceneState(
    current: number,
    next: number,
    segmentProgress: number,
    transition: boolean,
  ) {
    if (!profileScene) {
      return;
    }

    if (current !== 1) {
      resetProfileSceneState();
      return;
    }

    const phaseIndex = transition
      ? profilePhaseLabels.length - 1
      : Math.min(3, Math.floor(segmentProgress / profilePulseDurationMs));
    const revealA = 1;
    const revealB = 1;
    const revealC = 1;
    const revealD = 1;
    const pulseA = pulseWindowMs(segmentProgress, 0, profilePulseDurationMs);
    const pulseB = pulseWindowMs(segmentProgress, profilePulseDurationMs, profilePulseDurationMs);
    const pulseC = pulseWindowMs(segmentProgress, profilePulseDurationMs * 2, profilePulseDurationMs);
    const pulseD = pulseWindowMs(segmentProgress, profilePulseDurationMs * 3, profilePulseDurationMs);
    const lineStrength =
      0.12 + pulseA * 0.16 + pulseB * 0.14 + pulseC * 0.15 + pulseD * 0.16;
    const ambient =
      0.24 + pulseA * 0.18 + pulseB * 0.14 + pulseC * 0.16 + pulseD * 0.2;
    const statusOpacity = transition ? 0.34 : 0.46 + Math.max(pulseA, pulseB, pulseC, pulseD) * 0.18;

    if (activeProfilePhase !== phaseIndex && profilePhaseValue) {
      profilePhaseValue.textContent = profilePhaseLabels[phaseIndex];
      activeProfilePhase = phaseIndex;
    }

    profileScene.classList.toggle("is-holding", transition && next === 2);
    profileScene.classList.toggle("is-transitioning", transition);
    setProfileSceneVar("--profile-reveal-a", transition ? 1 : revealA);
    setProfileSceneVar("--profile-reveal-b", transition ? 1 : revealB);
    setProfileSceneVar("--profile-reveal-c", transition ? 1 : revealC);
    setProfileSceneVar("--profile-reveal-d", transition ? 1 : revealD);
    setProfileSceneVar("--profile-pulse-a", transition ? 0 : pulseA);
    setProfileSceneVar("--profile-pulse-b", transition ? 0 : pulseB);
    setProfileSceneVar("--profile-pulse-c", transition ? 0 : pulseC);
    setProfileSceneVar("--profile-pulse-d", transition ? 0 : pulseD);
    setProfileSceneVar("--profile-line", transition ? lineStrength * 0.84 : lineStrength);
    setProfileSceneVar("--profile-ambient", transition ? ambient * 0.76 : ambient);
    setProfileSceneVar("--profile-status", statusOpacity);
  }

  function updateMatchSceneState(
    current: number,
    segmentProgress: number,
    transition: boolean,
    transitionProgress: number,
  ) {
    if (
      !matchScene ||
      !matchPhaseValue ||
      !matchCoreLabel ||
      !matchCounterLabel ||
      !matchCounterValue ||
      matchTargetChips.length !== 4 ||
      !matchCatalogChips.length
    ) {
      return;
    }

    if (current !== matchSceneIndex) {
      resetMatchSceneState();
      return;
    }

    const nonTargetChips = matchCatalogChips.filter((chip) => !chip.classList.contains("is-target"));
    const dimProgress = clamp((segmentProgress - matchSelectionStartMs) / matchNonTargetFadeMs);
    const selectionStarts = matchTargetChips.map(
      (_, index) => matchSelectionStartMs + index * matchSelectionStaggerMs,
    );
    const selectionPulses = selectionStarts.map((start) =>
      pulseWindowMs(segmentProgress, start, matchSelectionDurationMs),
    );
    const maxSelectionPulse = selectionPulses.reduce((max, pulse) => Math.max(max, pulse), 0);
    const preSelectionPhaseIndex =
      segmentProgress < 760 ? 0 : segmentProgress < 1580 ? 1 : segmentProgress < matchSelectionStartMs ? 2 : 3;
    let activeIndex = -1;
    let selectedCount = 0;

    matchTargetChips.forEach((chip, index) => {
      const start = selectionStarts[index];
      const isSelected = transition || segmentProgress >= start;
      const isActive =
        !transition && segmentProgress >= start && segmentProgress < start + matchSelectionDurationMs;

      chip.classList.toggle("is-selected", isSelected);
      chip.classList.toggle("is-active", isActive);
      chip.classList.remove("is-dimmed", "is-receding");

      if (isSelected) {
        selectedCount = index + 1;
      }

      if (isActive) {
        activeIndex = index;
      }

      chip.style.setProperty(
        "--match-selected-rotate",
        `${((index % 2 === 0 ? -1 : 1) * selectionPulses[index] * 2.4).toFixed(2)}deg`,
      );
      chip.style.setProperty("--match-selected-opacity", transition ? `${1 - transitionProgress * 0.58}` : "1");

      if (transition) {
        const exitX = 84 + index * 3;
        const exitY = -22 + index * 26;
        chip.style.setProperty("--match-selected-x", `${lerp(0, exitX, transitionProgress).toFixed(2)}px`);
        chip.style.setProperty("--match-selected-y", `${lerp(0, exitY, transitionProgress).toFixed(2)}px`);
      } else {
        chip.style.setProperty("--match-selected-x", "0px");
        chip.style.setProperty("--match-selected-y", "0px");
      }
    });

    nonTargetChips.forEach((chip, index) => {
      const family = chip.dataset.family ?? "";
      const familyIndex = matchTargetFamilies.indexOf(family);
      const familyStart = familyIndex >= 0 ? selectionStarts[familyIndex] : matchSelectionStartMs;
      const familyProgress = clamp((segmentProgress - familyStart) / 620);
      const shouldDim = transition || segmentProgress >= familyStart + 40;
      const shouldRecede = transition || segmentProgress >= familyStart + 180;
      const driftDirection = index % 2 === 0 ? -1 : 1;

      chip.classList.toggle("is-dimmed", shouldDim);
      chip.classList.toggle("is-receding", shouldRecede);
      chip.classList.remove("is-selected", "is-active");
      chip.style.setProperty(
        "--match-reject-x",
        shouldRecede ? `${(driftDirection * (18 + familyProgress * 18)).toFixed(2)}px` : "0px",
      );
      chip.style.setProperty(
        "--match-reject-y",
        shouldRecede ? `${(12 + familyProgress * 12).toFixed(2)}px` : "0px",
      );
      chip.style.setProperty(
        "--match-reject-rotate",
        shouldRecede ? `${(driftDirection * (4 + familyProgress * 5)).toFixed(2)}deg` : "0deg",
      );
    });

    const phaseText = transition
      ? matchPhaseLabels[4]
      : activeIndex >= 0
        ? `${matchSelectionLabels[activeIndex]} locked`
        : selectedCount >= matchTargetChips.length
          ? matchPhaseLabels[4]
          : matchPhaseLabels[Math.min(preSelectionPhaseIndex, 3)];
    const engineText =
      transition || segmentProgress >= matchSelectionStartMs
        ? matchEngineLabels[3]
        : matchEngineLabels[preSelectionPhaseIndex];
    const counterState =
      transition || selectedCount >= matchTargetChips.length
        ? matchCounterStates[3]
        : segmentProgress < 980
          ? matchCounterStates[0]
          : segmentProgress < 1780
            ? matchCounterStates[1]
            : segmentProgress < matchSelectionStartMs
              ? matchCounterStates[2]
              : {
                  label: matchCounterStates[3].label,
                  value: `${Math.max(1, selectedCount)} product${selectedCount === 1 ? "" : "s"}`,
                };
    const ambient =
      0.22 +
      dimProgress * 0.12 +
      selectionPulses.reduce((sum, pulse) => sum + pulse * 0.12, 0);
    const corePulse = transition
      ? 0.42
      : 0.28 + Math.sin(segmentProgress * 0.0042) * 0.1 + dimProgress * 0.1 + maxSelectionPulse * 0.14;
    const decisionFlash = transition ? 0.2 : Math.pow(maxSelectionPulse, 1.4);
    const decisionWave = transition ? 0.28 : maxSelectionPulse;

    matchScene.classList.toggle("is-evaluating", segmentProgress >= matchSelectionStartMs || transition);
    matchScene.classList.toggle("has-selection", selectedCount > 0 || transition);
    matchScene.classList.toggle("is-transitioning", transition);
    matchPhaseValue.textContent = phaseText;
    matchCoreLabel.textContent = engineText;
    matchCounterLabel.textContent = counterState.label;
    matchCounterValue.textContent = counterState.value;
    setMatchSceneVar("--match-ambient", transition ? ambient * 0.84 : ambient);
    setMatchSceneVar("--match-core-pulse", transition ? corePulse * 0.84 : corePulse);
    setMatchSceneVar("--match-dim", transition ? 1 : dimProgress);
    setMatchSceneVar("--match-wave", decisionWave);
    setMatchSceneVar("--match-flash", decisionFlash);
    setMatchSceneVar("--match-transition", transition ? transitionProgress : 0);
  }

  function updateRoutineSceneState(
    current: number,
    next: number,
    segmentProgress: number,
    transition: boolean,
  ) {
    if (!routineMeterFill || routineSceneRows.length !== 4) {
      return;
    }

    if (current !== routineSceneIndex) {
      if (next !== routineSceneIndex) {
        resetRoutineSceneState();
      }
      return;
    }

    const meterProgress = transition
      ? 1
      : easeInOut(clamp(segmentProgress / routineMeterDurationMs));
    routineMeterFill.style.transform = `scaleX(${meterProgress.toFixed(4)})`;

    routineSceneRows.forEach((row, index) => {
      const revealProgress = transition
        ? 1
        : easeInOut(
            clamp((segmentProgress - routineRevealStarts[index]) / routineRevealDurationMs),
      );

      row.style.opacity = revealProgress.toFixed(4);
      row.style.transform = `translate3d(0,${((1 - revealProgress) * 12).toFixed(2)}px,0)`;
      row.style.setProperty("--routine-row-progress", revealProgress.toFixed(4));
    });
  }

  function updateResultSceneState(
    current: number,
    segmentProgress: number,
    transition: boolean,
    transitionProgress: number,
  ) {
    if (!resultScene || !resultTitle || !resultLead || !resultStatus) {
      return;
    }

    if (current !== resultSceneIndex) {
      resetResultSceneState();
      return;
    }

    const arrivalProgress = easeInOut(clamp(segmentProgress / 900));
    const checkProgress = easeInOut(clamp((segmentProgress - 220) / 760));
    const summaryProgress = easeInOut(clamp((segmentProgress - resultRoutineStartMs) / 920));
    const checklistPulse = resultChecklistStarts.reduce(
      (sum, start) => sum + pulseWindowMs(segmentProgress, start, resultChecklistDurationMs) * 0.18,
      0,
    );
    const routinePulse = resultRoutineChips.reduce(
      (sum, _, index) =>
        sum +
        pulseWindowMs(
          segmentProgress,
          resultRoutineStartMs + index * resultRoutineStaggerMs,
          resultRoutineDurationMs,
        ) *
          0.12,
      0,
    );
    const glow = 0.28 + arrivalProgress * 0.28 + checklistPulse + routinePulse * 0.7;
    const bloom = 0.18 + checkProgress * 0.24 + routinePulse;
    const idle = 0.22 + Math.sin(segmentProgress * 0.0022) * 0.08 + summaryProgress * 0.08;

    resultChecklist.forEach((item, index) => {
      const reveal = transition
        ? 1 - transitionProgress * 0.36
        : easeInOut(
            clamp((segmentProgress - resultChecklistStarts[index]) / resultChecklistDurationMs),
          );

      item.style.opacity = reveal.toFixed(4);
      item.style.transform = `translate3d(0,${((1 - reveal) * 14).toFixed(2)}px,0) scale(${(
        0.97 + reveal * 0.03
      ).toFixed(4)})`;
    });

    resultRoutineChips.forEach((chip, index) => {
      const reveal = transition
        ? 1 - transitionProgress * 0.42
        : easeInOut(
            clamp(
              (segmentProgress - (resultRoutineStartMs + index * resultRoutineStaggerMs)) /
                resultRoutineDurationMs,
            ),
          );

      chip.style.opacity = reveal.toFixed(4);
      chip.style.transform = `translate3d(0,${((1 - reveal) * 12).toFixed(2)}px,0) scale(${(
        0.96 + reveal * 0.04
      ).toFixed(4)})`;
    });

    resultScene.classList.toggle("is-transitioning", transition);
    resultScene.classList.toggle("is-settled", segmentProgress >= resultRoutineStartMs || transition);
    resultStatus.textContent = transition ? "Reforming analysis field" : "Routine successfully generated";
    resultScene.style.setProperty("--result-arrival", transition ? "1" : arrivalProgress.toFixed(4));
    resultScene.style.setProperty("--result-glow", transition ? (glow * 0.86).toFixed(4) : glow.toFixed(4));
    resultScene.style.setProperty("--result-bloom", transition ? (bloom * 0.92).toFixed(4) : bloom.toFixed(4));
    resultScene.style.setProperty("--result-idle", idle.toFixed(4));
    resultScene.style.setProperty("--result-transition", transition ? transitionProgress.toFixed(4) : "0");
  }

  function recalculateSceneTargets() {
    const {
      faceShell,
      faceCore,
      faceVisual,
      faceBeam,
      faceRing,
      analysisZones,
      scanTrack,
      scanMarkers,
      scanConfirmation,
      profilePills,
      matchCore,
      matchChips,
      routineTitle,
      routineRows,
      resultTitleNode,
      resultLeadNode,
      resultStatusNode,
      resultCheckNode,
      resultItems,
      resultSummary,
    } = sceneTargetNodes;

    if (
      !faceShell ||
      !faceCore ||
      !faceVisual ||
      !faceBeam ||
      !faceRing ||
      !scanTrack ||
      !scanConfirmation ||
      profilePills.length !== 4 ||
      !matchCore ||
      matchChips.length < 8 ||
      !routineTitle ||
      routineRows.length !== 4 ||
      !resultTitleNode ||
      !resultLeadNode ||
      !resultStatusNode ||
      !resultCheckNode ||
      resultItems.length !== 4 ||
      resultSummary.length !== 4
    ) {
      sceneTargets = Array.from({ length: scenes.length }, () =>
        normalizePoints([], particleCount),
      );
      return;
    }

    const faceRect = relativeRect(faceVisual);
    const faceCoreRect = relativeRect(faceCore);
    const beamRect = relativeRect(faceBeam);
    const trackRect = relativeRect(scanTrack);
    const scanPoints = [
      ...sampleEllipse(faceRect, 112, 0.12, 0.08),
      ...sampleEllipse(faceCoreRect, 42, 0.14, 0.06),
      ...sampleLine(
        { x: beamRect.left + 8, y: beamRect.top + beamRect.height / 2 },
        {
          x: beamRect.left + beamRect.width - 8,
          y: beamRect.top + beamRect.height / 2,
        },
        72,
      ),
      ...analysisZones.flatMap((target, index) =>
        sampleCluster(relativeRect(target), 22, 300 + index * 17),
      ),
      ...sampleRectFill(trackRect, 34, 420),
      ...scanMarkers.flatMap((marker, index) =>
        sampleCluster(relativeRect(marker), 10, 470 + index * 19),
      ),
      ...sampleRectFill(relativeRect(scanConfirmation), 28, 560),
      ...sampleRectOutline(relativeRect(faceRing), 42),
      ...sampleRectOutline(relativeRect(faceShell), 58),
    ];

    const profilePoints = profilePills.flatMap((pill, index) => [
      ...sampleRectFill(relativeRect(pill), 52, 400 + index * 31),
      ...sampleRectOutline(relativeRect(pill), 18),
    ]);

    const matchPoints = [
      ...sampleEllipse(relativeRect(matchCore), 90, 0.1, 0.1),
      ...matchChips.flatMap((chip, index) =>
        sampleRectFill(relativeRect(chip), 40, 520 + index * 23),
      ),
    ];

    const routinePoints = [
      ...sampleRectFill(relativeRect(routineTitle), 74, 640),
      ...routineRows.flatMap((row, index) => sampleRectFill(relativeRect(row), 52, 700 + index * 29)),
    ];

    const resultPoints = [
      ...sampleRectFill(relativeRect(resultTitleNode), 84, 840),
      ...sampleRectFill(relativeRect(resultLeadNode), 54, 890),
      ...sampleCluster(relativeRect(resultCheckNode), 38, 930),
      ...sampleRectFill(relativeRect(resultStatusNode), 40, 980),
      ...resultItems.flatMap((item, index) => [
        ...sampleRectFill(relativeRect(item), 32, 1040 + index * 29),
        ...sampleRectOutline(relativeRect(item), 12),
      ]),
      ...resultSummary.flatMap((chip, index) =>
        sampleRectFill(relativeRect(chip), 28, 1180 + index * 23),
      ),
    ];

    sceneTargets = [
      normalizePoints(scanPoints, particleCount),
      normalizePoints(profilePoints, particleCount),
      normalizePoints(matchPoints, particleCount),
      normalizePoints(routinePoints, particleCount),
      normalizePoints(resultPoints, particleCount),
    ];
  }

  function syncSceneAnimations(node: HTMLElement, shouldPlay: boolean) {
    if (sceneAnimationStates.get(node) === shouldPlay) {
      return;
    }

    sceneAnimationStates.set(node, shouldPlay);
    node.getAnimations({ subtree: true }).forEach((animation) => {
      if (shouldPlay && animation.playState === "paused") {
        animation.play();
      } else if (!shouldPlay && animation.playState === "running") {
        animation.pause();
      }
    });
  }

  function syncHeroSectionAnimations(shouldPlay: boolean) {
    heroSection?.getAnimations({ subtree: true }).forEach((animation) => {
      const target = (animation.effect as KeyframeEffect | null)?.target;
      const containingScene =
        target instanceof Element ? target.closest<HTMLElement>(".hero-scene") : null;
      const sceneOpacity = containingScene
        ? Number.parseFloat(containingScene.style.opacity)
        : 1;
      const targetShouldPlay =
        shouldPlay &&
        (!containingScene || Number.isNaN(sceneOpacity) || sceneOpacity > 0.02);

      if (targetShouldPlay && animation.playState === "paused") {
        animation.play();
      } else if (!targetShouldPlay && animation.playState === "running") {
        animation.pause();
      }
    });
  }

  function setSceneStyle(node: HTMLElement, opacity: number, translateY: number, scale: number, blur: number) {
    node.style.opacity = opacity.toFixed(4);
    node.style.transform = `translate3d(0,${translateY}px,0) scale(${scale})`;
    node.style.filter = `blur(${blur}px)`;
    syncSceneAnimations(node, isVisible && opacity > 0.02);
  }

  function publishModelScene(sceneIndex: number | null) {
    if (publishedModelScene === sceneIndex) {
      return;
    }

    publishedModelScene = sceneIndex;

    if (sceneIndex === null) {
      delete heroCinema.dataset.modelScene;
    } else {
      heroCinema.dataset.modelScene = String(sceneIndex);
    }

    heroCinema.dispatchEvent(
      new CustomEvent<HeroModelSceneDetail>(heroModelSceneEvent, {
        detail: { sceneIndex },
      }),
    );
  }

  function applySceneStates(now: number) {
    let elapsed = 0;
    let segmentIndex = 0;

    for (let index = 0; index < sceneSegmentDurations.length; index += 1) {
      const segmentDuration = sceneSegmentDurations[index];

      if (now < elapsed + segmentDuration) {
        segmentIndex = index;
        break;
      }

      elapsed += segmentDuration;
    }

    const segmentProgress = now - elapsed;
    const current = segmentIndex;
    const next = (segmentIndex + 1) % scenes.length;
    const currentHoldMs = sceneHoldDurations[current] ?? holdMs;
    const transition = segmentProgress > currentHoldMs;
    const modelScene = transition
      ? next === 0 || next === routineSceneIndex
        ? next
        : null
      : current === 0 || current === routineSceneIndex
        ? current
        : null;

    publishModelScene(modelScene);

    scenes.forEach((scene, index) => {
      if (index !== current && index !== next) {
        setSceneStyle(scene, 0, 18, 0.96, 16);
      }
    });

    if (!transition) {
      setSceneStyle(scenes[current], 1, 0, 1, 0);
      setSceneStyle(scenes[next], 0, 18, 0.96, 16);
      return { current, next, transition: false, transitionProgress: 0, segmentProgress };
    }

    const transitionProgress = (segmentProgress - currentHoldMs) / transitionMs;
    const sourceOpacity =
      transitionProgress < 0.56 ? 1 - easeInOut(transitionProgress / 0.56) : 0;
    const targetOpacity =
      transitionProgress > 0.68 ? easeInOut((transitionProgress - 0.68) / 0.32) : 0;

    setSceneStyle(
      scenes[current],
      sourceOpacity,
      lerp(0, -14, transitionProgress),
      lerp(1, 1.02, transitionProgress),
      lerp(0, 14, transitionProgress),
    );
    setSceneStyle(
      scenes[next],
      targetOpacity,
      lerp(18, 0, targetOpacity),
      lerp(0.96, 1, targetOpacity),
      lerp(16, 0, targetOpacity),
    );

    return { current, next, transition: true, transitionProgress, segmentProgress };
  }

  function orbitPoint(particle: HeroParticle, time: number, center: HeroPoint) {
    const angle = particle.angle + time * 0.00115 * particle.speed;
    const radius = particle.orbit * (0.9 + Math.sin(time * 0.0018 + particle.angle) * 0.08);

    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius * 0.68,
    };
  }

  function drawParticles(time: number, current: number, next: number, transitionProgress: number) {
    const sourcePoints = sceneTargets[current] ?? [];
    const targetPoints = sceneTargets[next] ?? [];

    if (!sourcePoints.length || !targetPoints.length) {
      return;
    }

    const center = {
      x: width * 0.5 + (mouse.x - 0.5) * 12,
      y: height * 0.5 + (mouse.y - 0.5) * 12,
    };

    const orbitGlow = heroContext.createRadialGradient(center.x, center.y, 0, center.x, center.y, 110);
    orbitGlow.addColorStop(0, "rgba(255,231,163,0.12)");
    orbitGlow.addColorStop(0.5, "rgba(115,169,255,0.08)");
    orbitGlow.addColorStop(1, "rgba(115,169,255,0)");
    heroContext.fillStyle = orbitGlow;
    heroContext.beginPath();
    heroContext.arc(center.x, center.y, 110, 0, Math.PI * 2);
    heroContext.fill();

    for (let index = 0; index < particleCount; index += 1) {
      const source = sourcePoints[index];
      const target = targetPoints[index];
      const particle = particles[index];
      const spreadX = (seededNoise(index * 13 + 1) - 0.5) * 28 * particle.depth;
      const spreadY = (seededNoise(index * 17 + 3) - 0.5) * 22 * particle.depth;
      const travelTarget = {
        x: lerp(source.x, center.x, 0.72) + spreadX * 0.32,
        y: lerp(source.y, center.y, 0.72) + spreadY * 0.32,
      };
      const orbit = orbitPoint(particle, time, center);

      let x: number;
      let y: number;
      let alpha: number;

      if (transitionProgress < 0.38) {
        const progress = easeInOut(transitionProgress / 0.38);
        x = lerp(source.x, travelTarget.x, progress);
        y = lerp(source.y, travelTarget.y, progress);
        alpha = particle.alpha * lerp(0.42, 0.92, progress);
      } else if (transitionProgress < 0.68) {
        const progress = easeInOut((transitionProgress - 0.38) / 0.3);
        x = lerp(travelTarget.x, orbit.x, progress);
        y = lerp(travelTarget.y, orbit.y, progress);
        alpha = particle.alpha;
      } else {
        const progress = easeInOut((transitionProgress - 0.68) / 0.32);
        x = lerp(orbit.x, target.x, progress);
        y = lerp(orbit.y, target.y, progress);
        alpha = particle.alpha * lerp(1, 0.76, progress);
      }

      x += (mouse.x - 0.5) * particle.depth * 5;
      y += (mouse.y - 0.5) * particle.depth * 4;

      heroContext.beginPath();
      heroContext.arc(x, y, particle.size * 2.15, 0, Math.PI * 2);
      heroContext.fillStyle = `rgba(${particle.color},${alpha * 0.12})`;
      heroContext.fill();

      heroContext.beginPath();
      heroContext.arc(x, y, particle.size, 0, Math.PI * 2);
      heroContext.fillStyle = `rgba(${particle.color},${alpha})`;
      heroContext.fill();
    }
  }

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
    width = heroCinema.clientWidth;
    height = heroCinema.clientHeight;
    heroCanvas.width = Math.max(1, Math.floor(width * dpr));
    heroCanvas.height = Math.max(1, Math.floor(height * dpr));
    heroCanvas.style.width = `${width}px`;
    heroCanvas.style.height = `${height}px`;
    heroContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    recalculateSceneTargets();
  }

  function showFirstSceneImmediately() {
    scenes.forEach((scene, index) => setSceneStyle(scene, index === 0 ? 1 : 0, 0, 1, 0));
    publishModelScene(0);
    resetScanSceneState();
    resetProfileSceneState();
    resetMatchSceneState();
    resetRoutineSceneState();
    resetResultSceneState();
    heroContext.clearRect(0, 0, width, height);
  }

  function isHeroPlaybackReady() {
    return document.body.classList.contains("intro-complete") || !document.body.classList.contains("intro-lock");
  }

  function render(time: number) {
    animationFrame = 0;

    if (destroyed) {
      return;
    }

    if (!isPlaybackVisible()) {
      return;
    }

    if (touchDevice && pauseTimestamp !== null) {
      if (loopStartTime !== null) {
        loopStartTime += time - pauseTimestamp;
      }

      pauseTimestamp = null;
    }

    if (!isHeroPlaybackReady()) {
      loopStartTime = null;
      showFirstSceneImmediately();
      startAnimation();
      return;
    }

    if (loopStartTime === null) {
      loopStartTime = time;
    }

    const cycleTime = (time - loopStartTime) % loopMs;
    const state = applySceneStates(cycleTime);
    updateScanSceneState(
      state.current,
      state.next,
      state.segmentProgress,
      state.transition,
      state.transitionProgress,
    );
    updateProfileSceneState(
      state.current,
      state.next,
      state.segmentProgress,
      state.transition,
    );
    updateMatchSceneState(
      state.current,
      state.segmentProgress,
      state.transition,
      state.transitionProgress,
    );
    updateRoutineSceneState(
      state.current,
      state.next,
      state.segmentProgress,
      state.transition,
    );
    updateResultSceneState(
      state.current,
      state.segmentProgress,
      state.transition,
      state.transitionProgress,
    );
    heroContext.clearRect(0, 0, width, height);

    if (state.transition) {
      drawParticles(time, state.current, state.next, state.transitionProgress);
    }

    startAnimation();
  }

  const onMouseMove = (event: MouseEvent) => {
    const rect = heroCinema.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) / rect.width;
    mouse.y = (event.clientY - rect.top) / rect.height;
    heroCinema.style.transform = `perspective(1000px) rotateY(${(mouse.x - 0.5) * 4.5}deg) rotateX(${-(mouse.y - 0.5) * 4.5}deg)`;
  };

  const onMouseLeave = () => {
    mouse.x = 0.5;
    mouse.y = 0.5;
    heroCinema.style.transform = "perspective(1000px) rotateY(0deg) rotateX(0deg)";
  };

  const stopAnimation = () => {
    if (!animationFrame) {
      return;
    }

    window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  };

  const isPlaybackVisible = () => isVisible && (!touchDevice || documentVisible);

  const markPlaybackPaused = () => {
    if (!touchDevice || pauseTimestamp !== null) {
      return;
    }

    pauseTimestamp = performance.now();
  };

  const startAnimation = () => {
    if (destroyed || prefersReducedMotion || animationFrame || !isPlaybackVisible()) {
      return;
    }

    animationFrame = window.requestAnimationFrame(render);
  };

  if (mobileDiagnostic) {
    const mobileCanvasMaxPixels = 430_000;

    const prepareMobileDiagnosticScenes = () => {
      scenes.forEach((scene) => {
        scene.style.display = "grid";
      });
    };

    const resizeMobileDiagnosticCanvas = () => {
      const cssWidth = Math.max(1, Math.round(heroCinema.clientWidth));
      const cssHeight = Math.max(1, Math.round(heroCinema.clientHeight));
      let dpr = Math.min(window.devicePixelRatio || 1, 1);
      const projectedPixels = cssWidth * cssHeight * dpr * dpr;

      if (projectedPixels > mobileCanvasMaxPixels) {
        dpr = Math.sqrt(mobileCanvasMaxPixels / Math.max(1, cssWidth * cssHeight));
      }

      width = cssWidth;
      height = cssHeight;
      heroCanvas.width = Math.max(1, Math.floor(cssWidth * dpr));
      heroCanvas.height = Math.max(1, Math.floor(cssHeight * dpr));
      heroCanvas.style.width = `${cssWidth}px`;
      heroCanvas.style.height = `${cssHeight}px`;
      heroContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      recalculateSceneTargets();
    };

    const resizeObserver = new ResizeObserver(() => {
      resizeMobileDiagnosticCanvas();
      if (isPlaybackVisible()) {
        startAnimation();
      }
    });
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry?.isIntersecting ?? false;
        syncHeroSectionAnimations(isPlaybackVisible());

        if (isPlaybackVisible()) {
          resizeMobileDiagnosticCanvas();
          startAnimation();
        } else {
          markPlaybackPaused();
          stopAnimation();
        }
      },
      { threshold: 0.1 },
    );
    const onDocumentVisibilityChange = () => {
      documentVisible = !document.hidden;
      syncHeroSectionAnimations(isPlaybackVisible());

      if (isPlaybackVisible()) {
        startAnimation();
      } else {
        markPlaybackPaused();
        stopAnimation();
      }
    };

    resizeObserver.observe(heroCinema);
    visibilityObserver.observe(heroCinema);
    document.addEventListener("visibilitychange", onDocumentVisibilityChange);
    prepareMobileDiagnosticScenes();
    resizeMobileDiagnosticCanvas();
    showFirstSceneImmediately();
    syncHeroSectionAnimations(isPlaybackVisible());
    startAnimation();

    return () => {
      destroyed = true;
      stopAnimation();
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      document.removeEventListener("visibilitychange", onDocumentVisibilityChange);
      pauseTimestamp = null;
      scenes.forEach((scene) => {
        scene.style.removeProperty("display");
      });
      showFirstSceneImmediately();
      heroContext.clearRect(0, 0, width, height);
    };
  }

  if (!touchDevice) {
    heroCinema.addEventListener("mousemove", onMouseMove);
    heroCinema.addEventListener("mouseleave", onMouseLeave);
  }

  if (prefersReducedMotion) {
    scenes.forEach((scene, index) => setSceneStyle(scene, index === 0 ? 1 : 0, 0, 1, 0));
    resetScanSceneState();
    resetProfileSceneState();
    resetMatchSceneState();
    resetRoutineSceneState();
    resetResultSceneState();
    return () => {
      if (!touchDevice) {
        heroCinema.removeEventListener("mousemove", onMouseMove);
        heroCinema.removeEventListener("mouseleave", onMouseLeave);
      }
    };
  }

  const resizeObserver = new ResizeObserver(() => resizeCanvas());
  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      isVisible = entry?.isIntersecting ?? false;
      syncHeroSectionAnimations(isVisible);

      if (isVisible) {
        recalculateSceneTargets();
        scenes.forEach((scene) => {
          sceneAnimationStates.delete(scene);
          const opacity = Number.parseFloat(scene.style.opacity);
          syncSceneAnimations(scene, Number.isNaN(opacity) || opacity > 0.02);
        });
        startAnimation();
      } else {
        stopAnimation();
        scenes.forEach((scene) => syncSceneAnimations(scene, false));
      }
    },
    { threshold: 0.1 },
  );
  resizeObserver.observe(heroCinema);
  visibilityObserver.observe(heroCinema);
  resizeCanvas();
  showFirstSceneImmediately();
  startAnimation();

  return () => {
    destroyed = true;
    stopAnimation();
    resizeObserver.disconnect();
    visibilityObserver.disconnect();
    if (!touchDevice) {
      heroCinema.removeEventListener("mousemove", onMouseMove);
      heroCinema.removeEventListener("mouseleave", onMouseLeave);
    }
    scenes.forEach((scene, index) => setSceneStyle(scene, index === 0 ? 1 : 0, 0, 1, 0));
    resetScanSceneState();
    resetProfileSceneState();
    resetMatchSceneState();
    resetRoutineSceneState();
    resetResultSceneState();
    heroContext.clearRect(0, 0, width, height);
  };
}

function setupLandingInteractions() {
  const touchDevice = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  const diagnosticMode = touchDevice && document.body.classList.contains("mobile-diagnostic");
  const cleanupHandlers: Array<() => void> = [];

  if (!touchDevice) {
    document.querySelectorAll<HTMLElement>(".problem-card,.depth-card").forEach((card) => {
      const onMouseMove = (event: MouseEvent) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${((event.clientX - rect.left) / rect.width) * 100}%`);
        card.style.setProperty("--my", `${((event.clientY - rect.top) / rect.height) * 100}%`);
      };

      card.addEventListener("mousemove", onMouseMove);
      cleanupHandlers.push(() => card.removeEventListener("mousemove", onMouseMove));
    });

    const cursor = document.getElementById("cursor");
    const glow = document.getElementById("glow");
    const magnets = Array.from(document.querySelectorAll<HTMLElement>(".magnetic"));

    if (cursor && glow) {
      const onMouseMove = (event: MouseEvent) => {
        cursor.style.left = `${event.clientX}px`;
        cursor.style.top = `${event.clientY}px`;
        glow.style.left = `${event.clientX}px`;
        glow.style.top = `${event.clientY}px`;
        let active = false;

        magnets.forEach((element) => {
          const rect = element.getBoundingClientRect();
          const x = event.clientX - (rect.left + rect.width / 2);
          const y = event.clientY - (rect.top + rect.height / 2);
          const distance = Math.hypot(x, y);

          if (distance < 140) {
            element.style.transform = `translate(${x * 0.14}px,${y * 0.2}px)`;
            active = true;
          } else {
            element.style.transform = "translate(0,0)";
          }
        });

        cursor.style.width = active ? "48px" : "18px";
        cursor.style.height = active ? "48px" : "18px";
        cursor.style.background = active ? "rgba(255,231,163,.14)" : "transparent";
      };

      window.addEventListener("mousemove", onMouseMove);
      cleanupHandlers.push(() => window.removeEventListener("mousemove", onMouseMove));
    }
  }

  const problemCards = Array.from(document.querySelectorAll<HTMLElement>(".problem-card"));
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("reveal");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.22 },
  );
  problemCards.forEach((card) => revealObserver.observe(card));
  cleanupHandlers.push(() => revealObserver.disconnect());

  const cinema = document.getElementById("cinema");
  if (cinema && !touchDevice) {
    const onMouseLeave = () => {
      cinema.style.transform = "perspective(1000px) rotateY(0deg) rotateX(0deg)";
    };
    cinema.addEventListener("mouseleave", onMouseLeave);
    cleanupHandlers.push(() => cinema.removeEventListener("mouseleave", onMouseLeave));
  }

  const cloud = document.getElementById("productCloud");
  if (cloud) {
    const mobileCloud = diagnosticMode && touchDevice;
    const productPositions = [
      [74, 420, -19],
      [240, 255, 15],
      [450, 435, 28],
      [690, 210, -25],
      [875, 395, 19],
      [145, 570, 22],
      [555, 260, -8],
      [930, 120, 8],
      [360, 92, -16],
      [760, 565, -10],
      [1010, 520, 14],
      [70, 165, 24],
      [515, 585, -22],
      [640, 90, 11],
      [995, 255, -17],
      [315, 590, 18],
    ];
    const products = productPositions.map(([left, top, rotation], index) => {
      const product = document.createElement("div");
      const durationSeconds = mobileCloud ? 8.6 + (index % 5) * 1.35 : 5 + (index % 5);
      product.className = "product";
      product.style.left = `${left}px`;
      product.style.top = `${top}px`;
      product.style.setProperty("--r", `${rotation}deg`);
      product.style.animation = `float${index % 4} ${durationSeconds}s ease-in-out infinite alternate`;
      product.style.animationPlayState = "paused";
      cloud.appendChild(product);
      return product;
    });
    const animationStyle = document.createElement("style");
    animationStyle.textContent =
      "@keyframes float0{to{transform:translateY(-24px) rotate(8deg)}}" +
      "@keyframes float1{to{transform:translate(14px,18px) rotate(-12deg)}}" +
      "@keyframes float2{to{transform:translate(18px,-12px) rotate(18deg)}}" +
      "@keyframes float3{to{transform:translate(-14px,16px) rotate(-8deg)}}";
    document.head.appendChild(animationStyle);

    let cloudVisible = false;
    let cloudDocumentVisible = !document.hidden;
    const syncCloudAnimationState = () => {
      const playState = cloudVisible && cloudDocumentVisible ? "running" : "paused";
      products.forEach((product) => {
        product.style.animationPlayState = playState;
      });
    };
    const cloudObserver = new IntersectionObserver(
      ([entry]) => {
        cloudVisible = entry?.isIntersecting ?? false;
        syncCloudAnimationState();
      },
      { rootMargin: "120px 0px" },
    );
    const onCloudVisibilityChange = () => {
      cloudDocumentVisible = !document.hidden;
      syncCloudAnimationState();
    };
    const cloudRect = cloud.getBoundingClientRect();
    cloudVisible = cloudRect.bottom >= -120 && cloudRect.top <= window.innerHeight + 120;
    syncCloudAnimationState();
    cloudObserver.observe(cloud);
    document.addEventListener("visibilitychange", onCloudVisibilityChange);

    cleanupHandlers.push(() => {
      cloudObserver.disconnect();
      document.removeEventListener("visibilitychange", onCloudVisibilityChange);
      products.forEach((product) => product.remove());
      animationStyle.remove();
    });
  }

  const control = document.querySelector<HTMLElement>(".control-room");
  const stage = document.getElementById("controlStage");
  const kicker = document.getElementById("stageKicker");
  const title = document.getElementById("stageTitle");
  const blackout = document.querySelector<HTMLElement>(".blackout");
  const blackoutBackground = document.getElementById("blackoutBg");
  const finalLines = ["f1", "f2", "f3", "f4"].map((id) => document.getElementById(id));
  const stageCopy = [
    [
      "Before Skin ID",
      'More <span class="highlight-word highlight-gold">products.</span> Less <span class="highlight-word highlight-cyan">confidence.</span>',
    ],
    [
      "The leak",
      'Too many <span class="highlight-word highlight-gold">options.</span> No <span class="highlight-word highlight-blue">personal</span> answer. No reason to buy the <span class="highlight-word highlight-cyan">routine.</span>',
    ],
    [
      "Skin ID activated",
      '<span class="highlight-word highlight-gold">Confusion</span> becomes <span class="highlight-word highlight-cyan">clarity.</span> <span class="highlight-word highlight-gold">⭐⭐⭐⭐⭐</span>',
    ],
    [
      "Decision engine",
      'Every <span class="highlight-word highlight-blue">recommendation</span> has a <span class="highlight-word highlight-gold">reason.</span>',
    ],
    [
      "After Skin ID",
      'The customer leaves with a complete <span class="highlight-word highlight-cyan">routine</span>, not <span class="highlight-word highlight-gold">confusion.</span>',
    ],
  ] as const;
  let windowScrollFrame = 0;
  let renderedStage = 0;

  const renderWindowScroll = () => {
    windowScrollFrame = 0;

    if (control && stage && kicker && title) {
      const rect = control.getBoundingClientRect();
      const total = Math.max(1, control.offsetHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -rect.top / total));
      const stageNumber =
        progress < 0.13 ? 1 : progress < 0.3 ? 2 : progress < 0.5 ? 3 : progress < 0.68 ? 4 : 5;

      if (stageNumber !== renderedStage) {
        renderedStage = stageNumber;
        stage.className = `control-stage s${stageNumber}`;
        kicker.textContent = stageCopy[stageNumber - 1][0];
        title.innerHTML = stageCopy[stageNumber - 1][1];
      }
    }

    if (blackout && blackoutBackground) {
      const rect = blackout.getBoundingClientRect();
      const total = Math.max(1, blackout.offsetHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -rect.top / total));
      blackoutBackground.style.opacity = String(0.05 + progress * 0.78);
      finalLines.forEach((line, index) => {
        line?.classList.toggle("show", progress > 0.14 + index * 0.16);
      });
    }
  };

  const onWindowScroll = () => {
    if (!windowScrollFrame) {
      windowScrollFrame = window.requestAnimationFrame(renderWindowScroll);
    }
  };

  window.addEventListener("scroll", onWindowScroll, { passive: true });
  renderWindowScroll();
  cleanupHandlers.push(() => {
    window.cancelAnimationFrame(windowScrollFrame);
    window.removeEventListener("scroll", onWindowScroll);
  });

  const resultData: Record<string, [string, string, string, string, string, string]> = {
    hydration: [
      "Hydration-first routine",
      "91",
      "Repair barrier first",
      "Cleanser + serum + cream",
      "Bundle recommended",
      "Clear next step",
    ],
    sensitivity: [
      "Sensitivity-safe routine",
      "88",
      "Reduce irritation risk",
      "Gentle cleanse + barrier cream",
      "Low-friction bundle",
      "Feels understood",
    ],
    acne: [
      "Breakout-control routine",
      "86",
      "Clarify without stripping",
      "Cleanser + treatment + SPF",
      "Problem-solution bundle",
      "Confident choice",
    ],
    aging: [
      "Texture-support routine",
      "90",
      "Support renewal gradually",
      "Serum + cream + SPF",
      "Premium routine path",
      "Higher trust",
    ],
  };
  const chips = Array.from(document.querySelectorAll<HTMLElement>(".chip"));
  chips.forEach((chip) => {
    const onClick = () => {
      chips.forEach((item) => item.classList.remove("active"));
      chip.classList.add("active");
      const data = resultData[chip.dataset.mode ?? ""];

      if (!data) {
        return;
      }

      const ids = ["resultTitle", "score", "decision", "routine", "cart", "feeling"];
      ids.forEach((id, index) => {
        const node = document.getElementById(id);
        if (node) {
          node.textContent = data[index];
        }
      });
    };

    chip.addEventListener("click", onClick);
    cleanupHandlers.push(() => chip.removeEventListener("click", onClick));
  });

  const range = document.getElementById("beliefRange") as HTMLInputElement | null;
  const rangeFill = document.getElementById("rangeFill");
  const belief = document.getElementById("beliefText");
  if (range && rangeFill && belief) {
    const onInput = () => {
      const value = Number(range.value);
      rangeFill.style.width = `calc(${value}% - 24px)`;
      belief.innerHTML =
        value < 35
          ? 'Most skincare stores sell <span class="change word-products">products.</span>'
          : value < 70
            ? 'Better skincare stores sell <span class="change word-routines">routines.</span>'
            : 'Top skincare brands sell <span class="change word-decisions">decisions.</span>';
    };

    range.addEventListener("input", onInput);
    cleanupHandlers.push(() => range.removeEventListener("input", onInput));
  }

  const finalCanvas = document.getElementById("finalCanvas") as HTMLCanvasElement | null;
  const finalContext = finalCanvas?.getContext("2d");
  if (finalCanvas && finalContext) {
    type FinalParticle = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
    };

    let particles: FinalParticle[] = [];
    let finalFrame = 0;
    let resizeFrame = 0;
    let canvasVisible = false;
    let canvasWidth = 0;
    let canvasHeight = 0;
    const mobileFinalCanvas = diagnosticMode && touchDevice;
    const mobileParticleCount = 72;
    const desktopParticleCount = 120;
    const mobileCanvasMaxDpr = 1.25;
    const mobileCanvasMaxPixels = 720_000;

    const buildParticles = (width: number, height: number, count: number) =>
      Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * (mobileFinalCanvas ? 0.35 : 0.6),
        vy: (Math.random() - 0.5) * (mobileFinalCanvas ? 0.35 : 0.6),
        size: Math.random() * (mobileFinalCanvas ? 1.4 : 2) + (mobileFinalCanvas ? 0.8 : 1),
      }));

    const resizeFinalCanvas = () => {
      resizeFrame = 0;
      const width = Math.max(1, Math.round(finalCanvas.clientWidth || window.innerWidth));
      const height = Math.max(1, Math.round(finalCanvas.clientHeight || window.innerHeight));

      if (width === canvasWidth && height === canvasHeight) {
        return;
      }

      canvasWidth = width;
      canvasHeight = height;
      let dpr = 1;

      if (mobileFinalCanvas) {
        dpr = Math.min(window.devicePixelRatio || 1, mobileCanvasMaxDpr);
        const projectedPixels = width * height * dpr * dpr;

        if (projectedPixels > mobileCanvasMaxPixels) {
          dpr = Math.sqrt(mobileCanvasMaxPixels / Math.max(1, width * height));
        }
      }

      finalCanvas.width = Math.max(1, Math.floor(width * dpr));
      finalCanvas.height = Math.max(1, Math.floor(height * dpr));
      finalCanvas.style.width = `${width}px`;
      finalCanvas.style.height = `${height}px`;
      finalContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = buildParticles(
        width,
        height,
        mobileFinalCanvas ? mobileParticleCount : desktopParticleCount,
      );
    };

    const stopFinalCanvas = () => {
      window.cancelAnimationFrame(finalFrame);
      finalFrame = 0;
    };

    const drawFinalCanvas = () => {
      finalFrame = 0;

      if (!canvasVisible || document.hidden) {
        return;
      }

      finalContext.clearRect(0, 0, canvasWidth, canvasHeight);

      particles.forEach((particle, index) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < 0 || particle.x > canvasWidth) {
          particle.vx *= -1;
        }
        if (particle.y < 0 || particle.y > canvasHeight) {
          particle.vy *= -1;
        }

        finalContext.beginPath();
        finalContext.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        finalContext.fillStyle =
          index % 2 ? "rgba(255,231,163,.35)" : "rgba(115,169,255,.32)";
        finalContext.fill();

        for (let otherIndex = index + 1; otherIndex < particles.length; otherIndex += 1) {
          const other = particles[otherIndex];
          const deltaX = particle.x - other.x;
          const deltaY = particle.y - other.y;
          const distanceSquared = deltaX * deltaX + deltaY * deltaY;

          if (distanceSquared < 12100) {
            const distance = Math.sqrt(distanceSquared);
            finalContext.beginPath();
            finalContext.moveTo(particle.x, particle.y);
            finalContext.lineTo(other.x, other.y);
            finalContext.strokeStyle = `rgba(255,231,163,${(1 - distance / 110) * 0.12})`;
            finalContext.stroke();
          }
        }
      });

      finalFrame = window.requestAnimationFrame(drawFinalCanvas);
    };

    const startFinalCanvas = () => {
      if (!finalFrame && canvasVisible && !document.hidden) {
        finalFrame = window.requestAnimationFrame(drawFinalCanvas);
      }
    };

    const finalCanvasObserver = new IntersectionObserver(
      ([entry]) => {
        canvasVisible = entry?.isIntersecting ?? false;
        if (canvasVisible) {
          resizeFinalCanvas();
          startFinalCanvas();
        } else {
          stopFinalCanvas();
        }
      },
      { rootMargin: "100px 0px" },
    );
    const onResize = () => {
      if (!resizeFrame) {
        resizeFrame = window.requestAnimationFrame(resizeFinalCanvas);
      }
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        stopFinalCanvas();
      } else {
        startFinalCanvas();
      }
    };

    resizeFinalCanvas();
    finalCanvasObserver.observe(finalCanvas);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibilityChange);

    cleanupHandlers.push(() => {
      stopFinalCanvas();
      window.cancelAnimationFrame(resizeFrame);
      finalCanvasObserver.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      finalContext.clearRect(0, 0, canvasWidth, canvasHeight);
    });
  }

  {
    const visibilityBoundRoots = Array.from(
      new Set(
        Array.from(
          document.querySelectorAll<HTMLElement>(
            ".hero,.section,.control-room,.deep-system,.belief-section,.blackout",
          ),
        ),
      ),
    );
    const rootVisibilityState = new Map<HTMLElement, boolean>();
    let documentAnimationsVisible = !document.hidden;
    const syncRootAnimations = (root: HTMLElement) => {
      const shouldPlay = (rootVisibilityState.get(root) ?? false) && documentAnimationsVisible;
      root.getAnimations({ subtree: true }).forEach((animation) => {
        if (shouldPlay && animation.playState === "paused") {
          animation.play();
        } else if (!shouldPlay && animation.playState === "running") {
          animation.pause();
        }
      });
    };
    const sectionAnimationObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const root = entry.target as HTMLElement;
          rootVisibilityState.set(root, entry.isIntersecting);
          syncRootAnimations(root);
        });
      },
      { rootMargin: "0px" },
    );
    const onDocumentAnimationVisibilityChange = () => {
      documentAnimationsVisible = !document.hidden;
      visibilityBoundRoots.forEach((root) => syncRootAnimations(root));
    };

    visibilityBoundRoots.forEach((root) => {
      const rect = root.getBoundingClientRect();
      const isNearViewport = rect.bottom >= 0 && rect.top <= window.innerHeight;
      rootVisibilityState.set(root, isNearViewport);
      syncRootAnimations(root);
      sectionAnimationObserver.observe(root);
    });
    document.addEventListener("visibilitychange", onDocumentAnimationVisibilityChange);
    cleanupHandlers.push(() => {
      sectionAnimationObserver.disconnect();
      document.removeEventListener("visibilitychange", onDocumentAnimationVisibilityChange);
    });
  }

  return () => {
    cleanupHandlers.forEach((cleanup) => cleanup());
  };
}

const landingHtml = `<div class="loader" id="loader"><canvas id="loaderLogoCanvas" aria-hidden="true"></canvas><div class="loader-grid"></div><div class="loader-vignette"></div><div class="loader-copy"><div class="loader-kicker" id="loaderPhase">calibrating brand object</div><div class="loader-brand-shell"><div class="loader-brand">NABI</div><div class="loader-sub">private skin intelligence system</div></div><div class="loader-progress"><span id="loaderProgressFill"></span></div></div><div class="loader-hud loader-hud-a"><span>Mode</span>Brand ignition</div><div class="loader-hud loader-hud-b"><span>Asset</span>3D identity mark</div></div>
  <div class="cursor" id="cursor"></div><div class="glow" id="glow"></div><div class="noise"></div>

  <nav class="nav">
    <div class="logo" aria-label="NABI"><img class="logo-img" src="/nabi-logo-cropped.png" alt="NABI" /></div>
    <div class="nav-links"><a href="#problem">Problem</a><a href="#journey">Journey</a><a href="#simulator">Why Skin ID</a></div>
    <a class="cta magnetic" href="${calendlyUrl}" target="_blank" rel="noreferrer"><span class="btn-text">Request a Demo</span></a>
  </nav>

  <section class="hero">
    <div class="hero-inner">
      <div>
        <div class="eyebrow"><span class="dot"></span>Enterprise ready</div>
        <h1>Skincare Shouldn't Be <span class="gradient-text">Generic.</span></h1>
        <p class="hero-statement"><span class="hero-statement-accessible">Personalized routines. Better decisions. More conversions.</span><span class="hero-slot" aria-hidden="true"><span class="hero-slot-reel"><span class="hero-slot-item hero-routines">Personalized routines.</span><span class="hero-slot-item hero-decisions">Better decisions.</span><span class="hero-slot-item hero-conversions">More conversions.</span><span class="hero-slot-item hero-routines">Personalized routines.</span></span></span></p>
        <div class="hero-actions"><a class="cta magnetic" href="${calendlyUrl}" target="_blank" rel="noreferrer"><span class="btn-text">Discover Skin ID</span></a><a class="cta ghost magnetic" href="#simulator"><span class="btn-text">See why brands choose it</span></a></div>
        <div class="hero-platforms" data-open="false">
          <button class="hero-platform-toggle" type="button" aria-expanded="false" aria-controls="heroPlatformPanel">
            <span class="hero-platform-toggle-text">Supported Platforms</span>
            <span class="hero-platform-toggle-icon" aria-hidden="true">
              <span class="hero-platform-toggle-ring"></span>
              <svg viewBox="0 0 12 12" focusable="false">
                <path d="M6 2v8M2 6h8" />
              </svg>
            </span>
          </button>
          <div class="hero-platform-panel" id="heroPlatformPanel" aria-hidden="true">
            <div class="hero-platform-panel-shell">
              <span class="hero-platform-more" aria-hidden="true">And more</span>
              <div class="hero-platform-list" role="list" aria-label="Supported platforms">
                <span class="hero-platform-logo platform-shopify" role="img" aria-label="Shopify" style="--token-x:0px;--token-y:-108px;--token-delay:.04s">
                  <img class="hero-platform-logo-image" src="/platform-logos/shopify.png" alt="" aria-hidden="true" />
                </span>
                <span class="hero-platform-logo platform-woo" role="img" aria-label="WooCommerce" style="--token-x:102px;--token-y:-34px;--token-delay:.1s">
                  <img class="hero-platform-logo-image" src="/platform-logos/woocommerce.png" alt="" aria-hidden="true" />
                </span>
                <span class="hero-platform-logo platform-wix" role="img" aria-label="Wix" style="--token-x:64px;--token-y:90px;--token-delay:.16s">
                  <img class="hero-platform-logo-image" src="/platform-logos/wix.png" alt="" aria-hidden="true" />
                </span>
                <span class="hero-platform-logo platform-squarespace" role="img" aria-label="Squarespace" style="--token-x:-64px;--token-y:90px;--token-delay:.22s">
                  <img class="hero-platform-logo-image" src="/platform-logos/squarespace.png" alt="" aria-hidden="true" />
                </span>
                <span class="hero-platform-logo platform-bigcommerce" role="img" aria-label="BigCommerce" style="--token-x:-102px;--token-y:-34px;--token-delay:.28s">
                  <img class="hero-platform-logo-image" src="/platform-logos/bigcommerce.png" alt="" aria-hidden="true" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="cinema" id="cinema">
        <canvas id="heroCanvas" aria-hidden="true"></canvas><div class="status"><span class="dot"></span>Live personalization layer</div>
        <div class="hero-sim" aria-hidden="true">
          <div class="sim-glow sim-glow-a"></div>
          <div class="sim-glow sim-glow-b"></div>
          <div class="hero-scene scene-scan">
            <div class="scene-shell scan-shell">
              <div class="face-shell">
                <div class="face-depth face-depth-a"></div>
                <div class="face-depth face-depth-b"></div>
                <div class="face-network">
                  <span class="network-line line-a"></span>
                  <span class="network-line line-b"></span>
                  <span class="network-line line-c"></span>
                  <span class="network-node node-a"></span>
                  <span class="network-node node-b"></span>
                  <span class="network-node node-c"></span>
                  <span class="network-node node-d"></span>
                  <span class="network-node node-e"></span>
                </div>
                <div class="face-ambient"></div>
                <div class="face-reflection face-reflection-a"></div>
                <div class="face-reflection face-reflection-b"></div>
                <div class="face-ring"></div>
                <div class="face-core">
                  <div class="face-core-glow"></div>
                  <div class="face-visual">
                    <canvas class="face-model-canvas" id="faceModelCanvas" aria-hidden="true"></canvas>
                  </div>
                  <span class="analysis-zone zone-hydration-a"></span>
                  <span class="analysis-zone zone-barrier"></span>
                  <span class="analysis-zone zone-sensitivity"></span>
                  <span class="analysis-zone zone-hydration-b"></span>
                  <div class="scan-orbit">
                    <span class="orbit-particle particle-a"></span>
                    <span class="orbit-particle particle-b"></span>
                    <span class="orbit-particle particle-c"></span>
                    <span class="orbit-particle particle-d"></span>
                    <span class="orbit-particle particle-e"></span>
                    <span class="orbit-particle particle-f"></span>
                  </div>
                </div>
                <div class="face-beam"></div>
              </div>
              <div class="scan-caption">
                <div class="scan-caption-copy">
                  <span class="scan-caption-label">Live skin analysis</span>
                  <span class="scan-phase-value">Initializing</span>
                </div>
                <div class="scan-phase-track"><span class="scan-phase-fill"></span></div>
                <div class="scan-phase-markers">
                  <span class="scan-phase-marker"></span>
                  <span class="scan-phase-marker"></span>
                  <span class="scan-phase-marker"></span>
                  <span class="scan-phase-marker"></span>
                </div>
                <div class="scan-confirmation"><span class="scan-check">✓</span><span>Analysis complete</span></div>
              </div>
            </div>
          </div>
          <div class="hero-scene scene-profile">
            <div class="scene-shell profile-shell">
              <div class="profile-head">
                <div class="scene-kicker">Detected skin profile</div>
                <div class="profile-phase">
                  <span class="profile-phase-dot"></span>
                  <span class="profile-phase-value">Analyzing profile</span>
                </div>
              </div>
              <div class="profile-stage">
                <div class="profile-engine" aria-hidden="true">
                  <span class="profile-beam beam-a"></span>
                  <span class="profile-beam beam-b"></span>
                  <span class="profile-beam beam-c"></span>
                  <span class="profile-flow-node flow-node-a"></span>
                  <span class="profile-flow-node flow-node-b"></span>
                  <span class="profile-flow-node flow-node-c"></span>
                  <span class="profile-flow-node flow-node-d"></span>
                  <span class="profile-particle particle-a"></span>
                  <span class="profile-particle particle-b"></span>
                  <span class="profile-particle particle-c"></span>
                  <span class="profile-particle particle-d"></span>
                  <span class="profile-particle particle-e"></span>
                  <span class="profile-particle particle-f"></span>
                </div>
                <div class="profile-line profile-line-a"></div>
                <div class="profile-line profile-line-b"></div>
                <div class="profile-line profile-line-c"></div>
                <div class="profile-stack">
                  <div class="profile-pill profile-card profile-type pill-a">
                    <div class="profile-card-aura"></div>
                    <div class="profile-label">Skin type</div>
                    <div class="profile-value">Dry Skin</div>
                    <div class="profile-subline">
                      <span class="profile-subtitle">Primary type</span>
                      <span class="profile-confidence">92% confidence</span>
                    </div>
                    <div class="profile-confidence-bar"><span></span></div>
                    <div class="profile-type-visual" aria-hidden="true">
                      <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect class="type-frame" x="10.5" y="10.5" width="75" height="75" rx="18" />
                        <path class="type-contour contour-a" d="M28 34c8-7 28-7 38 0" />
                        <path class="type-contour contour-b" d="M24 49c11-9 37-9 48 0" />
                        <path class="type-contour contour-c" d="M30 64c9-6 27-6 36 0" />
                        <circle class="type-point point-a" cx="30" cy="36" r="2.5" />
                        <circle class="type-point point-b" cx="62" cy="50" r="2.5" />
                        <circle class="type-point point-c" cx="49" cy="63" r="2.5" />
                      </svg>
                    </div>
                  </div>
                  <div class="profile-pill profile-card profile-sensitivity pill-b">
                    <div class="profile-card-aura"></div>
                    <div class="profile-card-head">
                      <div class="profile-card-copy">
                        <div class="profile-label">Sensitivity</div>
                        <div class="profile-value">High Sensitivity</div>
                      </div>
                      <div class="sensitivity-signal" aria-hidden="true">
                        <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle class="sens-halo" cx="22" cy="22" r="17.5" />
                          <circle class="sens-ring sens-ring-a" cx="22" cy="22" r="14.5" />
                          <circle class="sens-ring sens-ring-b" cx="22" cy="22" r="8.5" />
                          <path class="sens-wave" d="M10 23.5h5l2.8-4.5 4.2 8 3.2-5 1.8 1.8H34" />
                          <circle class="sens-core" cx="22" cy="22" r="3" />
                        </svg>
                      </div>
                    </div>
                    <div class="profile-subtitle">Reactive barrier response</div>
                  </div>
                  <div class="profile-pill profile-card profile-environment pill-c">
                    <div class="profile-card-aura"></div>
                    <div class="profile-card-head">
                      <div class="profile-card-copy">
                        <div class="profile-label">Environment</div>
                        <div class="profile-value">Urban Exposure</div>
                      </div>
                      <div class="environment-glyph" aria-hidden="true">
                        <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path class="env-line env-line-a" d="M11 28.5 18.5 18l8 5.2 7-8.2" />
                          <path class="env-line env-line-b" d="M18.5 18 26.5 23.2 33.5 15" />
                          <circle class="env-node env-node-a" cx="11" cy="28.5" r="2.6" />
                          <circle class="env-node env-node-b" cx="18.5" cy="18" r="2.6" />
                          <circle class="env-node env-node-c" cx="26.5" cy="23.2" r="2.6" />
                          <circle class="env-node env-node-d" cx="33.5" cy="15" r="2.6" />
                        </svg>
                      </div>
                    </div>
                    <div class="profile-subtitle">Exposure profile</div>
                  </div>
                  <div class="profile-pill profile-card profile-goal pill-d">
                    <div class="profile-card-aura"></div>
                    <div class="profile-goal-top">
                      <div class="profile-card-copy">
                        <div class="profile-label">Primary goal</div>
                        <div class="profile-value">Hydration</div>
                      </div>
                      <div class="goal-mark" aria-hidden="true">
                        <svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle class="goal-halo" cx="26" cy="26" r="20" />
                          <circle class="goal-orb-ring" cx="26" cy="26" r="15" />
                          <circle class="goal-orb-core" cx="26" cy="26" r="10" />
                          <path class="goal-drop-shape" d="M27.8 17.4c3.9 4.8 6.6 8.3 6.6 12 0 4.6-3.8 8.4-8.4 8.4s-8.4-3.8-8.4-8.4c0-3.7 2.8-7.2 6.7-12 .9-1.1 2.6-1.1 3.5 0Z" />
                          <circle class="goal-spark" cx="31.5" cy="21" r="2.2" />
                        </svg>
                      </div>
                    </div>
                    <div class="profile-subtitle">Comfort + moisture retention</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="hero-scene scene-match">
            <div class="scene-shell match-shell">
                <div class="match-head">
                  <div class="scene-kicker">Catalog selection</div>
                  <div class="match-phase">
                    <span class="match-phase-dot"></span>
                    <span class="match-phase-value">Catalog search live</span>
                  </div>
                </div>
              <div class="match-stage">
                <div class="match-counter" aria-live="polite">
                  <span class="match-counter-label">Catalog</span>
                  <strong class="match-counter-value">247 products</strong>
                </div>
                <div class="selection-engine" aria-hidden="true">
                  <div class="engine-ring ring-a"></div>
                  <div class="engine-ring ring-b"></div>
                  <div class="engine-ring ring-c"></div>
                  <div class="engine-pulse"></div>
                  <span class="engine-spark spark-a"></span>
                  <span class="engine-spark spark-b"></span>
                  <span class="engine-spark spark-c"></span>
                  <span class="engine-orbit-dot orbit-dot-a"></span>
                  <span class="engine-orbit-dot orbit-dot-b"></span>
                  <span class="engine-orbit-dot orbit-dot-c"></span>
                  <span class="engine-orbit-dot orbit-dot-d"></span>
                  <div class="selection-engine-core">
                    <span class="engine-core-label">Selecting</span>
                  </div>
                </div>
                <div class="catalog-chip orbit-a catalog-foam" data-family="cleanser">Foaming Cleanser</div>
                <div class="catalog-chip orbit-b catalog-vitamin" data-family="serum">Vitamin C</div>
                <div class="catalog-chip orbit-c catalog-eye" data-family="spf">Eye Cream</div>
                <div class="catalog-chip orbit-d catalog-essence" data-family="serum">Essence</div>
                <div class="catalog-chip orbit-a catalog-retinol" data-family="serum">Retinol</div>
                <div class="catalog-chip orbit-b catalog-toner" data-family="cleanser">Toner</div>
                <div class="catalog-chip orbit-c catalog-barrier" data-family="moisturizer">Barrier Cream</div>
                <div class="catalog-chip orbit-d catalog-mist" data-family="moisturizer">Mist</div>
                <div class="catalog-chip orbit-a catalog-mask" data-family="spf">Sleeping Mask</div>
                <div class="catalog-chip orbit-b catalog-oil" data-family="moisturizer">Oil</div>
                <div class="catalog-chip orbit-c catalog-gel" data-family="cleanser">Gel Wash</div>
                <div class="catalog-chip orbit-d catalog-peptide" data-family="spf">Peptide Cream</div>
                <div class="catalog-chip orbit-a catalog-target target-cleanser is-target" data-family="cleanser">Cleanser</div>
                <div class="catalog-chip orbit-b catalog-target target-serum is-target" data-family="serum">Serum</div>
                <div class="catalog-chip orbit-c catalog-target target-moisturizer is-target" data-family="moisturizer">Moisturizer</div>
                <div class="catalog-chip orbit-d catalog-target target-spf is-target" data-family="spf">SPF</div>
              </div>
            </div>
          </div>
          <div class="hero-scene scene-routine">
            <div class="scene-shell routine-shell">
              <div class="scene-kicker">Personalized routine</div>
              <div class="sheet-title">Routine assembled</div>
              <div class="sheet-meter"><span></span></div>
              <div class="sheet-row row-a">
                <span class="routine-label">Cleanser</span>
                <div class="routine-product routine-product-cleanser">
                  <canvas class="routine-product-canvas" id="cleanserProductCanvas" aria-hidden="true"></canvas>
                  <img class="routine-product-mobile-image routine-product-mobile-image-cleanser" src="/routine-cleanser-mobile.png" alt="" width="1280" height="1280" decoding="async" aria-hidden="true" />
                </div>
              </div>
              <div class="sheet-row row-b">
                <span class="routine-label">Serum</span>
                <div class="routine-product routine-product-serum">
                  <canvas class="routine-product-canvas" id="serumProductCanvas" aria-hidden="true"></canvas>
                  <img class="routine-product-mobile-image routine-product-mobile-image-serum" src="/routine-serum-mobile.png" alt="" width="1280" height="1280" decoding="async" aria-hidden="true" />
                </div>
              </div>
              <div class="sheet-row row-c">
                <span class="routine-label">Moisturizer</span>
                <div class="routine-product routine-product-moisturizer">
                  <canvas class="routine-product-canvas" id="moisturizerProductCanvas" aria-hidden="true"></canvas>
                  <img class="routine-product-mobile-image routine-product-mobile-image-moisturizer" src="/routine-moisturizer-mobile.png" alt="" width="1280" height="1280" decoding="async" aria-hidden="true" />
                </div>
              </div>
              <div class="sheet-row row-d">
                <span class="routine-label">SPF</span>
                <div class="routine-product routine-product-spf">
                  <canvas class="routine-product-canvas" id="spfProductCanvas" aria-hidden="true"></canvas>
                  <img class="routine-product-mobile-image routine-product-mobile-image-spf" src="/routine-spf-mobile.png" alt="" width="1280" height="1280" decoding="async" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
          <div class="hero-scene scene-result">
            <div class="scene-shell result-shell">
              <div class="result-engine" aria-hidden="true">
                <span class="result-orbit orbit-a"></span>
                <span class="result-orbit orbit-b"></span>
                <span class="result-orbit orbit-c"></span>
                <span class="result-particle particle-a"></span>
                <span class="result-particle particle-b"></span>
                <span class="result-particle particle-c"></span>
                <span class="result-particle particle-d"></span>
                <span class="result-particle particle-e"></span>
                <span class="result-particle particle-f"></span>
              </div>
              <div class="result-status">
                <span class="result-status-dot"></span>
                <span class="result-status-value">Routine successfully generated</span>
              </div>
              <div class="result-checkmark" aria-hidden="true">
                <span class="result-check-glow"></span>
                <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle class="check-ring" cx="14" cy="14" r="11.5" />
                  <path class="check-path" d="M9 14.4l3.2 3.2L19.4 10.6" />
                </svg>
              </div>
              <div class="result-title">Personalization complete</div>
              <div class="result-lead">Skin ID finished the routine with a profile match, a curated selection, and a cart-ready bundle.</div>
              <div class="result-checklist">
                <div class="result-check-item">
                  <span class="result-item-check">✓</span>
                  <span>Personalized Routine</span>
                </div>
                <div class="result-check-item">
                  <span class="result-item-check">✓</span>
                  <span>4 Products Selected</span>
                </div>
                <div class="result-check-item">
                  <span class="result-item-check">✓</span>
                  <span>Skin Profile Matched</span>
                </div>
                <div class="result-check-item">
                  <span class="result-item-check">✓</span>
                  <span>Ready for Cart</span>
                </div>
              </div>
              <div class="result-routine-summary">
                <span class="result-routine-chip chip-cleanser">Cleanser</span>
                <span class="result-routine-chip chip-serum">Serum</span>
                <span class="result-routine-chip chip-moisturizer">Moisturizer</span>
                <span class="result-routine-chip chip-spf">SPF</span>
              </div>
              <div class="result-footnote">Profile aligned. Routine assembled. Cart intent unlocked.</div>
              <div class="result-aura"></div>
            </div>
          </div>
        </div>
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
        <div class="control-copy"><div class="kicker" id="stageKicker">Before Skin ID</div><h3 id="stageTitle">More <span class="highlight-word highlight-gold">products.</span> Less <span class="highlight-word highlight-cyan">confidence.</span></h3></div>
        <div class="cloud" id="productCloud"></div>
        <div class="signal-core"><div class="orbit o1"></div><div class="orbit o2"></div><div class="orbit o3"></div></div>
        <div class="decision-map"><svg viewBox="0 0 900 520"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#73a9ff"/><stop offset=".55" stop-color="#ffe7a3"/><stop offset="1" stop-color="#99ecff"/></linearGradient></defs><path class="path" d="M0 252 C176 42, 318 430, 450 252 S724 84, 900 252"/><path class="path" d="M0 426 C214 210, 372 70, 520 252 S704 446, 900 112"/><path class="path" d="M0 112 C220 286, 336 262, 450 252 S642 220, 900 394"/></svg></div>
        <div class="decision-summary-module" id="decisionSummaryModule">
          <div class="routine-board decision-summary-board" id="decisionSummaryBoard" data-state="idle">
            <div class="decision-summary-head">
              <div class="decision-summary-copy">
                <span class="decision-summary-label">Decision summary</span>
                <strong class="decision-summary-title">Decision Summary</strong>
              </div>
              <span class="decision-summary-badge" id="decisionSummaryBadge">Inactive report</span>
            </div>
            <div class="decision-summary-rows">
              <div class="decision-summary-row" data-key="scanned">
                <span class="decision-summary-key">Products scanned</span>
                <span class="decision-summary-value" id="decisionSummaryScanned">&mdash;</span>
              </div>
              <div class="decision-summary-row" data-key="compatible">
                <span class="decision-summary-key">Compatible</span>
                <span class="decision-summary-value" id="decisionSummaryCompatible">&mdash;</span>
              </div>
              <div class="decision-summary-row" data-key="candidates">
                <span class="decision-summary-key">Final candidates</span>
                <span class="decision-summary-value" id="decisionSummaryCandidates">&mdash;</span>
              </div>
              <div class="decision-summary-row" data-key="selected">
                <span class="decision-summary-key">Selected products</span>
                <span class="decision-summary-value" id="decisionSummarySelected">&mdash;</span>
              </div>
              <div class="decision-summary-row decision-summary-row-confidence" data-key="confidence">
                <div class="decision-summary-confidence-head">
                  <span class="decision-summary-key">Match confidence</span>
                  <span class="decision-summary-value" id="decisionSummaryConfidenceValue">&mdash;</span>
                </div>
                <div class="decision-summary-confidence-track">
                  <span class="decision-summary-confidence-fill" id="decisionSummaryConfidenceFill"></span>
                </div>
              </div>
              <div class="decision-summary-row decision-summary-row-status" data-key="status">
                <span class="decision-summary-key">Status</span>
                <div class="decision-summary-status-line">
                  <span class="decision-summary-check" id="decisionSummaryCheckIcon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle class="decision-summary-check-ring" cx="12" cy="12" r="9.5" />
                      <path class="decision-summary-check-path" d="M8.2 12.3 10.8 14.9 15.8 9.8" />
                    </svg>
                  </span>
                  <span class="decision-summary-status-value" id="decisionSummaryStatus">Waiting for analysis</span>
                </div>
              </div>
            </div>
            <div class="decision-summary-timeline" aria-hidden="true">
              <span class="decision-summary-timeline-label">Analysis Path</span>
              <div class="decision-summary-timeline-track">
                <span class="decision-summary-timeline-step" data-stage="scan">
                  <span class="decision-summary-timeline-dot"></span>
                  <span class="decision-summary-timeline-text">Scan</span>
                </span>
                <span class="decision-summary-timeline-step" data-stage="profile">
                  <span class="decision-summary-timeline-dot"></span>
                  <span class="decision-summary-timeline-text">Profile</span>
                </span>
                <span class="decision-summary-timeline-step" data-stage="matching">
                  <span class="decision-summary-timeline-dot"></span>
                  <span class="decision-summary-timeline-text">Matching</span>
                </span>
                <span class="decision-summary-timeline-step" data-stage="routine">
                  <span class="decision-summary-timeline-dot"></span>
                  <span class="decision-summary-timeline-text">Routine</span>
                </span>
              </div>
            </div>
            <div class="decision-summary-completion-glow" id="decisionSummaryCompletionGlow"></div>
            <div class="decision-summary-success-wave" id="decisionSummarySuccessWave"></div>
          </div>
          <button class="decision-summary-action" id="decisionSummaryAction" type="button" data-mode="run">
            <span class="decision-summary-action-icon" aria-hidden="true">
              <svg class="icon-play" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 3.5 12 8 5 12.5V3.5Z" />
              </svg>
              <svg class="icon-replay" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4.4 5.1H1.8V2.5" />
                <path d="M2.1 5.1a5.7 5.7 0 1 1-.3 6.6" />
              </svg>
            </span>
            <span class="decision-summary-action-label">Run the decision engine</span>
          </button>
        </div>
      </div>
    </div>
  </section>

  <section class="simulator brand-story" id="simulator" aria-labelledby="brandStoryTitle">
    <div class="story-shell">
      <div class="story-header">
        <div class="eyebrow"><span class="dot"></span>Decision-First Skincare</div>
        <div class="story-header-row">
          <div class="story-header-copy">
            <h2 id="brandStoryTitle">Why brands choose Skin ID.</h2>
            <p class="lead">Every slide answers a different question brands ask before they decide to move forward.</p>
          </div>
          <div class="story-nav-group" aria-label="Carousel controls">
            <button class="story-nav" type="button" data-story-nav="prev" aria-label="Previous reason">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 5 8 12l7 7" />
              </svg>
            </button>
            <button class="story-nav" type="button" data-story-nav="next" aria-label="Next reason">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <path d="m9 5 7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div class="story-frame" tabindex="0" role="region" aria-label="Why brands choose Skin ID" aria-describedby="brandStoryProgressText">
        <div class="brand-story-track" id="brandStoryTrack">
          <article class="story-slide story-slide-scale is-active" data-state="active" aria-label="Traditional browsing versus guided decisions">
            <div class="story-slide-top">
              <span class="story-kicker">Browse vs decide</span>
              <h3>
                Most skincare stores are built to <span class="impact-browse-lock">
                  <span class="impact-browse-word" aria-label="browse">
                    <span class="impact-browse-text">browse</span>
                    <span class="impact-browse-glass" aria-hidden="true">
                      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="28" cy="28" r="14" />
                        <path d="M38 38L50 50" />
                      </svg>
                    </span>
                  </span>,
                </span> not to <span class="impact-decide-word">decide</span>.
              </h3>
              <p>Customers don&rsquo;t need more products. They need a clear path to the right one.</p>
            </div>
            <div class="story-commerce-toggle" role="group" aria-label="Choose comparison view">
              <button class="story-commerce-toggle-button" type="button" data-mobile-view-option="chaos" aria-pressed="false">
                Traditional Store
              </button>
              <button class="story-commerce-toggle-button is-active" type="button" data-mobile-view-option="guided" aria-pressed="true">
                With Skin ID
              </button>
            </div>
            <div class="story-commerce-compare" data-mobile-view="guided" aria-label="Comparison between a traditional store and a guided Skin ID journey">
              <div class="story-commerce-column story-commerce-chaos">
                <div class="story-commerce-head">
                  <span class="story-commerce-label">Traditional Store</span>
                </div>
                <div class="story-chaos-stage" aria-hidden="true">
                  <span class="story-chaos-connector connector-a"></span>
                  <span class="story-chaos-connector connector-b"></span>
                  <span class="story-chaos-connector connector-c"></span>
                  <span class="story-chaos-connector connector-d"></span>
                  <span class="story-chaos-wanderer"></span>
                  <div class="story-chaos-card card-cleanser">Cleanser</div>
                  <div class="story-chaos-card card-serum">Serum</div>
                  <div class="story-chaos-card card-moisturizer">Moisturizer</div>
                  <div class="story-chaos-card card-spf">SPF</div>
                  <div class="story-chaos-card card-eye">Eye Cream</div>
                  <div class="story-chaos-card card-mask">Mask</div>
                  <div class="story-chaos-card card-toner">Toner</div>
                  <div class="story-chaos-card card-mist">Mist</div>
                </div>
              </div>
              <div class="story-commerce-column story-commerce-guided">
                <div class="story-commerce-head">
                  <span class="story-commerce-label">With Skin ID</span>
                </div>
                <div class="story-guided-stage" aria-hidden="true">
                  <span class="story-guided-line"></span>
                  <div class="story-guided-step step-scan">
                    <span class="story-guided-dot"></span>
                    <div class="story-guided-card">
                      <span class="story-guided-card-label">Face Scan</span>
                      <span class="story-guided-card-icon" aria-hidden="true">
                        <svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <defs>
                            <linearGradient id="gold" x1="280" y1="280" x2="744" y2="744" gradientUnits="userSpaceOnUse">
                              <stop offset="0" stop-color="#F8E08B"/>
                              <stop offset="0.45" stop-color="#D9B44A"/>
                              <stop offset="1" stop-color="#FFF0A8"/>
                            </linearGradient>
                            <linearGradient id="bg" x1="128" y1="128" x2="896" y2="896" gradientUnits="userSpaceOnUse">
                              <stop stop-color="#171717"/>
                              <stop offset="1" stop-color="#050505"/>
                            </linearGradient>
                          </defs>
                          <rect width="1024" height="1024" rx="220" fill="url(#bg)"/>
                          <rect x="1.5" y="1.5" width="1021" height="1021" rx="218.5" stroke="#2B2B2B" stroke-width="3"/>
                          <path d="M290 365V315C290 287.386 312.386 265 340 265H390" stroke="url(#gold)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
                          <path d="M634 265H684C711.614 265 734 287.386 734 315V365" stroke="url(#gold)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
                          <path d="M290 659V709C290 736.614 312.386 759 340 759H390" stroke="url(#gold)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
                          <path d="M634 759H684C711.614 759 734 736.614 734 709V659" stroke="url(#gold)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
                          <path d="M512 315 C414 315 366 382 366 470 V515 C343 506 326 521 326 549 C326 583 342 611 368 613 C375 687 429 755 512 755 C595 755 649 687 656 613 C682 611 698 583 698 549 C698 521 681 506 658 515 V470 C658 382 610 315 512 315Z" stroke="url(#gold)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      </span>
                    </div>
                  </div>
                  <div class="story-guided-step step-profile">
                    <span class="story-guided-dot"></span>
                    <div class="story-guided-card">
                      <span class="story-guided-card-label">Skin Profile</span>
                      <span class="story-guided-card-icon" aria-hidden="true">
                        <img src="/skin_profile_exact.png" srcset="/skin_profile_exact-mobile.png 384w, /skin_profile_exact.png 1254w" sizes="(max-width: 768px) 82px, 104px" width="1254" height="1254" loading="lazy" decoding="async" alt="" />
                      </span>
                    </div>
                    </div>
                    <div class="story-guided-step step-routine">
                      <span class="story-guided-dot"></span>
                      <div class="story-guided-card">
                        <span class="story-guided-card-label">Personalized Routine</span>
                        <span class="story-guided-card-icon" aria-hidden="true">
                          <img src="/personalized_routine_icon.png" srcset="/personalized_routine_icon-mobile.png 384w, /personalized_routine_icon.png 1254w" sizes="(max-width: 768px) 82px, 104px" width="1254" height="1254" loading="lazy" decoding="async" alt="" />
                        </span>
                      </div>
                    </div>
                    <div class="story-guided-step step-checkout">
                      <span class="story-guided-dot"></span>
                      <div class="story-guided-card">
                        <span class="story-guided-card-label">Checkout</span>
                        <span class="story-guided-card-icon" aria-hidden="true">
                          <img src="/checkout_icon.png" srcset="/checkout_icon-mobile.png 384w, /checkout_icon.png 1254w" sizes="(max-width: 768px) 82px, 104px" width="1254" height="1254" loading="lazy" decoding="async" alt="" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
            </div>
            <div class="story-scale-lane" aria-label="Catalog reduction from 247 products to one routine">
              <div class="story-metric-card">
                <span class="story-metric-value" data-target="247">247</span>
                <span class="story-metric-label">Possible choices</span>
              </div>
              <span class="story-scale-arrow" aria-hidden="true">→</span>
              <div class="story-metric-card">
                <span class="story-metric-value" data-target="81">81</span>
                <span class="story-metric-label">Compatible products</span>
              </div>
              <span class="story-scale-arrow" aria-hidden="true">→</span>
              <div class="story-metric-card">
                <span class="story-metric-value" data-target="19">19</span>
                <span class="story-metric-label">Worth considering</span>
              </div>
              <span class="story-scale-arrow" aria-hidden="true">→</span>
              <div class="story-metric-card">
                <span class="story-metric-value" data-target="4">4</span>
                <span class="story-metric-label">Best matches</span>
              </div>
              <span class="story-scale-arrow" aria-hidden="true">→</span>
              <div class="story-metric-card story-metric-card-final">
                <span class="story-metric-value" data-target="1">1</span>
                <span class="story-metric-label">Confident decision</span>
              </div>
            </div>
            <div class="story-scale-summary">
              <div class="story-confidence-card">
                <span class="story-confidence-value story-metric-value" data-target="96" data-suffix="%">96%</span>
                <span class="story-confidence-label">Match confidence</span>
              </div>
              <div class="story-scale-note">
                <span class="story-scale-line"></span>
                <p>Less choice. More confidence.</p>
              </div>
            </div>
          </article>

          <article class="story-slide story-slide-impact" data-state="peek" aria-label="Business impact">
            <div class="story-slide-top">
              <span class="story-kicker">Business impact</span>
              <h3>
                Built to <span class="impact-convert-word" aria-label="convert">
                  <span class="impact-convert-text">convert</span>
                  <span class="impact-convert-dollar" aria-hidden="true">$</span>
                </span>
              </h3>
              <p>When customers stop guessing, better commercial outcomes naturally follow.</p>
            </div>
            <div class="story-impact-grid">
              <div class="story-impact-card impact-conversions">
                <span class="story-impact-icon" aria-hidden="true">
                  <svg class="icon-graph" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 36H38" />
                    <path d="M14 30L21 23L27 28L36 17" />
                    <path d="M30 17H36V23" />
                  </svg>
                </span>
                <strong>
                  More
                  <span class="impact-conversion-word">
                    Conversions
                    <span class="impact-dollar impact-dollar-a" aria-hidden="true">$</span>
                    <span class="impact-dollar impact-dollar-b" aria-hidden="true">$</span>
                    <span class="impact-dollar impact-dollar-c" aria-hidden="true">$</span>
                    <span class="impact-dollar impact-dollar-d" aria-hidden="true">$</span>
                  </span>
                </strong>
                <p>More visitors reach a <span class="impact-body-emphasis">confident buying decision</span>.</p>
              </div>
              <div class="story-impact-card impact-carts">
                <span class="story-impact-icon" aria-hidden="true">
                  <svg class="icon-cart" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 14H15L18 29H33L37 19H20" />
                    <path d="M21 34.5C21 35.9 19.9 37 18.5 37C17.1 37 16 35.9 16 34.5C16 33.1 17.1 32 18.5 32C19.9 32 21 33.1 21 34.5Z" />
                    <path d="M35 34.5C35 35.9 33.9 37 32.5 37C31.1 37 30 35.9 30 34.5C30 33.1 31.1 32 32.5 32C33.9 32 35 33.1 35 34.5Z" />
                  </svg>
                </span>
                <strong><span class="impact-cart-word">Larger</span> Carts</strong>
                <p><span class="impact-body-emphasis">Complete routines</span> naturally increase average order value.</p>
              </div>
              <div class="story-impact-card impact-hesitation">
                <span class="story-impact-icon" aria-hidden="true">
                  <svg class="icon-spark" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M24 12L27.5 20.5L36 24L27.5 27.5L24 36L20.5 27.5L12 24L20.5 20.5L24 12Z" />
                    <path d="M34 11L35.5 14.5L39 16L35.5 17.5L34 21L32.5 17.5L29 16L32.5 14.5L34 11Z" />
                  </svg>
                </span>
                <strong class="impact-hesitation-title" aria-label="Less Hesitation">
                  <span class="impact-hesitation-word" aria-hidden="true">
                    <span class="impact-hesitation-letter" style="--impact-letter-index:0">L</span>
                    <span class="impact-hesitation-letter" style="--impact-letter-index:1">e</span>
                    <span class="impact-hesitation-letter" style="--impact-letter-index:2">s</span>
                    <span class="impact-hesitation-letter" style="--impact-letter-index:3">s</span>
                  </span>
                  <span class="impact-hesitation-word" aria-hidden="true">
                    <span class="impact-hesitation-letter" style="--impact-letter-index:4">H</span>
                    <span class="impact-hesitation-letter" style="--impact-letter-index:5">e</span>
                    <span class="impact-hesitation-letter" style="--impact-letter-index:6">s</span>
                    <span class="impact-hesitation-letter" style="--impact-letter-index:7">i</span>
                    <span class="impact-hesitation-letter" style="--impact-letter-index:8">t</span>
                    <span class="impact-hesitation-letter" style="--impact-letter-index:9">a</span>
                    <span class="impact-hesitation-letter" style="--impact-letter-index:10">t</span>
                    <span class="impact-hesitation-letter" style="--impact-letter-index:11">i</span>
                    <span class="impact-hesitation-letter" style="--impact-letter-index:12">o</span>
                    <span class="impact-hesitation-letter" style="--impact-letter-index:13">n</span>
                  </span>
                </strong>
                <p><span class="impact-body-emphasis">Clear recommendations</span> remove buying friction.</p>
              </div>
              <div class="story-impact-card impact-discovery">
                <span class="story-impact-icon" aria-hidden="true">
                  <svg class="icon-discovery" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="8" y="10" width="10" height="10" rx="3" />
                    <rect x="30" y="10" width="10" height="10" rx="3" />
                    <rect x="19" y="28" width="10" height="10" rx="3" />
                    <path d="M18 15H30" />
                    <path d="M13 20V24C13 26.2 14.8 28 17 28H24" />
                    <path d="M35 20V24C35 26.2 33.2 28 31 28H24" />
                  </svg>
                </span>
                <strong>
                  More
                  <span class="impact-discovery-word">
                    Discovery
                    <span class="impact-discovery-burst impact-discovery-burst-a" aria-hidden="true">
                      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="6.2" y="4.2" width="7.6" height="2.4" rx="1.2" />
                        <path d="M7.1 6.6H12.9C13.9 6.6 14.7 7.4 14.7 8.4V14C14.7 15 13.9 15.8 12.9 15.8H7.1C6.1 15.8 5.3 15 5.3 14V8.4C5.3 7.4 6.1 6.6 7.1 6.6Z" />
                      </svg>
                    </span>
                    <span class="impact-discovery-burst impact-discovery-burst-b" aria-hidden="true">
                      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="4.6" y="7.1" width="10.8" height="7.6" rx="2.4" />
                        <path d="M6.6 7.1V5.9C6.6 5.1 7.2 4.5 8 4.5H12C12.8 4.5 13.4 5.1 13.4 5.9V7.1" />
                      </svg>
                    </span>
                    <span class="impact-discovery-burst impact-discovery-burst-c" aria-hidden="true">
                      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8.2 4.4H11.8L13.2 7.1H6.8L8.2 4.4Z" />
                        <path d="M7.2 7.1H12.8C13.8 7.1 14.6 7.9 14.6 8.9V14C14.6 15 13.8 15.8 12.8 15.8H7.2C6.2 15.8 5.4 15 5.4 14V8.9C5.4 7.9 6.2 7.1 7.2 7.1Z" />
                      </svg>
                    </span>
                    <span class="impact-discovery-burst impact-discovery-burst-d" aria-hidden="true">
                      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8.2 4.4H11.8L13.2 7.1H6.8L8.2 4.4Z" />
                        <path d="M7.2 7.1H12.8C13.8 7.1 14.6 7.9 14.6 8.9V14C14.6 15 13.8 15.8 12.8 15.8H7.2C6.2 15.8 5.4 15 5.4 14V8.9C5.4 7.9 6.2 7.1 7.2 7.1Z" />
                      </svg>
                    </span>
                  </span>
                </strong>
                <p>The <span class="impact-body-emphasis">right products</span> become easier to find.</p>
              </div>
              <div class="story-impact-card impact-confidence">
                <span class="story-impact-icon" aria-hidden="true">
                  <svg class="icon-shield" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M24 10L35 14V23.5C35 30.2 30.3 36.2 24 38C17.7 36.2 13 30.2 13 23.5V14L24 10Z" />
                    <path d="M19 24.5L22.5 28L29.5 20.5" />
                  </svg>
                </span>
                <strong>
                  More
                  <span class="impact-confidence-word">
                    Confidence
                    <span class="impact-confidence-burst impact-confidence-burst-a" aria-hidden="true">
                      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 2.8L11.9 7L16.2 8.9L11.9 10.8L10 15L8.1 10.8L3.8 8.9L8.1 7L10 2.8Z" />
                      </svg>
                    </span>
                    <span class="impact-confidence-burst impact-confidence-burst-b" aria-hidden="true">
                      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 16.4L4.2 10.7C2.8 9.3 2.8 7 4.2 5.6C5.6 4.2 7.8 4.2 9.2 5.6L10 6.4L10.8 5.6C12.2 4.2 14.4 4.2 15.8 5.6C17.2 7 17.2 9.3 15.8 10.7L10 16.4Z" />
                      </svg>
                    </span>
                    <span class="impact-confidence-burst impact-confidence-burst-c" aria-hidden="true">
                      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 2.8L11.9 7L16.2 8.9L11.9 10.8L10 15L8.1 10.8L3.8 8.9L8.1 7L10 2.8Z" />
                      </svg>
                    </span>
                    <span class="impact-confidence-burst impact-confidence-burst-d" aria-hidden="true">
                      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 16.4L4.2 10.7C2.8 9.3 2.8 7 4.2 5.6C5.6 4.2 7.8 4.2 9.2 5.6L10 6.4L10.8 5.6C12.2 4.2 14.4 4.2 15.8 5.6C17.2 7 17.2 9.3 15.8 10.7L10 16.4Z" />
                      </svg>
                    </span>
                  </span>
                </strong>
                <p>Customers <span class="impact-body-emphasis">trust recommendations</span> instead of guessing.</p>
              </div>
            </div>
          </article>

          <article class="story-slide story-slide-contrast" data-state="upcoming" aria-label="Not another skincare quiz">
            <div class="story-slide-top">
              <span class="story-kicker">Category difference</span>
              <h3>Not another skincare quiz.</h3>
              <p>A quiz collects answers. Skin ID turns customer context and catalog logic into a decision.</p>
            </div>
            <div class="story-contrast-grid">
              <div class="story-contrast-bridge" aria-hidden="true">
                <span class="story-contrast-bridge-line"></span>
              </div>
              <div class="story-contrast-card story-contrast-card-muted">
                <div class="story-contrast-head">
                  <span class="story-contrast-tag">Most Quiz Tools</span>
                </div>
                <ul class="story-contrast-list">
                  <li class="story-contrast-item" style="--story-contrast-gap:0px">
                    <div class="story-contrast-row" data-pair="row-1" data-side="left" data-tone="blue">
                      <span class="story-contrast-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="4" y="5" width="16" height="14" rx="3" />
                          <path d="M8 9.5H16" />
                          <path d="M8 12.5H13.5" />
                          <path d="M8 15.5H12" />
                        </svg>
                      </span>
                      <span class="story-contrast-copy">Static questions</span>
                    </div>
                  </li>
                  <li class="story-contrast-item" style="--story-contrast-gap:14px">
                    <div class="story-contrast-row" data-pair="row-2" data-side="left" data-tone="gold">
                      <span class="story-contrast-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="4" y="7" width="4" height="10" rx="1.8" />
                          <rect x="10" y="9" width="4" height="8" rx="1.8" />
                          <rect x="16" y="6" width="4" height="11" rx="1.8" />
                          <path d="M7 5.5L12 3.5L17 5.5" />
                        </svg>
                      </span>
                      <span class="story-contrast-copy">Broad product suggestions</span>
                    </div>
                  </li>
                  <li class="story-contrast-item" style="--story-contrast-gap:14px">
                    <div class="story-contrast-row" data-pair="row-3" data-side="left" data-tone="mint">
                      <span class="story-contrast-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="5" y="6" width="5" height="5" rx="1.5" />
                          <rect x="14" y="6" width="5" height="5" rx="1.5" />
                          <rect x="5" y="13" width="5" height="5" rx="1.5" />
                          <rect x="14" y="13" width="5" height="5" rx="1.5" />
                          <path d="M10 8.5H14" />
                          <path d="M10 15.5H14" />
                        </svg>
                      </span>
                      <span class="story-contrast-copy">Same logic for every catalog</span>
                    </div>
                  </li>
                  <li class="story-contrast-item" style="--story-contrast-gap:14px">
                    <div class="story-contrast-row" data-pair="row-4" data-side="left" data-tone="blue">
                      <span class="story-contrast-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="8" y="6" width="8" height="12" rx="2.4" />
                          <path d="M10 6V4.5C10 3.67 10.67 3 11.5 3H12.5C13.33 3 14 3.67 14 4.5V6" />
                          <path d="M9.5 11H14.5" />
                        </svg>
                      </span>
                      <span class="story-contrast-copy">Isolated recommendations</span>
                    </div>
                  </li>
                </ul>
              </div>
              <div class="story-contrast-card story-contrast-card-accent">
                <div class="story-contrast-head">
                  <span class="story-contrast-tag">Skin ID</span>
                </div>
                <ul class="story-contrast-list">
                  <li class="story-contrast-item" style="--story-contrast-gap:0px">
                    <div class="story-contrast-row" data-pair="row-1" data-side="right" data-tone="blue">
                      <span class="story-contrast-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M7.5 8.5C8.7 6.3 10.2 5.2 12 5.2C13.8 5.2 15.3 6.3 16.5 8.5" />
                          <path d="M8.3 14.8C9.1 16.7 10.3 18 12 18C13.7 18 14.9 16.7 15.7 14.8" />
                          <path d="M9.2 10.6H9.3" />
                          <path d="M14.7 10.6H14.8" />
                          <circle cx="18.2" cy="8.2" r="2.2" />
                          <path d="M18.2 4.8V3.6" />
                          <path d="M21.6 8.2H22.8" />
                        </svg>
                      </span>
                      <span class="story-contrast-copy">Skin analysis and customer signals</span>
                    </div>
                  </li>
                  <li class="story-contrast-item" style="--story-contrast-gap:14px">
                    <div class="story-contrast-row" data-pair="row-2" data-side="right" data-tone="gold">
                      <span class="story-contrast-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="7" cy="12" r="2.2" />
                          <circle cx="12" cy="7" r="2.2" />
                          <circle cx="17" cy="12" r="2.2" />
                          <circle cx="12" cy="17" r="2.2" />
                          <path d="M8.8 10.3L10.3 8.8" />
                          <path d="M13.7 8.8L15.2 10.3" />
                          <path d="M15.2 13.7L13.7 15.2" />
                          <path d="M10.3 15.2L8.8 13.7" />
                        </svg>
                      </span>
                      <span class="story-contrast-copy">Catalog-specific decision logic</span>
                    </div>
                  </li>
                  <li class="story-contrast-item" style="--story-contrast-gap:14px">
                    <div class="story-contrast-row" data-pair="row-3" data-side="right" data-tone="mint">
                      <span class="story-contrast-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="7" y="5" width="10" height="4.2" rx="1.6" />
                          <rect x="5" y="10.2" width="14" height="4.2" rx="1.6" />
                          <rect x="8.2" y="15.4" width="7.6" height="3.6" rx="1.4" />
                        </svg>
                      </span>
                      <span class="story-contrast-copy">Complete routine construction</span>
                    </div>
                  </li>
                  <li class="story-contrast-item" style="--story-contrast-gap:14px">
                    <div class="story-contrast-row" data-pair="row-4" data-side="right" data-tone="blue">
                      <span class="story-contrast-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M5 17.5C7.2 16.8 8.8 15.5 10.3 13.6C11.5 12.1 12.8 10.1 15 8.7C16.3 7.9 17.7 7.4 19 7.2" />
                          <path d="M15.5 7.2H19V10.7" />
                          <circle cx="8.2" cy="16.7" r="1.7" />
                          <circle cx="16.9" cy="7.6" r="1.7" />
                        </svg>
                      </span>
                      <span class="story-contrast-copy">Clear recommendation path</span>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </article>

          <article class="story-slide story-slide-flow" data-state="upcoming" aria-label="Custom implementation">
            <div class="story-slide-top">
              <span class="story-kicker">Custom implementation</span>
              <h3>Built around your <span class="story-flow-brand-word">brand</span>.</h3>
              <p>Every deployment starts with understanding the brand, then building, reviewing, designing, testing and finally launching a fully tailored experience.</p>
            </div>
            <div class="story-flow-shell">
              <div class="story-flow-track" aria-label="Skin ID custom implementation timeline">
                <div class="story-flow-line" aria-hidden="true">
                  <span class="story-flow-line-fill"></span>
                </div>

                <div class="story-flow-step" data-step="1" data-state="upcoming">
                  <span class="story-flow-node">
                    <span class="story-flow-index">01</span>
                  </span>
                  <div class="story-flow-card">
                    <span class="story-flow-icon story-flow-icon-discovery" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6.5 8.9C6.5 7.3 7.8 6 9.4 6H14.2C15.8 6 17.1 7.3 17.1 8.9V11.1C17.1 12.7 15.8 14 14.2 14H10.7L8.3 16V14C7.3 13.6 6.5 12.5 6.5 11.2V8.9Z" />
                        <path d="M9.7 10H13.9" />
                        <path d="M9.7 12H12.4" />
                        <path d="M18.4 6.2L19 7.7L20.5 8.3L19 8.9L18.4 10.4L17.8 8.9L16.3 8.3L17.8 7.7L18.4 6.2Z" />
                      </svg>
                    </span>
                    <div class="story-flow-copy">
                      <strong>Discovery</strong>
                      <p>We start by understanding your brand.</p>
                    </div>
                  </div>
                </div>

                <div class="story-flow-step" data-step="2" data-state="upcoming">
                  <span class="story-flow-node">
                    <span class="story-flow-index">02</span>
                  </span>
                  <div class="story-flow-card">
                    <span class="story-flow-icon story-flow-icon-engine" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6.5 15.8L12 6.8L17.5 15.8" />
                        <path d="M8.5 12.5H15.5" />
                        <path d="M9.6 15.8L12 11.8L14.4 15.8" />
                        <path d="M10.8 9.1H13.2" />
                      </svg>
                    </span>
                    <div class="story-flow-copy">
                      <strong>Foundation</strong>
                      <p>We build your decision engine around your products, routines and brand logic.</p>
                    </div>
                  </div>
                </div>

                <div class="story-flow-step" data-step="3" data-state="upcoming">
                  <span class="story-flow-node">
                    <span class="story-flow-index">03</span>
                  </span>
                  <div class="story-flow-card">
                    <span class="story-flow-icon story-flow-icon-review" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="7" y="6.5" width="10" height="12" rx="2.4" />
                        <path d="M10 6.5V5.6C10 4.72 10.72 4 11.6 4H12.4C13.28 4 14 4.72 14 5.6V6.5" />
                        <path d="M9.5 10H14.5" />
                        <path d="M9.5 12.8H13.1" />
                        <path d="M9.7 15.4L11.3 16.9L14.7 13.5" />
                        <path d="M17.8 7.1L18.3 8.3L19.5 8.8L18.3 9.3L17.8 10.5L17.3 9.3L16.1 8.8L17.3 8.3L17.8 7.1Z" />
                      </svg>
                    </span>
                    <div class="story-flow-copy">
                      <strong>Brand Review</strong>
                      <p>Nothing goes live without your approval.</p>
                    </div>
                  </div>
                </div>

                <div class="story-flow-step" data-step="4" data-state="upcoming">
                  <span class="story-flow-node">
                    <span class="story-flow-index">04</span>
                  </span>
                  <div class="story-flow-card">
                    <span class="story-flow-icon story-flow-icon-experience" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="6" width="14" height="12" rx="2.8" />
                        <path d="M5 9.4H19" />
                        <path d="M9 9.4V18" />
                        <rect x="11.6" y="11.3" width="4.8" height="3.9" rx="1.1" />
                        <path d="M7.1 12.5H7.2" />
                        <path d="M7.1 15H7.2" />
                        <path d="M16.8 5.1L17.3 6.3L18.5 6.8L17.3 7.3L16.8 8.5L16.3 7.3L15.1 6.8L16.3 6.3L16.8 5.1Z" />
                      </svg>
                    </span>
                    <div class="story-flow-copy">
                      <strong>Custom Experience</strong>
                      <p>Designed to look like your brand.</p>
                    </div>
                  </div>
                </div>

                <div class="story-flow-step" data-step="5" data-state="upcoming">
                  <span class="story-flow-node">
                    <span class="story-flow-index">05</span>
                  </span>
                  <div class="story-flow-card">
                    <span class="story-flow-icon story-flow-icon-testing" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 4.8L17.5 7.2V11.7C17.5 14.8 15.33 17.66 12.34 18.98L12 19.12L11.66 18.98C8.67 17.66 6.5 14.8 6.5 11.7V7.2L12 4.8Z" />
                        <path d="M9.6 12.2L11.3 13.9L14.7 10.5" />
                      </svg>
                    </span>
                    <div class="story-flow-copy">
                      <strong>Testing</strong>
                      <p>We test the experience before it reaches your customers.</p>
                    </div>
                  </div>
                </div>

                <div class="story-flow-step story-flow-step-launch" data-step="6" data-state="upcoming">
                  <span class="story-flow-node">
                    <span class="story-flow-index">06</span>
                  </span>
                  <div class="story-flow-card">
                    <span class="story-flow-icon story-flow-icon-launch" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M13.9 4.7C16.2 4.9 18.1 6.8 18.3 9.1L14.4 13L10 8.6L13.9 4.7Z" />
                        <path d="M10 8.6L7.2 9.2L4.9 11.5L8.5 11.9" />
                        <path d="M14.4 13L14 16.6L11.7 18.9L11.1 16.1" />
                        <path d="M8.5 11.9L10.5 13.9L12.8 16.2" />
                        <circle cx="13.9" cy="8.8" r="1.45" />
                        <path d="M8.8 15.5L4.7 19.6" />
                        <path d="M10.1 16.8L7.1 19.8" />
                        <path d="M7.5 14.2L4.5 17.2" />
                      </svg>
                    </span>
                    <div class="story-flow-copy">
                      <strong>Launch</strong>
                      <p>Launch with confidence.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article class="story-slide story-slide-engine" data-state="upcoming" aria-label="Decision engine">
            <div class="story-slide-top">
              <span class="story-kicker">The decision engine</span>
              <h3>Customer context meets the brand&rsquo;s own catalog logic.</h3>
              <p>Inputs flow into a central engine that resolves one personalized routine instead of a pile of loose suggestions.</p>
            </div>
            <div class="story-engine-visual" aria-hidden="true">
              <div class="story-engine-column story-engine-inputs">
                <span class="story-engine-node tone-blue">Skin profile</span>
                <span class="story-engine-node tone-mint">Sensitivity</span>
                <span class="story-engine-node tone-gold">Goals</span>
                <span class="story-engine-node tone-blue">Environment</span>
                <span class="story-engine-node tone-mint">Routine preference</span>
                <span class="story-engine-node tone-gold">Product catalog</span>
                <span class="story-engine-node tone-blue">Product rules</span>
              </div>
              <div class="story-engine-core">
                <span class="story-engine-orbit orbit-a"></span>
                <span class="story-engine-orbit orbit-b"></span>
                <span class="story-engine-particle particle-a"></span>
                <span class="story-engine-particle particle-b"></span>
                <span class="story-engine-particle particle-c"></span>
                <div class="story-engine-core-card">
                  <span class="story-engine-core-label">Skin ID</span>
                  <strong>Decision engine</strong>
                  <p>Catalog-specific reasoning, routine construction and confidence calibration.</p>
                </div>
              </div>
              <div class="story-engine-output">
                <span class="story-engine-output-label">Output</span>
                <strong>One personalized routine</strong>
                <p>Clear recommendation path, ready for cart behavior.</p>
              </div>
            </div>
          </article>

          <article class="story-slide story-slide-insights" data-state="upcoming" aria-label="Post-launch insights">
            <div class="story-slide-top">
              <span class="story-kicker">Post-launch intelligence</span>
              <h3>Understand customers beyond the checkout.</h3>
              <p>Every interaction becomes insight, helping brands better understand customer needs, refine recommendation logic and improve commercial decisions over time.</p>
            </div>
            <div class="story-intel-dashboard" aria-hidden="true">
              <div class="story-intel-grid">
                <section class="story-intel-widget story-intel-widget-needs" style="--story-intel-delay:.2s">
                  <div class="story-intel-widget-head">
                    <div>
                      <span class="story-intel-widget-kicker">What customers need</span>
                      <h4>Live concern ranking</h4>
                    </div>
                    <span class="story-intel-widget-signal"></span>
                  </div>
                  <div class="story-intel-rank-list">
                    <div class="story-intel-rank-row" style="--story-intel-fill:.92;--story-intel-item-delay:.34s">
                      <span>Hydration</span>
                      <div class="story-intel-rank-bar"><span></span></div>
                    </div>
                    <div class="story-intel-rank-row" style="--story-intel-fill:.8;--story-intel-item-delay:.46s">
                      <span>Barrier Repair</span>
                      <div class="story-intel-rank-bar"><span></span></div>
                    </div>
                    <div class="story-intel-rank-row" style="--story-intel-fill:.66;--story-intel-item-delay:.58s">
                      <span>Acne</span>
                      <div class="story-intel-rank-bar"><span></span></div>
                    </div>
                    <div class="story-intel-rank-row" style="--story-intel-fill:.58;--story-intel-item-delay:.7s">
                      <span>Sensitivity</span>
                      <div class="story-intel-rank-bar"><span></span></div>
                    </div>
                    <div class="story-intel-rank-row" style="--story-intel-fill:.46;--story-intel-item-delay:.82s">
                      <span>Brightening</span>
                      <div class="story-intel-rank-bar"><span></span></div>
                    </div>
                  </div>
                  <p class="story-intel-widget-note">Most selected concern</p>
                </section>

                <section class="story-intel-widget story-intel-widget-profile" style="--story-intel-delay:.56s">
                  <div class="story-intel-widget-head">
                    <div>
                      <span class="story-intel-widget-kicker">Skin profile distribution</span>
                      <h4>Detected profile mix</h4>
                    </div>
                    <span class="story-intel-widget-signal"></span>
                  </div>
                  <div class="story-intel-profile-shell">
                    <div class="story-intel-profile-chart-wrap">
                      <div class="story-intel-profile-chart">
                        <svg viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg">
                          <circle class="story-intel-ring-track" cx="70" cy="70" r="44"></circle>
                          <circle class="story-intel-ring-segment tone-blue" cx="70" cy="70" r="44" style="--story-intel-segment:94;--story-intel-offset:0;--story-intel-item-delay:.9s"></circle>
                          <circle class="story-intel-ring-segment tone-mint" cx="70" cy="70" r="44" style="--story-intel-segment:72;--story-intel-offset:-100;--story-intel-item-delay:1.02s"></circle>
                          <circle class="story-intel-ring-segment tone-gold" cx="70" cy="70" r="44" style="--story-intel-segment:56;--story-intel-offset:-178;--story-intel-item-delay:1.14s"></circle>
                          <circle class="story-intel-ring-segment tone-soft" cx="70" cy="70" r="44" style="--story-intel-segment:40;--story-intel-offset:-240;--story-intel-item-delay:1.26s"></circle>
                        </svg>
                      </div>
                      <div class="story-intel-counter" aria-label="1248 profiles mapped">
                        <div class="story-intel-counter-digits">
                          <span class="story-intel-digit-window"><span class="story-intel-digit-track" style="--story-intel-digit:1;--story-intel-item-delay:1.16s"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span></span></span>
                          <span class="story-intel-digit-window"><span class="story-intel-digit-track" style="--story-intel-digit:2;--story-intel-item-delay:1.22s"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span></span></span>
                          <span class="story-intel-digit-window"><span class="story-intel-digit-track" style="--story-intel-digit:4;--story-intel-item-delay:1.28s"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span></span></span>
                          <span class="story-intel-digit-window"><span class="story-intel-digit-track" style="--story-intel-digit:8;--story-intel-item-delay:1.34s"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span></span></span>
                        </div>
                        <span class="story-intel-counter-label">Profiles mapped</span>
                      </div>
                    </div>
                    <div class="story-intel-profile-legend">
                      <div class="story-intel-legend-row" style="--story-intel-item-delay:1.18s"><span class="tone tone-blue"></span><span>Combination</span><span>34%</span></div>
                      <div class="story-intel-legend-row" style="--story-intel-item-delay:1.3s"><span class="tone tone-mint"></span><span>Sensitive</span><span>26%</span></div>
                      <div class="story-intel-legend-row" style="--story-intel-item-delay:1.42s"><span class="tone tone-gold"></span><span>Dry</span><span>20%</span></div>
                      <div class="story-intel-legend-row" style="--story-intel-item-delay:1.54s"><span class="tone tone-soft"></span><span>Oily</span><span>20%</span></div>
                    </div>
                  </div>
                  <p class="story-intel-widget-note">Combination and sensitive profiles lead</p>
                </section>

                <section class="story-intel-widget story-intel-widget-products" style="--story-intel-delay:.9s">
                  <div class="story-intel-widget-head">
                    <div>
                      <span class="story-intel-widget-kicker">Most recommended products</span>
                      <h4>Recommendations arriving live</h4>
                    </div>
                    <span class="story-intel-widget-signal"></span>
                  </div>
                  <div class="story-intel-feed">
                    <div class="story-intel-feed-row" style="--story-intel-item-delay:1.08s"><span>Barrier Serum</span><span>Recovery step</span></div>
                    <div class="story-intel-feed-row" style="--story-intel-item-delay:1.22s"><span>Gel Cleanser</span><span>AM routine</span></div>
                    <div class="story-intel-feed-row" style="--story-intel-item-delay:1.36s"><span>Mineral SPF</span><span>Daily finish</span></div>
                    <div class="story-intel-feed-row" style="--story-intel-item-delay:1.5s"><span>Recovery Cream</span><span>Barrier support</span></div>
                    <div class="story-intel-feed-row" style="--story-intel-item-delay:1.64s"><span>Clarifying Mist</span><span>Routine add-on</span></div>
                  </div>
                  <p class="story-intel-widget-note">Frequently included after serum</p>
                </section>

                <section class="story-intel-widget story-intel-widget-routines" style="--story-intel-delay:1.18s">
                  <div class="story-intel-widget-head">
                    <div>
                      <span class="story-intel-widget-kicker">Most recommended routines</span>
                      <h4>Routine size preference</h4>
                    </div>
                    <span class="story-intel-widget-signal"></span>
                  </div>
                  <div class="story-intel-routine-bars">
                    <div class="story-intel-routine-bar" style="--story-intel-fill:.82;--story-intel-item-delay:1.32s"><span>4-step</span><i></i></div>
                    <div class="story-intel-routine-bar" style="--story-intel-fill:.66;--story-intel-item-delay:1.44s"><span>5-step</span><i></i></div>
                    <div class="story-intel-routine-bar" style="--story-intel-fill:.44;--story-intel-item-delay:1.56s"><span>6-step</span><i></i></div>
                    <div class="story-intel-routine-bar" style="--story-intel-fill:.26;--story-intel-item-delay:1.68s"><span>7-step</span><i></i></div>
                  </div>
                  <p class="story-intel-widget-note">Customers prefer shorter routines</p>
                </section>

                <section class="story-intel-widget story-intel-widget-goals" style="--story-intel-delay:1.46s">
                  <div class="story-intel-widget-head">
                    <div>
                      <span class="story-intel-widget-kicker">Top customer goals</span>
                      <h4>Priority ranking</h4>
                    </div>
                    <span class="story-intel-widget-signal"></span>
                  </div>
                  <div class="story-intel-goal-list">
                    <div class="story-intel-goal-row" style="--story-intel-item-delay:1.56s"><span>01</span><strong>Hydration</strong></div>
                    <div class="story-intel-goal-row" style="--story-intel-item-delay:1.66s"><span>02</span><strong>Clear Skin</strong></div>
                    <div class="story-intel-goal-row" style="--story-intel-item-delay:1.76s"><span>03</span><strong>Anti-aging</strong></div>
                    <div class="story-intel-goal-row" style="--story-intel-item-delay:1.86s"><span>04</span><strong>Barrier Repair</strong></div>
                  </div>
                  <p class="story-intel-widget-note">Hydration and clear skin lead</p>
                </section>

                <section class="story-intel-widget story-intel-widget-environments" style="--story-intel-delay:1.7s">
                  <div class="story-intel-widget-head">
                    <div>
                      <span class="story-intel-widget-kicker">Customer environments</span>
                      <h4>Where routines are anchored</h4>
                    </div>
                    <span class="story-intel-widget-signal"></span>
                  </div>
                  <div class="story-intel-environment-stack" style="--story-intel-item-delay:1.82s">
                    <span class="segment urban"></span>
                    <span class="segment suburban"></span>
                    <span class="segment rural"></span>
                  </div>
                  <div class="story-intel-environment-legend">
                    <div class="story-intel-environment-row" style="--story-intel-item-delay:1.92s"><span class="tone urban"></span><span>Urban</span><strong>48%</strong></div>
                    <div class="story-intel-environment-row" style="--story-intel-item-delay:2.02s"><span class="tone suburban"></span><span>Suburban</span><strong>32%</strong></div>
                    <div class="story-intel-environment-row" style="--story-intel-item-delay:2.12s"><span class="tone rural"></span><span>Rural</span><strong>20%</strong></div>
                  </div>
                  <p class="story-intel-widget-note">Urban routines lean lighter and faster</p>
                </section>
              </div>
            </div>
          </article>
        </div>
      </div>

      <div class="story-footer">
        <div class="story-progress">
          <div class="story-progress-top">
            <span class="story-progress-label">Swipe, drag or use the keyboard to move through the story</span>
            <span class="story-progress-text" id="brandStoryProgressText"><span id="brandStoryCurrent">01</span> / <span id="brandStoryTotal">06</span></span>
          </div>
          <div class="story-progress-line" aria-hidden="true">
            <span id="brandStoryProgressFill"></span>
          </div>
        </div>
        <div class="story-dots" role="tablist" aria-label="Why brands choose Skin ID slides">
          <button class="story-dot is-active" type="button" role="tab" aria-selected="true" aria-label="Go to slide 1" tabindex="0"></button>
          <button class="story-dot" type="button" role="tab" aria-selected="false" aria-label="Go to slide 2" tabindex="-1"></button>
          <button class="story-dot" type="button" role="tab" aria-selected="false" aria-label="Go to slide 3" tabindex="-1"></button>
          <button class="story-dot" type="button" role="tab" aria-selected="false" aria-label="Go to slide 4" tabindex="-1"></button>
          <button class="story-dot" type="button" role="tab" aria-selected="false" aria-label="Go to slide 5" tabindex="-1"></button>
          <button class="story-dot" type="button" role="tab" aria-selected="false" aria-label="Go to slide 6" tabindex="-1"></button>
        </div>
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

const landingHtmlMobileDiagnostic = landingHtml;


export default function App() {
  useEffect(() => {
    type RequestedHeroModel = "face" | "routine" | "both" | null;
    type FaceScanModelController = {
      destroy: () => void;
      setHeroVisible: (visible: boolean) => void;
      setSceneVisible: (visible: boolean) => void;
    };
    let introDisposed = false;
    let cleanupLogoIntro: () => void = () => undefined;
    let cleanupFaceScanModel: () => void = () => undefined;
    let cleanupRoutineProductModel: () => void = () => undefined;
    let createFaceScanModelController: (() => FaceScanModelController) | null = null;
    let setupFaceScanModel: (() => () => void) | null = null;
    let setupRoutineProductModel: (() => () => void) | null = null;
    let faceScanController: FaceScanModelController | null = null;
    let faceModuleImportStarted = false;
    let routineModuleImportStarted = false;
    let faceScanModelActive = false;
    let routineProductModelActive = false;
    let heroModelsVisible = false;
    let introFinished = document.body.classList.contains("intro-complete");

    const heroCinema = document.getElementById("cinema");
    const loader = document.getElementById("loader");
    const touchDevice = window.matchMedia("(hover: none), (pointer: coarse)").matches;
    let requestedHeroModel: RequestedHeroModel = touchDevice ? "face" : "both";

    if (touchDevice) {
      document.body.classList.add("mobile-diagnostic");

      if (introFinished) {
        loader?.classList.add("is-hidden");
      } else {
        loader?.classList.remove("is-hidden", "is-exiting", "is-ready", "is-fallback");
      }

      const cleanupHeroSceneTransitions = setupHeroSceneTransitions();
      const cleanupBrandStoryCarousel = setupBrandStoryCarousel();
      const cleanupHeroPlatformToggle = setupHeroPlatformToggle();
      const cleanupHeroValueEngine = setupHeroValueEngine();
      const cleanupDecisionSummaryBoard = setupDecisionSummaryBoard();
      const cleanupLandingInteractions = setupLandingInteractions();
      const syncMobileFaceControllerState = () => {
        if (!faceScanController) {
          return;
        }

        const faceSceneVisible = requestedHeroModel === "face" || requestedHeroModel === "both";
        faceScanController.setHeroVisible(heroModelsVisible && introFinished && !introDisposed);
        faceScanController.setSceneVisible(faceSceneVisible);
      };
      const syncMobileFaceModel = () => {
        if (introDisposed) {
          faceScanController?.setHeroVisible(false);
          return;
        }

        if (!introFinished || !heroModelsVisible) {
          syncMobileFaceControllerState();
          return;
        }

        if (!createFaceScanModelController && !faceModuleImportStarted) {
          faceModuleImportStarted = true;
          void import("./lib/setupFaceScanModel")
            .then((module) => {
              if (introDisposed) {
                return;
              }

              createFaceScanModelController = module.createFaceScanModelController;
              syncMobileFaceModel();
            })
            .catch(() => undefined);
          return;
        }

        if (createFaceScanModelController && !faceScanController) {
          faceScanController = createFaceScanModelController();
          faceScanModelActive = true;
        }

        syncMobileFaceControllerState();
      };
      const introStateObserver = new MutationObserver(() => {
        if (!document.body.classList.contains("intro-complete")) {
          return;
        }

        introFinished = true;
        introStateObserver.disconnect();
        syncMobileFaceModel();
      });
      const heroModelObserver = new IntersectionObserver(
        ([entry]) => {
          heroModelsVisible = entry?.isIntersecting ?? false;
          syncMobileFaceModel();
        },
        { rootMargin: "120px 0px" },
      );
      const onMobileHeroModelScene = (event: Event) => {
        const { sceneIndex } = (event as CustomEvent<HeroModelSceneDetail>).detail;
        requestedHeroModel = sceneIndex === 0 ? "face" : sceneIndex === 3 ? "routine" : null;
        syncMobileFaceModel();
      };

      if (heroCinema) {
        const heroRect = heroCinema.getBoundingClientRect();
        heroModelsVisible = heroRect.bottom >= -120 && heroRect.top <= window.innerHeight + 120;
        heroModelObserver.observe(heroCinema);
        heroCinema.addEventListener(heroModelSceneEvent, onMobileHeroModelScene);
      }

      if (!introFinished) {
        introStateObserver.observe(document.body, {
          attributes: true,
          attributeFilter: ["class"],
        });

        void import("./lib/setupLogoIntro")
          .then(({ setupLogoIntro }) => {
            if (introDisposed) {
              return;
            }

            cleanupLogoIntro = setupLogoIntro();
          })
          .catch(() => {
            introFinished = true;
            document.body.classList.remove("intro-lock");
            document.body.classList.add("intro-complete");
            loader?.classList.add("is-hidden");
            introStateObserver.disconnect();
            syncMobileFaceModel();
          });
      } else {
        syncMobileFaceModel();
      }

      return () => {
        introDisposed = true;
        cleanupLogoIntro();
        introStateObserver.disconnect();
        heroModelObserver.disconnect();
        heroCinema?.removeEventListener(heroModelSceneEvent, onMobileHeroModelScene);
        faceScanController?.destroy();
        faceScanController = null;
        faceScanModelActive = false;
        document.body.classList.remove("mobile-diagnostic");
        cleanupBrandStoryCarousel();
        cleanupHeroPlatformToggle();
        cleanupHeroValueEngine();
        cleanupHeroSceneTransitions();
        cleanupDecisionSummaryBoard();
        cleanupLandingInteractions();
      };
    }

    const syncFaceControllerState = () => {
      if (!faceScanController) {
        return;
      }

      const faceSceneVisible = requestedHeroModel === "face" || requestedHeroModel === "both";
      faceScanController.setHeroVisible(heroModelsVisible && introFinished && !introDisposed);
      faceScanController.setSceneVisible(faceSceneVisible);
    };

    const stopFaceModel = () => {
      if (touchDevice) {
        faceScanController?.destroy();
        faceScanController = null;
        faceScanModelActive = false;
        cleanupFaceScanModel = () => undefined;
        return;
      }

      if (!faceScanModelActive) {
        return;
      }

      cleanupFaceScanModel();
      cleanupFaceScanModel = () => undefined;
      faceScanModelActive = false;
    };

    const stopRoutineModel = () => {
      if (!routineProductModelActive) {
        return;
      }

      cleanupRoutineProductModel();
      cleanupRoutineProductModel = () => undefined;
      routineProductModelActive = false;
    };

    const syncHeroModels = () => {
      if (touchDevice) {
        if (introDisposed || !introFinished) {
          faceScanController?.setHeroVisible(false);
          return;
        }

        if (!createFaceScanModelController && !faceModuleImportStarted) {
          faceModuleImportStarted = true;
          void import("./lib/setupFaceScanModel")
            .then((module) => {
              if (introDisposed) {
                return;
              }

              createFaceScanModelController = module.createFaceScanModelController;
              syncHeroModels();
            })
            .catch(() => undefined);
        }

        if (heroModelsVisible && createFaceScanModelController && !faceScanController) {
          faceScanController = createFaceScanModelController();
          faceScanModelActive = true;
        }

        syncFaceControllerState();
        return;
      }

      if (introDisposed || !introFinished || !heroModelsVisible) {
        stopFaceModel();
        stopRoutineModel();
        return;
      }

      const needsFace = requestedHeroModel === "face" || requestedHeroModel === "both";
      const needsRoutine = requestedHeroModel === "routine" || requestedHeroModel === "both";

      if (!needsFace) {
        stopFaceModel();
      }

      if (!needsRoutine) {
        stopRoutineModel();
      }

      if (needsFace) {
        if (setupFaceScanModel && !faceScanModelActive) {
          cleanupFaceScanModel = setupFaceScanModel();
          faceScanModelActive = true;
        } else if (!setupFaceScanModel && !faceModuleImportStarted) {
          faceModuleImportStarted = true;
          void import("./lib/setupFaceScanModel")
            .then((module) => {
              if (introDisposed) {
                return;
              }

              createFaceScanModelController = module.createFaceScanModelController;
              setupFaceScanModel = module.setupFaceScanModel;
              syncHeroModels();
            })
            .catch(() => undefined);
        }
      }

      if (needsRoutine) {
        if (setupRoutineProductModel && !routineProductModelActive) {
          cleanupRoutineProductModel = setupRoutineProductModel();
          routineProductModelActive = true;
        } else if (!setupRoutineProductModel && !routineModuleImportStarted) {
          routineModuleImportStarted = true;
          void import("./lib/setupRoutineProductModel")
            .then((module) => {
              if (introDisposed) {
                return;
              }

              setupRoutineProductModel = module.setupRoutineProductModel;
              syncHeroModels();
            })
            .catch(() => undefined);
        }
      }
    };

    const stopHeroModels = () => {
      if (touchDevice) {
        faceScanController?.setHeroVisible(false);
        return;
      }

      stopFaceModel();
      stopRoutineModel();
    };

    const onHeroModelScene = (event: Event) => {
      if (!touchDevice) {
        return;
      }

      const { sceneIndex } = (event as CustomEvent<HeroModelSceneDetail>).detail;
      requestedHeroModel = sceneIndex === 0 ? "face" : sceneIndex === 3 ? "routine" : null;
      syncHeroModels();
    };

    heroCinema?.addEventListener(heroModelSceneEvent, onHeroModelScene);
    const cleanupHeroSceneTransitions = setupHeroSceneTransitions();
    const introStateObserver = new MutationObserver(() => {
      if (!document.body.classList.contains("intro-complete")) {
        return;
      }

      introFinished = true;
      introStateObserver.disconnect();
      syncHeroModels();
    });

    if (!introFinished) {
      introStateObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    const heroModelObserver = new IntersectionObserver(
      ([entry]) => {
        heroModelsVisible = entry?.isIntersecting ?? false;

        if (heroModelsVisible) {
          syncHeroModels();
        } else {
          stopHeroModels();
        }
      },
      { rootMargin: "120px 0px" },
    );

    if (heroCinema) {
      const heroRect = heroCinema.getBoundingClientRect();
      heroModelsVisible = heroRect.bottom >= -120 && heroRect.top <= window.innerHeight + 120;
      heroModelObserver.observe(heroCinema);
    }

    void import("./lib/setupLogoIntro")
      .then(({ setupLogoIntro }) => {
        if (introDisposed) {
          return;
        }

        cleanupLogoIntro = setupLogoIntro();
      })
      .catch(() => {
        introFinished = true;
        introStateObserver.disconnect();
        syncHeroModels();
      });

    const cleanupBrandStoryCarousel = setupBrandStoryCarousel();
    const cleanupHeroPlatformToggle = setupHeroPlatformToggle();
    const cleanupHeroValueEngine = setupHeroValueEngine();
    const cleanupDecisionSummaryBoard = setupDecisionSummaryBoard();
    const cleanupLandingInteractions = setupLandingInteractions();

    return () => {
      introDisposed = true;
      heroCinema?.removeEventListener(heroModelSceneEvent, onHeroModelScene);
      introStateObserver.disconnect();
      heroModelObserver.disconnect();
      cleanupLogoIntro();
      if (touchDevice) {
        stopFaceModel();
      } else {
        stopHeroModels();
      }
      cleanupBrandStoryCarousel();
      cleanupHeroPlatformToggle();
      cleanupHeroValueEngine();
      cleanupHeroSceneTransitions();
      cleanupDecisionSummaryBoard();
      cleanupLandingInteractions();
    };
  }, []);

  const touchDevice =
    typeof window !== "undefined" && window.matchMedia("(hover: none), (pointer: coarse)").matches;

  return (
    <div
      dangerouslySetInnerHTML={{
        __html: touchDevice ? landingHtmlMobileDiagnostic : landingHtml,
      }}
    />
  );
}
