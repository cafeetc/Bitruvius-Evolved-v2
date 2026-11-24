import { CharacterPoseSnapshot, StudioExportFormat } from '../types';

export interface StudioExportDescriptor {
  format: StudioExportFormat;
  label: string;
  extension: string;
  mimeType: string;
  description: string;
}

export interface StudioExportResult {
  format: StudioExportFormat;
  filename: string;
  mimeType: string;
  data: string | Blob;
  ready: boolean;
}

export const STUDIO_EXPORT_SUITE: StudioExportDescriptor[] = [
  {
    format: 'pose_json',
    label: 'Pose JSON',
    extension: 'json',
    mimeType: 'application/json',
    description: 'Canonical 18-joint CharacterPoseSnapshot schema',
  },
  {
    format: 'svg_snapshot',
    label: 'SVG Vector Snapshot',
    extension: 'svg',
    mimeType: 'image/svg+xml',
    description: 'Scalable silhouette & wireframe vector stage export',
  },
  {
    format: 'transparent_png',
    label: 'Transparent PNG',
    extension: 'png',
    mimeType: 'image/png',
    description: 'Alpha-channel raster cutout of active mannequin pose',
  },
  {
    format: 'adaptive_png',
    label: 'Adaptive Dark/Light PNG',
    extension: 'png',
    mimeType: 'image/png',
    description: 'High-contrast light or #16001E obsidian backdrop PNG',
  },
  {
    format: 'lottie_json',
    label: 'Lottie JSON',
    extension: 'lottie.json',
    mimeType: 'application/json',
    description: 'Keyframe timeline sequence across saved pose snapshots',
  },
];

function sanitizeFilenameSlug(label: string): string {
  const cleaned = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return cleaned || 'bitruvius-pose';
}

/**
 * 1. Pose JSON export handler (Phase 3 ready)
 */
export function exportPoseJson(snapshot: CharacterPoseSnapshot): StudioExportResult {
  const slug = sanitizeFilenameSlug(snapshot.label);
  return {
    format: 'pose_json',
    filename: `${slug}.pose.json`,
    mimeType: 'application/json',
    data: JSON.stringify(snapshot, null, 2),
    ready: true,
  };
}

/**
 * 2. SVG Vector Snapshot stub handler (Phase 3 integration hook)
 */
export function exportSvgSnapshot(
  svgElement: SVGSVGElement | null,
  snapshot: CharacterPoseSnapshot
): StudioExportResult {
  const slug = sanitizeFilenameSlug(snapshot.label);
  const serialized = svgElement
    ? new XMLSerializer().serializeToString(svgElement)
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1363 1800" data-snapshot="${snapshot.snapshotId}"></svg>`;

  return {
    format: 'svg_snapshot',
    filename: `${slug}.svg`,
    mimeType: 'image/svg+xml',
    data: serialized,
    ready: Boolean(svgElement),
  };
}

/**
 * 3. Transparent PNG stub handler (Phase 3 rasterization hook)
 */
export async function exportTransparentPng(
  svgElement: SVGSVGElement | null,
  snapshot: CharacterPoseSnapshot
): Promise<StudioExportResult> {
  const slug = sanitizeFilenameSlug(snapshot.label);
  const svgMarkup = exportSvgSnapshot(svgElement, snapshot).data;
  const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  return {
    format: 'transparent_png',
    filename: `${slug}-transparent.png`,
    mimeType: 'image/png',
    data: blob,
    ready: false,
  };
}

/**
 * 4. Adaptive Dark/Light Mode PNG stub handler (Phase 3 theme-aware raster hook)
 */
export async function exportAdaptivePng(
  svgElement: SVGSVGElement | null,
  snapshot: CharacterPoseSnapshot,
  theme: 'light' | 'dark' = 'light'
): Promise<StudioExportResult> {
  const slug = sanitizeFilenameSlug(snapshot.label);
  const svgMarkup = exportSvgSnapshot(svgElement, snapshot).data;
  const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  return {
    format: 'adaptive_png',
    filename: `${slug}-${theme}.png`,
    mimeType: 'image/png',
    data: blob,
    ready: false,
  };
}

/**
 * 5. Lottie JSON stub handler (Phase 3 keyframe exporter hook)
 */
export function exportLottieJson(
  snapshots: CharacterPoseSnapshot[],
  fps = 12
): StudioExportResult {
  const payload = {
    v: '5.9.0',
    fr: fps,
    ip: 0,
    op: Math.max(1, snapshots.length) * fps,
    w: 1363,
    h: 1800,
    nm: 'Bitruvius-Pose-Sequence',
    ddd: 0,
    assets: [],
    layers: [],
    meta: {
      generator: 'Bitruvius-Evolved Phase3 Export Stub',
      snapshotCount: snapshots.length,
    },
  };

  return {
    format: 'lottie_json',
    filename: 'bitruvius-sequence.lottie.json',
    mimeType: 'application/json',
    data: JSON.stringify(payload, null, 2),
    ready: snapshots.length > 0,
  };
}

export async function runStudioExportStub(
  format: StudioExportFormat,
  context: {
    snapshot: CharacterPoseSnapshot;
    snapshots?: CharacterPoseSnapshot[];
    svgElement?: SVGSVGElement | null;
    theme?: 'light' | 'dark';
    fps?: number;
  }
): Promise<StudioExportResult> {
  switch (format) {
    case 'pose_json':
      return exportPoseJson(context.snapshot);
    case 'svg_snapshot':
      return exportSvgSnapshot(context.svgElement ?? null, context.snapshot);
    case 'transparent_png':
      return exportTransparentPng(context.svgElement ?? null, context.snapshot);
    case 'adaptive_png':
      return exportAdaptivePng(
        context.svgElement ?? null,
        context.snapshot,
        context.theme ?? 'light'
      );
    case 'lottie_json':
      return exportLottieJson(context.snapshots ?? [context.snapshot], context.fps ?? 12);
  }
}
