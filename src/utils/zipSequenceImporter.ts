import {
  ArmatureState,
  CharacterPoseSnapshot,
  JointId,
  SilhouetteDisplayMode,
} from '../types';
import {
  JOINT_SPECS,
  applyJointAngleConstraint,
  armatureToCharacterSnapshot,
  characterSnapshotToArmature,
  createPosePreset,
} from './kinematics';

export interface ImportedKeyframeFrame {
  frameIndex: number;
  label: string;
  durationMs: number;
  sourceFile: string;
  snapshot: CharacterPoseSnapshot;
}

export interface ImportedVectorSequence {
  sequenceId: string;
  name: string;
  fps: number;
  frames: ImportedKeyframeFrame[];
  svgFileCount: number;
  jsonFileCount: number;
}

interface RawZipEntry {
  filename: string;
  compressionMethod: number;
  compressedBytes: Uint8Array;
  uncompressedSize: number;
}

function readUint16LE(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8);
}

function readUint32LE(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset] |
      (buf[offset + 1] << 8) |
      (buf[offset + 2] << 16) |
      (buf[offset + 3] << 24)) >>>
    0
  );
}

async function inflateRawBytes(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Deflate decompression is not supported in this runtime.');
  }
  const copy = new Uint8Array(compressed.byteLength);
  copy.set(compressed);
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  await writer.write(copy);
  await writer.close();
  const outBuf = await new Response(ds.readable).arrayBuffer();
  return new Uint8Array(outBuf);
}

/**
 * Extracts entries from a ZIP archive supporting Store (method 0) and Deflate (method 8).
 */
export async function parseZipArchiveEntries(
  buffer: ArrayBuffer | Uint8Array
): Promise<Map<string, Uint8Array>> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const rawEntries: RawZipEntry[] = [];

  // Locate End of Central Directory (PK\x05\x06) for accurate sizes when data descriptors are present
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06
    ) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset !== -1) {
    const cdCount = readUint16LE(bytes, eocdOffset + 10);
    let cdPtr = readUint32LE(bytes, eocdOffset + 16);
    for (let idx = 0; idx < cdCount && cdPtr + 46 <= bytes.length; idx++) {
      if (
        bytes[cdPtr] !== 0x50 ||
        bytes[cdPtr + 1] !== 0x4b ||
        bytes[cdPtr + 2] !== 0x01 ||
        bytes[cdPtr + 3] !== 0x02
      ) {
        break;
      }
      const compressionMethod = readUint16LE(bytes, cdPtr + 10);
      const compressedSize = readUint32LE(bytes, cdPtr + 20);
      const uncompressedSize = readUint32LE(bytes, cdPtr + 24);
      const nameLen = readUint16LE(bytes, cdPtr + 28);
      const extraLen = readUint16LE(bytes, cdPtr + 30);
      const commentLen = readUint16LE(bytes, cdPtr + 32);
      const localHeaderOffset = readUint32LE(bytes, cdPtr + 42);
      const filename = new TextDecoder().decode(
        bytes.subarray(cdPtr + 46, cdPtr + 46 + nameLen)
      );
      cdPtr += 46 + nameLen + extraLen + commentLen;

      if (filename.endsWith('/')) continue;
      if (
        localHeaderOffset + 30 <= bytes.length &&
        bytes[localHeaderOffset] === 0x50 &&
        bytes[localHeaderOffset + 1] === 0x4b &&
        bytes[localHeaderOffset + 2] === 0x03 &&
        bytes[localHeaderOffset + 3] === 0x04
      ) {
        const lfhNameLen = readUint16LE(bytes, localHeaderOffset + 26);
        const lfhExtraLen = readUint16LE(bytes, localHeaderOffset + 28);
        const dataStart = localHeaderOffset + 30 + lfhNameLen + lfhExtraLen;
        const dataEnd = Math.min(bytes.length, dataStart + compressedSize);
        rawEntries.push({
          filename,
          compressionMethod,
          compressedBytes: bytes.subarray(dataStart, dataEnd),
          uncompressedSize,
        });
      }
    }
  } else {
    // Fallback sequential Local File Header scan
    let ptr = 0;
    while (ptr + 30 <= bytes.length) {
      if (
        bytes[ptr] !== 0x50 ||
        bytes[ptr + 1] !== 0x4b ||
        bytes[ptr + 2] !== 0x03 ||
        bytes[ptr + 3] !== 0x04
      ) {
        break;
      }
      const compressionMethod = readUint16LE(bytes, ptr + 8);
      const compressedSize = readUint32LE(bytes, ptr + 18);
      const uncompressedSize = readUint32LE(bytes, ptr + 22);
      const nameLen = readUint16LE(bytes, ptr + 26);
      const extraLen = readUint16LE(bytes, ptr + 28);
      const filename = new TextDecoder().decode(bytes.subarray(ptr + 30, ptr + 30 + nameLen));
      const dataStart = ptr + 30 + nameLen + extraLen;
      const dataEnd = Math.min(bytes.length, dataStart + compressedSize);
      if (!filename.endsWith('/')) {
        rawEntries.push({
          filename,
          compressionMethod,
          compressedBytes: bytes.subarray(dataStart, dataEnd),
          uncompressedSize,
        });
      }
      ptr = dataEnd;
    }
  }

  const out = new Map<string, Uint8Array>();
  for (const entry of rawEntries) {
    if (entry.compressionMethod === 0) {
      out.set(entry.filename, entry.compressedBytes);
    } else if (entry.compressionMethod === 8) {
      const inflated = await inflateRawBytes(entry.compressedBytes);
      out.set(entry.filename, inflated);
    } else {
      throw new Error(
        `Unsupported ZIP compression method ${entry.compressionMethod} for "${entry.filename}".`
      );
    }
  }
  return out;
}

/**
 * Deterministic uncompressed ZIP builder (useful for sequence roundtrip tests and exports).
 */
export function buildStoreZipArchive(
  files: Array<{ name: string; content: string | Uint8Array }>
): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const cdParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const dataBytes =
      typeof file.content === 'string' ? encoder.encode(file.content) : file.content;

    const lfh = new Uint8Array(30 + nameBytes.length);
    lfh.set([0x50, 0x4b, 0x03, 0x04], 0);
    lfh[4] = 20; // version
    // compression method 0, timestamps 0, crc 0 (store)
    lfh[18] = dataBytes.length & 0xff;
    lfh[19] = (dataBytes.length >> 8) & 0xff;
    lfh[20] = (dataBytes.length >> 16) & 0xff;
    lfh[21] = (dataBytes.length >> 24) & 0xff;
    lfh[22] = dataBytes.length & 0xff;
    lfh[23] = (dataBytes.length >> 8) & 0xff;
    lfh[24] = (dataBytes.length >> 16) & 0xff;
    lfh[25] = (dataBytes.length >> 24) & 0xff;
    lfh[26] = nameBytes.length & 0xff;
    lfh[27] = (nameBytes.length >> 8) & 0xff;
    lfh.set(nameBytes, 30);

    const cdh = new Uint8Array(46 + nameBytes.length);
    cdh.set([0x50, 0x4b, 0x01, 0x02], 0);
    cdh[4] = 20;
    cdh[6] = 20;
    cdh.set(lfh.subarray(18, 26), 20);
    cdh[28] = nameBytes.length & 0xff;
    cdh[29] = (nameBytes.length >> 8) & 0xff;
    cdh[42] = offset & 0xff;
    cdh[43] = (offset >> 8) & 0xff;
    cdh[44] = (offset >> 16) & 0xff;
    cdh[45] = (offset >> 24) & 0xff;
    cdh.set(nameBytes, 46);

    localParts.push(lfh, dataBytes);
    cdParts.push(cdh);
    offset += lfh.length + dataBytes.length;
  }

  const cdSize = cdParts.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array(22);
  eocd.set([0x50, 0x4b, 0x05, 0x06], 0);
  eocd[8] = files.length & 0xff;
  eocd[9] = (files.length >> 8) & 0xff;
  eocd[10] = files.length & 0xff;
  eocd[11] = (files.length >> 8) & 0xff;
  eocd[12] = cdSize & 0xff;
  eocd[13] = (cdSize >> 8) & 0xff;
  eocd[14] = (cdSize >> 16) & 0xff;
  eocd[15] = (cdSize >> 24) & 0xff;
  eocd[16] = offset & 0xff;
  eocd[17] = (offset >> 8) & 0xff;
  eocd[18] = (offset >> 16) & 0xff;
  eocd[19] = (offset >> 24) & 0xff;

  const totalLen = offset + cdSize + eocd.length;
  const out = new Uint8Array(totalLen);
  let cursor = 0;
  for (const part of [...localParts, ...cdParts, eocd]) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

function buildArmatureFromJointMap(
  jointAngles: Partial<Record<JointId, number>>,
  baseState: ArmatureState
): ArmatureState {
  const nextJoints = { ...baseState.joints };
  for (const spec of JOINT_SPECS) {
    if (spec.id === 'pelvis') continue;
    const raw = jointAngles[spec.id];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      nextJoints[spec.id] = {
        ...nextJoints[spec.id],
        localAngle: applyJointAngleConstraint(raw, baseState.continuousSpin),
      };
    }
  }
  const pelvisRot =
    typeof jointAngles.pelvis === 'number' && Number.isFinite(jointAngles.pelvis)
      ? applyJointAngleConstraint(jointAngles.pelvis, baseState.continuousSpin)
      : baseState.rootRotation;

  return {
    ...baseState,
    rootRotation: pelvisRot,
    joints: nextJoints,
  };
}

function coerceJsonPoseToSnapshot(
  raw: Record<string, unknown>,
  fallbackLabel: string,
  baseState: ArmatureState
): CharacterPoseSnapshot {
  if (raw.joints && typeof raw.joints === 'object' && raw.snapshotId) {
    const partialSnap = raw as unknown as CharacterPoseSnapshot;
    const restored = characterSnapshotToArmature(partialSnap, baseState);
    return armatureToCharacterSnapshot(
      restored,
      typeof raw.label === 'string' ? raw.label : fallbackLabel,
      (raw.viewMode as SilhouetteDisplayMode) ?? 'wireframe'
    );
  }

  const angles =
    raw.joints && typeof raw.joints === 'object'
      ? (raw.joints as Partial<Record<JointId, number>>)
      : (raw as Partial<Record<JointId, number>>);
  const armature = buildArmatureFromJointMap(angles, baseState);
  return armatureToCharacterSnapshot(
    armature,
    typeof raw.label === 'string'
      ? raw.label
      : typeof raw.name === 'string'
      ? raw.name
      : fallbackLabel,
    (raw.viewMode as SilhouetteDisplayMode) ?? 'pure_shadow'
  );
}

function extractSnapshotFromSvg(
  svgText: string,
  fallbackLabel: string,
  baseState: ArmatureState
): CharacterPoseSnapshot {
  const poseAttrMatch = svgText.match(/data-pose=["']([^"']+)["']/i);
  if (poseAttrMatch) {
    try {
      const decoded = poseAttrMatch[1].replace(/&quot;/g, '"');
      const parsed = JSON.parse(decoded) as Record<string, unknown>;
      return coerceJsonPoseToSnapshot(parsed, fallbackLabel, baseState);
    } catch {
      // fall through to attribute joint scanning
    }
  }

  const jointMatches = svgText.matchAll(
    /data-joint-id=["']([a-zA-Z0-9_]+)["'][^>]*data-angle=["']([-0-9.]+)["']/gi
  );
  const extracted: Partial<Record<JointId, number>> = {};
  for (const m of jointMatches) {
    const val = parseFloat(m[2]);
    if (Number.isFinite(val)) {
      extracted[m[1] as JointId] = val;
    }
  }
  const armature = buildArmatureFromJointMap(extracted, baseState);
  return armatureToCharacterSnapshot(armature, fallbackLabel, 'pure_shadow');
}

/**
 * Vector Sequence ZIP Importer:
 * Parses uploaded .zip vector packages (.json pose/track frames and/or .svg frames)
 * into ordered keyframe tracks driven smoothly by the 43-joint FK engine.
 */
export async function importVectorSequenceZip(
  zipBytes: ArrayBuffer | Uint8Array,
  archiveName = 'vector-sequence.zip',
  baseState: ArmatureState = createPosePreset('tpose')
): Promise<ImportedVectorSequence> {
  const entries = await parseZipArchiveEntries(zipBytes);
  const sortedNames = [...entries.keys()]
    .filter((n) => !n.startsWith('__MACOSX/'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const decoder = new TextDecoder();
  const frames: ImportedKeyframeFrame[] = [];
  let svgFileCount = 0;
  let jsonFileCount = 0;
  let fps = 12;

  for (const filename of sortedNames) {
    const lower = filename.toLowerCase();
    const contentBytes = entries.get(filename);
    if (!contentBytes) continue;

    if (lower.endsWith('.json')) {
      jsonFileCount++;
      const parsed = JSON.parse(decoder.decode(contentBytes)) as unknown;
      if (Array.isArray(parsed)) {
        parsed.forEach((item, idx) => {
          if (item && typeof item === 'object') {
            const snap = coerceJsonPoseToSnapshot(
              item as Record<string, unknown>,
              `Track ${frames.length + 1}`,
              baseState
            );
            const dur =
              typeof (item as Record<string, unknown>).durationMs === 'number'
                ? ((item as Record<string, unknown>).durationMs as number)
                : 500;
            frames.push({
              frameIndex: frames.length,
              label: snap.label || `Frame #${idx + 1}`,
              durationMs: dur,
              sourceFile: filename,
              snapshot: snap,
            });
          }
        });
      } else if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>;
        if (typeof obj.fps === 'number' && obj.fps > 0) {
          fps = obj.fps;
        }
        if (Array.isArray(obj.frames) || Array.isArray(obj.keyframes)) {
          const track = (obj.frames ?? obj.keyframes) as unknown[];
          track.forEach((item, idx) => {
            if (item && typeof item === 'object') {
              const snap = coerceJsonPoseToSnapshot(
                item as Record<string, unknown>,
                `Keyframe #${idx + 1}`,
                baseState
              );
              const dur =
                typeof (item as Record<string, unknown>).durationMs === 'number'
                  ? ((item as Record<string, unknown>).durationMs as number)
                  : Math.round(1000 / fps);
              frames.push({
                frameIndex: frames.length,
                label: snap.label,
                durationMs: dur,
                sourceFile: filename,
                snapshot: snap,
              });
            }
          });
        } else {
          const snap = coerceJsonPoseToSnapshot(
            obj,
            `Frame #${frames.length + 1}`,
            baseState
          );
          frames.push({
            frameIndex: frames.length,
            label: snap.label,
            durationMs: 500,
            sourceFile: filename,
            snapshot: snap,
          });
        }
      }
    } else if (lower.endsWith('.svg')) {
      svgFileCount++;
      const svgText = decoder.decode(contentBytes);
      const shortName = filename.split('/').pop()?.replace(/\.svg$/i, '') ?? filename;
      const snap = extractSnapshotFromSvg(svgText, shortName, baseState);
      frames.push({
        frameIndex: frames.length,
        label: shortName,
        durationMs: Math.round(1000 / fps),
        sourceFile: filename,
        snapshot: snap,
      });
    }
  }

  if (frames.length === 0) {
    throw new Error(
      `ZIP "${archiveName}" contained no valid JSON pose tracks or SVG sequence frames.`
    );
  }

  return {
    sequenceId: `seq-${Date.now()}`,
    name: archiveName.replace(/\.zip$/i, ''),
    fps,
    frames,
    svgFileCount,
    jsonFileCount,
  };
}
