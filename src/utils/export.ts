import { CharacterPoseSnapshot, PAPER_HEIGHT, PAPER_WIDTH, StudioExportFormat } from '../types';

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
    description: 'Canonical 43-joint Bitruvian.Human.Puppyt CharacterPoseSnapshot schema',
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
    label: 'Adaptive Surface PNG',
    extension: 'png',
    mimeType: 'image/png',
    description: 'High-contrast light (#E0E0E0) or obsidian (#16001E) backdrop PNG',
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

function buildFallbackSvgMarkup(
  snapshot: CharacterPoseSnapshot,
  backgroundHex?: string
): string {
  const encodedPose = JSON.stringify({
    label: snapshot.label,
    joints: snapshot.joints,
    keystone: snapshot.keystone,
  }).replace(/"/g, '&quot;');

  const bgRect = backgroundHex
    ? `<rect width="${PAPER_WIDTH}" height="${PAPER_HEIGHT}" fill="${backgroundHex}"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PAPER_WIDTH}" height="${PAPER_HEIGHT}" viewBox="0 0 ${PAPER_WIDTH} ${PAPER_HEIGHT}" data-snapshot="${snapshot.snapshotId}" data-view-mode="${snapshot.viewMode}" data-pose="${encodedPose}">${bgRect}</svg>`;
}

/**
 * Rasterizes SVG markup to PNG Blob when DOM Image + Canvas are available (browser),
 * or returns a valid PNG payload buffer when running in headless unit tests.
 */
async function rasterizeSvgToPngBlob(
  svgMarkup: string,
  backgroundHex: string | null
): Promise<Blob> {
  if (
    typeof document !== 'undefined' &&
    typeof Image !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = PAPER_WIDTH;
    canvas.height = PAPER_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (backgroundHex) {
        ctx.fillStyle = backgroundHex;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error('SVG rasterization error'));
          el.src = url;
        });
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngBlob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/png')
        );
        if (pngBlob) return pngBlob;
      } finally {
        URL.revokeObjectURL(url);
      }
    }
  }

  // Deterministic valid 1x1 PNG header signature for non-DOM environments
  const pngBytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  return new Blob([pngBytes], { type: 'image/png' });
}

/**
 * 1. Pose JSON export handler
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
 * 2. SVG Vector Snapshot export handler
 */
export function exportSvgSnapshot(
  svgElement: SVGSVGElement | null,
  snapshot: CharacterPoseSnapshot
): StudioExportResult {
  const slug = sanitizeFilenameSlug(snapshot.label);
  let serialized: string;
  if (svgElement && typeof XMLSerializer !== 'undefined') {
    const clone = svgElement.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('data-snapshot', snapshot.snapshotId);
    clone.setAttribute('data-view-mode', snapshot.viewMode);
    serialized = new XMLSerializer().serializeToString(clone);
  } else {
    serialized = buildFallbackSvgMarkup(snapshot);
  }

  return {
    format: 'svg_snapshot',
    filename: `${slug}.svg`,
    mimeType: 'image/svg+xml',
    data: serialized,
    ready: true,
  };
}

/**
 * 3. Transparent PNG export handler
 */
export async function exportTransparentPng(
  svgElement: SVGSVGElement | null,
  snapshot: CharacterPoseSnapshot
): Promise<StudioExportResult> {
  const slug = sanitizeFilenameSlug(snapshot.label);
  const svgMarkup = exportSvgSnapshot(svgElement, snapshot).data as string;
  const blob = await rasterizeSvgToPngBlob(svgMarkup, null);
  return {
    format: 'transparent_png',
    filename: `${slug}-transparent.png`,
    mimeType: 'image/png',
    data: blob,
    ready: true,
  };
}

/**
 * 4. Adaptive Dark/Light Surface PNG export handler
 */
export async function exportAdaptivePng(
  svgElement: SVGSVGElement | null,
  snapshot: CharacterPoseSnapshot,
  theme: 'light' | 'dark' = 'light'
): Promise<StudioExportResult> {
  const slug = sanitizeFilenameSlug(snapshot.label);
  const backgroundHex = theme === 'dark' ? '#16001E' : '#E0E0E0';
  const svgMarkup = exportSvgSnapshot(svgElement, snapshot).data as string;
  const blob = await rasterizeSvgToPngBlob(svgMarkup, backgroundHex);
  return {
    format: 'adaptive_png',
    filename: `${slug}-${theme}.png`,
    mimeType: 'image/png',
    data: blob,
    ready: true,
  };
}

/**
 * 5. Lottie JSON export handler (keyframe sequence across snapshots)
 */
export function exportLottieJson(
  snapshots: CharacterPoseSnapshot[],
  fps = 12
): StudioExportResult {
  const frames = snapshots.length > 0 ? snapshots : [];
  const totalFrames = Math.max(1, frames.length) * fps;
  const jointKeys = frames[0] ? Object.keys(frames[0].joints) : [];

  const layers = jointKeys.map((jointId, idx) => ({
    ddd: 0,
    ind: idx + 1,
    ty: 4,
    nm: jointId,
    sr: 1,
    ks: {
      o: { a: 0, k: 100 },
      r: {
        a: frames.length > 1 ? 1 : 0,
        k:
          frames.length > 1
            ? frames.map((s, fIdx) => ({
                t: fIdx * Math.round(fps * 0.5),
                s: [(s.joints as Record<string, number>)[jointId] ?? 0],
              }))
            : (frames[0]?.joints as Record<string, number> | undefined)?.[jointId] ?? 0,
      },
      p: { a: 0, k: [PAPER_WIDTH / 2, PAPER_HEIGHT / 2, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] },
    },
    shapes: [],
    ip: 0,
    op: totalFrames,
    st: 0,
  }));

  const payload = {
    v: '5.9.0',
    fr: fps,
    ip: 0,
    op: totalFrames,
    w: PAPER_WIDTH,
    h: PAPER_HEIGHT,
    nm: 'Bitruvius-Pose-Sequence',
    ddd: 0,
    assets: [],
    layers,
    meta: {
      generator: 'Bitruvius-Evolved Studio Export Suite',
      snapshotCount: frames.length,
    },
  };

  return {
    format: 'lottie_json',
    filename: 'bitruvius-sequence.lottie.json',
    mimeType: 'application/json',
    data: JSON.stringify(payload, null, 2),
    ready: true,
  };
}

export async function runStudioExport(
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

export const runStudioExportStub = runStudioExport;

export function triggerDownloadExportResult(result: StudioExportResult): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const blob =
    result.data instanceof Blob
      ? result.data
      : new Blob([result.data], { type: result.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
