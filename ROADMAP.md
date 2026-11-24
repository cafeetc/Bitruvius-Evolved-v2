# Bitruvius Evolved — Architecture & Evolution Roadmap

> **Status:** Up to date with current skeleton-puppet baseline. Ready to ingest and reconcile **Initial Blueprint Rules**.  
> **Default Stage Mode:** `Pure Shadow` — 33-piece `Bitruvian.Human.Puppyt` skeleton rendered as a unified **dark purple-gray (`#261D2E`)** silhouette on launch.

---

## I. Initial Blueprint Rules (Intake & Reconciliation)

Awaiting user's initial blueprint ruleset to audit against the active rig, kinematics, stage geometry, and roadmap. Once provided, rules will be indexed here as binding architectural invariants and cross-checked against all unresolved items.

**Current Active Invariants Observed in Codebase:**
1. **Default Silhouette Launch**: App opens in `Pure Shadow` mode displaying the dark purple-gray (`#261D2E`) skeleton silhouette before any animation or pose overrides are applied (`App.tsx`, `Mannequin.tsx`, `Bone.tsx`).
2. **Adult Puppyt Proportions (`0.14` Scale)**: `JOINT_SPECS` runs isotropic `PUPPYT_TO_EVOLVED_SCALE = 0.14` proportions matching `Bitruvian.Human.Puppyt` adult anatomy (~1:1 Vitruvian armspan-to-height ratio).
3. **Preserved Hidden Child Proportions**: Original Evolved rig dimensions are preserved verbatim as `CHILD_PROPORTION_SPECS` in `src/utils/kinematics.ts` and remain hidden from the UI until refined.
4. **Pure Canvas & Non-Intrusive Studio Shell**: Zero mock/telemetry clutter; Evolved UI, 4 pose presets (`T-Pose`, `Vitruvian`, `Contrapposto`, `Striding`), FK/IK/PIN modes, and Physics multipliers remain intact.

---

## II. Completed & Integrated Baseline

- [x] **Base Application Port (`Bitruvius-Evolved`)**: Full 18-joint kinematic engine, `PYXL`/`MPYX` endless archival drafting canvas, `TopConsoleBar`, `InspectorConsole`, Pose/Physics/Rig/Stage tabs, and keyboard micro-nudging (`±0.25°` / `±1.00°`).
- [x] **33-Piece Purple Skeleton Extraction (`Bitruvian.Human.Puppyt`)**: All unique post-antiPhallic skeleton PNG assets extracted into `/public/assets/skeleton/` with exact per-piece rest pivots (`PUPPYT_SKELETON_PIECES` & `PUPPYT_LANDMARKS`).
- [x] **Dark Purple-Gray Default Silhouette (`#261D2E`)**: Composite SVG `feFlood` + `feComposite` filter fuses all 33 skeleton pieces into a unified flat dark purple-gray silhouette in default `Pure Shadow` mode, revealing the full-color skeleton + emerald digital model in `Wireframe` mode.
- [x] **Underlying Digital Kinematic Model**: Renders skull triangle (`templeR`, `templeL`, `chinTip`), costal rib guides, pelvic bar, closed-chain shoulder girdle (`Backshoulder < Shoulderswivel < Ribcage`), and neck-to-acromion tendon strain detection (`> 1.12` / `< 0.78`).
- [x] **Adult Puppyt Calibration & Preserved Child Spec**: All limb/spine/pelvis/cranium lengths aligned isotropically at `0.14`, verified by `node:test` unit tests (`<= 0.5px` pelvis socket accuracy) and headless Chromium verification.
- [x] **Live Roadmap Document & Top-Bar Navigation**: Added `ROADMAP.md`, typed roadmap model, and the `Roadmap` workspace tab directly beside `BITRUVIUS EVOLVED`.

---

## III. Currently Unresolved Items

1. **Initial Blueprint Rules Audit** *(Priority: High — Blocked on Intake)*  
   Ingest user's initial blueprint rules, reconcile conflicts with existing Evolved/Puppyt mechanics, and lock canonical constraints.
2. **Child Proportions Refinement (`CHILD_PROPORTION_SPECS`)** *(Priority: Medium — Hidden in Code)*  
   Calibrate bone piece aspect ratios, skull-to-body ratio, and pelvis socket geometry for child proportions before exposing a hidden/unlockable proportion switcher in the Rig console.
3. **Initial Intertitle Framing Below Taller Adult Stance** *(Priority: Low — Visual Polish)*  
   Because `0.14` adult legs extend lower (`~629px` below waist), `"Welcome Bitruvius"` in `below-model` placement sits near the bottom border edge on initial launch; adjust `fitPaperToStage` or intertitle offset once blueprint rules confirm framing rules.
4. **Pure-Shadow Silhouette Export Parity** *(Priority: Low — Verification)*  
   Verify `svg_snapshot`, `transparent_png`, and `adaptive_png` export helpers preserve the `#261D2E` SVG filter tint across all browsers without falling back to full color.

---

## IV. Future Visions

1. **360° Skull Turn (`headStep` / `skullView`)**  
   Integrate Puppyt's multi-angle skull sprites and synchronized jaw lock (`lip = 0°`) so head turns blend across profile/3-4/front views cleanly inside Evolved's neck/head controls.
2. **On-Canvas Modular Sub-Rigs (Gotz Hand & Piggy Foot)**  
   Add non-blocking split canvas sub-rig editors on double-clicking wrists or ankles for detailed finger and toe posing synchronized back to the main armature.
3. **A–B–C Keyframes & Procedural In-Betweening**  
   Expand Evolved's `Pose Snapshots` into an A–B–C keyframe cadence engine featuring stepped FPS, `Flow`/`Snap`/`Elastic`/`Mechanical`/`Clockwork` easing, onion-skin ghosts, and Muybridge breakdown synthesis.
4. **Hybrid FABRIK / Floor Gravity & Elastic Pin Full (`elasticPinFull`)**  
   Upgrade limb IK drag with multi-joint FABRIK fallback, ground-plane collision clamping, and elastic full-rig floor/air anchors with live dashed pull tethers.
5. **Dual-Spine 1-Point Horizon Perspective & Proportion Morphing**  
   Optional subtle lumbar/thorax perspective lean relative to vanishing point alongside smooth morphing between calibrated Adult (`0.14`) and Child (`CHILD_PROPORTION_SPECS`) anatomical presets.
