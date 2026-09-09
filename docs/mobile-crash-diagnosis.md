# Nabi mobile reload investigation — 8 September 2026

**Status: the reported iPhone crash was not reproduced. Its root cause remains unconfirmed. No application fix or visual/performance change was applied.**

Investigated commit: `6a94aeb30162eccf744d46441408ae4cb69b59ec`. The public production JS (`index-CTi69SBj.js`) and CSS (`index-CdtBNB1R.css`) from https://www.na-bi.com/ were byte-for-byte identical to this workspace's production build. Hashes, measurements, and diagnostic events are in [mobile-crash-evidence.json](mobile-crash-evidence.json).

## Required findings

| # | Question | Finding |
|---|---|---|
| 1 | Reproduced? | **No browser crash or unexpected reload** in the completed test run. A conditional calendar listener-retention defect was reproduced separately. |
| 2 | Device/browser | Windows, headless Chrome **152.0.7977.82**, **402 × 874 CSS px**, **DPR 3**, touch/coarse-pointer emulation, default motion settings. WebGL 2 via ANGLE/NVIDIA RTX 3050/D3D11. Not iOS Safari, an iOS simulator, or physical Android Chrome. User reports iPhone 17 Pro, iOS described as “before 26.6.2”; exact OS version is unverified. |
| 3 | Exact crash moment | None observed during the flows below, including “Perfect. Let's find a time that works.”, calendar creation, timezone changes, or idle animation. |
| 4 | Reload versus navigation | One initial document navigation; no subsequent reload, crash event, or full-page navigation. Back/Forward replaces conversation DOM. No `location.reload`, location assignment, History API navigation, or `href="#"` in the active app. All four generated form submit handlers call `preventDefault()`. Section anchors scroll; external demo links open a new tab. This does not classify the user's unrecorded incident. |
| 5 | Maximum WebGL contexts | **Two simultaneously live/non-lost contexts in normal mobile execution and in measurements; three created over the initial load.** Intro + launcher, then face + launcher. There is a startup-exception caveat below: an orphaned partially initialized intro could make three live contexts possible. |
| 6 | Every mobile renderer | Intro, floating logo, and face. Lifecycle table below. The four product renderer call sites are unreachable from the current mobile branch. |
| 7 | Renderer/RAF/resource leak | No accumulating renderer or duplicate ongoing RAF loop in the exercised flows. One launcher RAF remains offscreen; face rendering pauses while its resources remain allocated. Startup/late-load cleanup gaps are documented below; they were not tied to a crash. |
| 8 | Context loss | Exactly one context-loss event in the primary run, **after the intro deliberately invoked `forceContextLoss()`**. No unexpected loss and no restoration event. |
| 9 | JS errors | Zero global JS errors, unhandled rejections, or CDP uncaught exception events in the completed normal-flow run. The timezone selection handler does lack rejection handling by inspection; a failed timezone request was not part of that run. |
| 10 | Timers/listeners/observers | Normal touch flows returned to the same global listener and active observer counts. **Confirmed conditional retention:** open timezone picker → focus popup Back → press Enter. Two document listeners and 453 listener registrations on detached nodes remained until the next outside pointer interaction. |
| 11 | Auto-scroll | No feedback loop. Twenty draft goal toggles caused **zero** scroll calls. Twenty Q&A history navigations caused **20**. Three Q&A answers caused 12 calls across staged message/typing/control reveals, so it is **not literally one scroll per whole answer**. No scrolling during the three-minute idle period. |
| 12 | Scheduler duplicates | One scheduler at a time in all tested popup flows. Twenty month switches caused 20 replacements, zero extra availability requests. Two requests total for the two tested timezones; ten scheduler Back/reopen cycles used the cache. Full timezone labels are recomputed on each rebuild: **8,440 formatter constructions for 20 month switches**. |
| 13 | Popup resource growth | Twenty open/close cycles: DOM stayed at 1,422 elements, two live contexts, one offscreen launcher RAF, same global listeners/observers. Post-GC heap after 10/20 cycles: **40.809/40.812 MB**. Closing preserves the conversation intentionally; it does not unmount its calendar. |
| 14 | Root cause | **Unconfirmed.** Largest measured resource suspect: retained 26.2 MB mobile face geometry. Largest demonstrated calendar allocation burst: all-timezone formatting and picker DOM. Conditional calendar listener retention is a separate confirmed defect, not evidence that it caused the phone reload. |
| 15 | Minimal fix | **None applied**, because no change has been shown to address the reported crash. |
| 16 | Files changed | Added only `docs/mobile-crash-diagnosis.md` and `docs/mobile-crash-evidence.json`. No changes to `src/`, `public/`, package files, backend, or configuration. Ignored diagnostic scratch files are listed below. |
| 17 | Temporary diagnostics removed | Instrumentation was injected into an isolated browser, never imported by the app. The test browser and dev server were stopped at completion, removing runtime hooks, event listeners, request interception, and diagnostic timers. Local scratch scripts/evidence remain under ignored `.tmp/`; no diagnostic logging ships. |
| 18 | Visual downgrade | None. DPR, animations, logo GLB, 3D launcher, assets, styling, copy, composers, booking and timezone rules are unchanged. |
| 19 | Regression results | A–H below passed in mobile Chrome emulation. There is no “after fix” result because no fix was applied, and no physical iPhone regression result. |
| 20 | Build | `npm run build` **passed** (`tsc -b && vite build`, Vite 8.0.16). Existing warning: chunks over 500 kB. Application sources remained unchanged afterward. |

## Renderer and setup audit

| Renderer / DOM owner | Creation and lifetime | Resource and RAF handling |
|---|---|---|
| Intro: `#loaderLogoCanvas` inside `#loader` | `src/lib/setupLogoIntro.ts:176`; imported once by the mobile effect at `src/App.tsx:7914`. Exists during initial intro. Completes before face initialization; body mutation observers run after synchronous intro release. | Loads `/nabi-logo-3d.glb`; its own scene/model and PMREM environment. Cancels RAF, disposes geometry/materials/textures, environment target, PMREM, render lists and renderer; forces context loss, shrinks and replaces canvas. Removes resize/visibility listeners on exit; unmount clears both timeouts. Measured expected loss follows release. |
| Launcher: `.nabi-floating-logo-canvas` in `.nabi-floating-launcher` | `src/lib/setupLogoIntro.ts:375`, called once from `setupNabiFloatingLauncher()` at `src/App.tsx:3595`. Exists for the app lifetime. Popup open/close only changes attributes, focus, and shake timers. | Separate parse of the same 226,436-byte GLB; not a shared Three model with intro. Reused across popup cycles. Mobile DPR cap 2; measured drawing buffer 150 × 150 in the primary run. RAF stops on document hidden; cleanup cancels RAF and disposes model, environment, renderer and context. Continues rendering while popup is open. No popup-driven reinitialization. |
| Face: `#faceModelCanvas` inside `.scene-scan .face-visual` | `src/lib/setupFaceScanModel.ts:87`; `src/App.tsx:7856–7877` waits for intro completion and hero proximity, guards import and controller creation. One controller retained for the mobile app lifetime. | Fetches `/face-mobile.glb` once per controller with an AbortController, then parses once. Hero/scene/viewport/document visibility gates its single RAF. Offscreen canvas and model remain allocated. Destroy aborts loading, stops RAF, disconnects intersection/resize observers, removes listeners, disposes model/environment/renderer, loses context, shrinks/replaces canvas. |

The early `if (touchDevice)` branch returns its cleanup at `src/App.tsx:7934`; it never reaches the desktop product setup. The routine module contains four potential product controllers (cleanser, serum, moisturizer, SPF), including old mobile entry points, but the active mobile branch never imports/calls them. Hero and final canvases use `getContext("2d")`, not WebGL. Unused components/hooks are not mounted by `App` and do not introduce extra renderers or Lenis loops.

**Exceptional startup caveat:** renderer constructors are followed by PMREM/environment initialization before cleanup is returned. If intro setup throws after obtaining a context, the outer catch marks the intro complete without receiving a cleanup function. Face + launcher + an orphaned intro context are then possible. This path was not observed or fault-injected; the normal two-context count must not be read as a guarantee under partial initialization failure.

Other setup paths were traced to their cleanup: story contrast/flow slide handlers and timeouts; carousel metric/scroll RAFs, two resize observers, visibility observer and media listener; platform menu document listeners; impact sequence timers; mobile navigation scroll listener; hero value/scene observers and visibility listeners; decision-board mutation/intersection observers, RAF and pulse timers; landing interaction, final-canvas, reveal/cloud and section animation handlers. They are installed at app setup, not popup open. No application `setInterval` is present.

React has one `useEffect(..., [])` and no `useState` in `App.tsx`. Conversation updates mutate DOM and closure state. There is no effect/state/render feedback loop. StrictMode's development setup/cleanup replay did not multiply renderers: disposed flags suppress obsolete dynamic-import continuations. Initial diagnostic popup-close counts include setup replay, not user interactions.

Auto-scroll clears previous pending frames, schedules exactly two RAF callbacks, checks `flowVersion` and `target.isConnected`, then performs one `thread.scrollTo`. It has no scroll-event subscriber that feeds back into conversation state. Staged typing, answer and controls cause separate legitimate scrolls; draft changes do not invoke it.

## Cleanup gaps and allocation suspects

1. **Confirmed calendar retention on keyboard Back.** `buildScheduler()` attaches document `pointerdown` and `keydown` listeners when the timezone picker opens (`src/App.tsx:2350`). Removal only occurs in `closeTimezonePicker()` (`:2316`). Removing the scheduler through Back/reset has no explicit picker disposer. Enter activation bypasses the outside-pointer handler: measured document pointer listeners **1 → 2**, key listeners **2 → 3**, and **453** registrations on detached nodes. A subsequent normal outside tap released them; reset restored detached registrations to zero. Normal touch Back closes the picker before removing the scheduler. No reload occurred in this reproduction. A future fix should connect picker cleanup to scheduler removal; it is not presented as the phone-crash fix.
2. **Timezone allocation churn.** `src/App.tsx:2250` calls `getTimezoneOptions()` for every calendar construction; `src/schedulingService.ts:143–188` formats every supported timezone. Twenty month changes constructed 8,440 formatters, about 298 ms total formatter-construction time on this Windows machine. This excludes other render work and is not an iPhone timing. Opening the picker increased DOM elements **1,570 → 2,827**; closing/changing timezone returned to **1,570**. No persistent DOM increase was observed. Timezone logic was not modified.
3. **Mobile face allocation.** GLB JSON inspection found **26,168,288 file bytes**, a **26,166,864-byte binary buffer**, **1,006,410 vertices** and **1,509,666 indices / 503,222 triangles**, with no embedded images. By comparison, the launcher has 5,357 vertices, 8,920 triangles and a 226,436-byte GLB. These are asset sizes, not estimates of total GPU/process memory. The face remains resident after scrolling away. This supports measuring its load/retention on iPhone, not removing it without a causal trace.
4. **Late async cleanup / failure paths.** Logo loading has no abort; its success continuation returns when destroyed without disposing resources populated after release. Disposed resource Sets also retain CPU objects until their owning closure is collected. Face late-parse cleanup disposes geometry/materials but lacks generic texture cleanup on that branch; the current mobile GLB has no images. Timezone selection awaits availability without `try/catch` or a flow-version guard. These are inspection findings, not reproduced reload causes.
5. **Bounded work versus retained work.** The 420 ms “maximum goals” timeout is not registered in `activeTimers`; rapid invalid taps can temporarily queue callbacks holding old controls, but each expires and does not recurse. Reveal timers retain numeric IDs until the next flow reset, not live callbacks after firing. The availability cache is keyed by date range/timezone and has no eviction or in-flight deduplication. These deserve separate failure/long-session tests if the iPhone trace points there.

The section and floating assistant have separate question-experience instances. Entering the popup scheduler does not initialize the section scheduler. If a user independently completes both experiences, both calendars can remain mounted; there is no shared single-calendar guard. No accidental simultaneous calendar initialization occurred in the tested popup paths.

## Reproduction coverage and memory evidence

The primary run used real CDP touch input and text entry against `http://127.0.0.1:5178/`, with the mobile branch active throughout. It ran for approximately **279 seconds**, including three minutes of idle animation.

| Flow | Completed coverage |
|---|---|
| A | Initial load, 12 page-scroll steps, popup open/close/reopen |
| B | Ask Nabi → L1 → L2 → L3 → all eight qualification answers → scheduler |
| C | Reset → Book a meeting → all eight answers → scheduler |
| D | 20 popup open/close cycles |
| E | 10 Q&A Back/Forward pairs |
| F | 20 goal select/deselect taps; no scroll-call increase |
| G | 20 month switches, timezone picker/search/change to Tokyo, 10 scheduler Back/reopen cycles |
| H | Three minutes at the top of the page with animations running and popup closed |

Backend calls were intercepted in the isolated browser. Lead responses were synthetic; availability was a fixture of 30 dates × 12 slots. No real lead, Google meeting, email, or other backend write was made. Thus this verifies client lifecycle/render behavior, **not live availability payload size, latency, backend failure behavior, or end-to-end booking correctness**. No booking confirmation was submitted. A preliminary fixture preflight-header error exercised the lead-failure UI without a reload; it was corrected in the harness. A preliminary session whose emulation reset on detach was excluded from the primary measurements.

| Checkpoint | Heap after GC (decimal MB) | DOM elements | Live calendars |
|---|---:|---:|---:|
| Initial settled load | 40.574 | 1,422 | 0 |
| After page scrolling | 40.760 | 1,422 | 0 |
| Popup 10 / 20 cycles | 40.809 / 40.812 | 1,422 | 0 |
| First scheduler | 41.161 | 1,570 | 1 |
| After 20 month switches | 41.510 | 1,570 | 1 |
| After 10 scheduler reopen cycles | 42.041 | 1,570 | 1 |
| Idle minute 1 / 2 / 3 | 42.457 / 42.458 / 42.185 | 1,566 | 1 |
| After follow-up conversation reset | 42.363 | 1,422 | 0 |

The modest heap increase includes probe metadata, console strings, cached availability and warmed runtime code. It cannot be assigned to an application leak from these numbers alone. Idle measurements plateaued; reset restored DOM/listener counts. This is **JavaScript heap**, not GPU allocation, native Intl allocation, image/layer memory, or iOS process memory. The separate keyboard/reset follow-up reattached CDP; its viewport settings were reapplied but launcher buffer resized, so those samples are used for DOM/listener cleanup only.

Instrumentation used WeakRefs for inspected objects and a 600-event ring buffer; it nevertheless adds allocation and timing overhead. Active callback tracking was direct; RAF start/stop messages were sampled once per second. Observer/listener totals include diagnostics and Vite/React, so deltas are the evidence. Context-loss listeners did not call `preventDefault`; global error listeners did not swallow errors. Logs contain labels, counts and stacks, not form contents or backend payloads.

## Evidence needed to identify the iPhone cause

Record the exact iOS version/build and the last action on the reported iPhone 17 Pro. Reproduce A–H while remotely inspecting Safari from a Mac, preserving console/network output and recording Memory plus JavaScript Allocations. Correlate the incident time with any WebContent/GPU crash or memory-pressure/termination report available from the device. A fresh document/network load establishes reload; a termination report distinguishes it from application navigation and plain JS failure.

Prioritize the face model's initial load, opening the timezone list, calendar rebuilds, and the moment the phone keyboard appears/disappears. Compare total page memory, graphics layers and native allocations with JS heap. WebKit's [Memory Debugging with Web Inspector](https://webkit.org/blog/6425/memory-debugging-with-web-inspector/) explains this separation and why stable JS heap alone does not exclude memory-driven termination. No specific WebKit defect or OS memory limit is asserted here.

Only after a trace identifies the failing resource/path should a targeted change be selected and A–H repeated on that same phone. Physical iPhone access and its incident trace are the remaining evidence gap.

Local, ignored scratch artifacts: `.tmp/nabi-probe.js`, `.tmp/nabi-cdp.mjs`, `.tmp/nabi-flows.mjs`, `.tmp/nabi-after.mjs`, helper scripts (`nabi-inspect`, `nabi-scheduler`, `nabi-compare`, `nabi-export`), `nabi-*.json` samples and `nabi-mobile.png`. They are outside Vite's app/public entry points. Only the two report/evidence files above are added to the reviewable repository changes.
