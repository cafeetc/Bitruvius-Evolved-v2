# Bitruvius Evolved — Architecture & Evolution Roadmap (`v0.5-alpha`)

> **Updated:** `2026-11-23`  
> **Default Stage Mode:** `Pure Shadow` (`#261D2E` Light / `#EFEAF4` Dark) — 33-piece `Bitruvian.Human.Puppyt` skeleton rendered as a unified silhouette on launch at `18%` (`0.18`) stage zoom. Cycles `Pure Shadow → Bitruvian Purple (#9D79BC) → Hybrid Overlay → Wireframe` (+ `Overlay` toggle).

---

## I. Phase 0 — Master System Invariants & Decisions

- [x] **Initial Blueprint Rules Intake & Master Invariants Audit** *(High Priority — Completed)*  
  Master System Invariants & Rules Manifest ingested (`bp-intake`), reconciled with the 43-joint Option A Puppyt rig, and compiled into 9 automated `INV-*` assertions (`src/data/roadmap.ts`, `src/data/invariants.test.ts`).
- [x] **Decide Rig Topology: 43-Joint Puppyt Rig vs. Extra Joints on 18-Joint Rig** *(High Priority — Option A Adopted)*  
  **Decision Recorded (`dec-rig-topology`):** **Option A adopted** — canonical **43-joint `Bitruvian.Human.Puppyt` topology** (`pelvis` root, dual spine `lumbar` + `thorax`, independent `ribR`/`ribL`, `hipR`/`hipL`, closed-chain shoulder girdle `swivelR/L` + `swivelTipR/L` + `acromionR/L` + `braceR/L` + `wingR/L`, digits, and facial sub-chain). Original 18-joint specs preserved & hidden in `CHILD_PROPORTION_SPECS`.
- [ ] **Define Which Puppyt Procedural Settings to Port** *(Medium Priority)*  
  Name which global sliders (`Global Scale`, `Limb Width`, `Limb Length`) apply to static rig vs. motion-only (`dec-procedural-settings`).
- [ ] **Define the Hip Control** *(Medium Priority)*  
  Specify Puppyt hip swivel vs. tilt vs. lock before Phase 2 two-bone hip port (`dec-hip-setting`).
- [ ] **Confirm Bitruvian Purple Hex** *(Low Priority)*  
  Confirm `#9D79BC` (`SELECTED_PIECE_COLOR` in `src/components/Mannequin.tsx`).

**Indexed System Invariants (`INV-*`):**

| Invariant ID | System Domain | Technical Assertion | Expected Behavioral Contract |
| :--- | :--- | :--- | :--- |
| `INV-STAGE-01` | Stage Layout | `stageWidth === 0.666 * windowWidth` | Stage canvas occupies 66.6% width on left; console occupies 33.3% (`#16001E`) on right. |
| `INV-STAGE-02` | Center Origin | `navelKeystone.center === (canvasWidth / 2, canvasHeight / 2)` | Origin `(0,0)` aligns to optical center of the 2/3 stage container. |
| `INV-ROYAL-01` | UI Protection | `consoleBounds.intersects(mannequinBounds) === false` | Console panels never overlap or obscure mannequin artwork or joint dots. |
| `INV-KIN-01` | Joint Range | `-180.00 <= jointAngle <= 180.00` | Joint angles clamp to `[-180.00°, +180.00°]` at `0.25°` step precision unless continuous spin is toggled ON. |
| `INV-KIN-02` | Shortest Path | `abs(deltaTheta) <= 180.00` | Joint transitions evaluate modulo shortest angular distance (`((Δ+540)%360)-180`). |
| `INV-SEAM-01` | Seam Separation | `seamGapPixels === 0 && socketDistortionPercent === 0` | Local `(dx, dy)` anatomical offsets keep limb artwork seated inside parent housings during 90° bends. |
| `INV-PHYS-01` | Physics Multiplier | `outputDelta === inputDelta * physicsGearRatio` | `Twins (1.0×)`, `Elastic Rubber (1.5×)`, `Damp (0.5×)`, `Rigid (0.0×)`, and `Mode E (0.50×–1.50×)`. |
| `INV-MEM-01` | Snapshot Recall | `transitionDurationMs === 500 && easing === 'ease-in-out'` | Clicking any saved Snapshot card triggers a `0.50s` shortest-path ease-in-out recall. |
| `INV-EXPO-01` | Export Parity | `exportSuite.formats.length === 5 && allFormatsReady === true` | Export Suite generates Pose JSON, SVG Snapshot, Transparent PNG, Adaptive PNG, and Lottie JSON. |

---

## II. Phase 1 & Phase 2 — Completed Baseline

- [x] **2/3 Stage + 1/3 Emperor.Clothes Console Split, Navel Optical Centering & Analog Paper Surface** (`App.tsx`, `StageCanvas.tsx`)
- [x] **33-Piece Purple Skeleton, Rigid Cardboard-Cutout Shoulder Girdle (Zero Stretch), & Peak-Aligned 4-View Head Turntable** (`skeletonRig.ts`, `skeletonAttachment.ts`, `kinematics.ts`)
- [x] **Bitruvian T Pose Launch Procedural Mood Engine & Mode E (`0.50×–1.50×`) Steering Physics** (`kinematics.ts`, `FKControls.tsx`)
- [x] **Bottom Snapshot Shelf (`Snapshot #1`), `0.50s` Ease-in-Out Shortest-Path Recall & Vector Sequence ZIP Importer** (`BottomSnapshotShelf.tsx`, `zipSequenceImporter.ts`)
- [x] **4-Way Inspection View Modes (`Pure Shadow → Bitruvian Purple → Hybrid Overlay → Wireframe`), 90° Seam Audit, 5-Format Export Suite & Scene Planner Grammar** (`Mannequin.tsx`, `seamAudit.ts`, `export.ts`, `scenePlanner.ts`)
- [x] **Refined Skeleton Model Intake (`ribR` Y=865 / pivot `[1257.5, 2155.5]`, `braceR_tendon` Y=818, iliac crests, dual Record/Array API)**
- [x] **Rig Topology Decision Recorded (`dec-rig-topology`: Option A — 43-Joint Puppyt Topology) & Hierarchy Audit (`rig-invariants`)** (`auditRigHierarchy`, `sortJointsTopologically`, unit assertions)

---

## III. Unresolved Verification, Rigging, Assets & Workspace Items

- [ ] *(Phase 1)* **Verify Filter Tint in SVG/PNG Exports** (`ver-export-parity`)
- [ ] *(Phase 1)* **Head Turn Sprite Review at Working Zoom** — color-match `head-side-r.png`, `head-back.png`, `head-side-l.png` to `head-front` (`ver-head-review`)
- [ ] *(Phase 2)* **Two-Bone Ribs/Hips/Girdle (`rig-two-bone-port`)**, **Ribcage Modes & Chungus Origin (`rig-ribcage-modes`)**, **Leg IK Rebuild (`rig-leg-ik`)**, **Hips-to-Ground (`rig-hips-to-ground`)**, **Pin-and-Rotate Piece Template (`rig-pin-piece-template`)**
- [ ] *(Phase 3)* **Pyxl Unit Standard (`asset-pyxl-standard`)**, **Gotz Hand Ladder (`asset-hand`)**, **Marketeer/Piggy Foot (`asset-foot`)**, **Procreate Hierarchies (`asset-hierarchy-fix`)**, **Child Proportions Calibration (`asset-child-proportions`)**
- [ ] *(Phase 5–6)* **Merge Projyct.Bytruvyus Features (`ui-merge-bytruvyus`)**, **AI-Free Production Checklist (`prod-procedural-checklist`)**

---

## IV. Future Visions

- *(Phase 2)* **Hybrid FABRIK, Floor Gravity & Elastic Pin Full** (`vis-fabrik-floor`)
- *(Phase 3)* **Skull 360° Turn & Yorick 2.5D Skull** (`asset-skull-360`)
- *(Phase 4)* **A–B–C Keyframes & Procedural In-Betweening** (`motion-abc`), **Procedure.Bitruvius Gesture Engine** (`motion-gesture-engine`)
- *(Phase 5)* **Dual-Spine Horizon Perspective & Adult/Child Morphing** (`vis-dual-spine-perspective`)
- *(Phase 6)* **Export Pipeline (DragonBones & Studio PNG/SVG)** (`prod-export-pipeline`)
