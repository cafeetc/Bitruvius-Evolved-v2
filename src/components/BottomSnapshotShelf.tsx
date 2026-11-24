import React, { useMemo, useRef, useState } from 'react';
import { Camera, Film, FolderUp, Pause, Play, X } from 'lucide-react';
import { CharacterPoseSnapshot } from '../types';
import {
  INSPECTION_VIEW_MODE_INFO,
  JOINT_SPECS,
  characterSnapshotToArmature,
  computeArmature,
} from '../utils/kinematics';
import { ImportedVectorSequence } from '../utils/zipSequenceImporter';

interface BottomSnapshotShelfProps {
  snapshots: CharacterPoseSnapshot[];
  activeSnapshotId: string | null;
  onCaptureSnapshot: () => void;
  onRecallSnapshot: (snapshot: CharacterPoseSnapshot) => void;
  onRenameSnapshot: (snapshotId: string, nextLabel: string) => void;
  onDeleteSnapshot: (snapshotId: string) => void;
  onImportZipSequence: (file: File) => void;
  importedSequence: ImportedVectorSequence | null;
  sequencePlaying: boolean;
  sequenceFrameIndex: number;
  onToggleSequencePlay: () => void;
  zipImportStatus: string | null;
}

const SnapshotPreviewSvg: React.FC<{ snapshot: CharacterPoseSnapshot }> = ({ snapshot }) => {
  const segments = useMemo(() => {
    const state = characterSnapshotToArmature(snapshot);
    const computed = computeArmature(state);
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number; spine: boolean }> = [];
    for (const spec of JOINT_SPECS) {
      if (!spec.parentId || spec.isGhost || spec.aimTarget) continue;
      const child = computed[spec.id];
      const parent = computed[spec.parentId];
      if (Math.hypot(child.x - parent.x, child.y - parent.y) > 1) {
        lines.push({
          x1: parent.x,
          y1: parent.y,
          x2: child.x,
          y2: child.y,
          spine: Boolean(spec.isSpine),
        });
      }
      if (Math.hypot(child.endX - child.x, child.endY - child.y) > 1) {
        lines.push({
          x1: child.x,
          y1: child.y,
          x2: child.endX,
          y2: child.endY,
          spine: Boolean(spec.isSpine),
        });
      }
    }
    const head = computed.head;
    const lum = computed.lumbar;
    return { lines, head, lum };
  }, [snapshot]);

  return (
    <svg
      width="32"
      height="42"
      viewBox={`${segments.lum.x - 520} ${segments.lum.y - 620} 1040 1320`}
      className="shrink-0 bg-[#0D0012] border border-[#EBE0F5]/14 rounded-[2px]"
      aria-hidden="true"
    >
      {segments.lines.map((l, i) => (
        <line
          key={i}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke={
            snapshot.viewMode === 'purple_skeleton' || snapshot.viewMode === 'hybrid_overlay'
              ? '#C084FC'
              : snapshot.viewMode === 'wireframe'
              ? '#4ADE80'
              : '#E9D5FF'
          }
          strokeWidth={l.spine ? 42 : 34}
          strokeLinecap="round"
        />
      ))}
      <circle
        cx={segments.head.x}
        cy={(segments.head.y + segments.head.endY) / 2}
        r={85}
        fill="none"
        stroke="#F3E8FF"
        strokeWidth={32}
      />
    </svg>
  );
};

function formatTimeShort(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export const BottomSnapshotShelf: React.FC<BottomSnapshotShelfProps> = ({
  snapshots,
  activeSnapshotId,
  onCaptureSnapshot,
  onRecallSnapshot,
  onRenameSnapshot,
  onDeleteSnapshot,
  onImportZipSequence,
  importedSequence,
  sequencePlaying,
  sequenceFrameIndex,
  onToggleSequencePlay,
  zipImportStatus,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');

  const beginEdit = (snap: CharacterPoseSnapshot) => {
    setEditingId(snap.snapshotId);
    setDraftTitle(snap.label);
  };

  const commitEdit = (snap: CharacterPoseSnapshot) => {
    const cleaned = draftTitle.trim();
    if (cleaned && cleaned !== snap.label) {
      onRenameSnapshot(snap.snapshotId, cleaned);
    }
    setEditingId(null);
  };

  return (
    <section
      aria-label="Session Snapshot Reel"
      data-snapshot-shelf="true"
      className="w-full h-[64px] px-3 bg-[#16001E] border-t border-[#EBE0F5]/16 flex items-center gap-2.5 shrink-0 overflow-hidden"
    >
      {/* Left-aligned Capture Snapshot + Import ZIP Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onCaptureSnapshot}
          className="h-10 px-2.5 bg-[#361547] hover:bg-[#4A1E61] border border-[#D8B4FE]/45 rounded-[2px] text-[#FAF6FF] font-vera font-bold text-[10.5px] flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
        >
          <Camera className="w-3.5 h-3.5 text-[#E9D5FF]" />
          <span>Capture Snapshot</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onImportZipSequence(file);
              e.target.value = '';
            }
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Import Vector Sequence ZIP (.json pose tracks or .svg frames)"
          className="h-10 px-2 bg-[#21072B] hover:bg-[#310E3F] border border-[#EBE0F5]/20 rounded-[2px] text-[#E6DCF0] font-vera font-bold text-[10px] flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors"
        >
          <FolderUp className="w-3.5 h-3.5 text-[#C084FC]" />
          <span>Import ZIP</span>
        </button>

        {importedSequence && (
          <button
            type="button"
            onClick={onToggleSequencePlay}
            title={`${sequencePlaying ? 'Pause' : 'Play'} ${importedSequence.name}`}
            className="h-10 px-2 bg-[#0D0012] hover:bg-[#250A33] border border-[#4ADE80]/40 rounded-[2px] text-[#86EFAC] font-typewriter font-bold text-[10px] flex items-center gap-1 whitespace-nowrap cursor-pointer"
          >
            {sequencePlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <Film className="w-3 h-3" />
            <span>
              {sequenceFrameIndex + 1}/{importedSequence.frames.length}
            </span>
          </button>
        )}
      </div>

      {/* Horizontal Snapshot Card Reel */}
      <div className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto console-scroll py-1">
        {snapshots.length === 0 ? (
          <div className="font-vera text-[10px] text-[#9E8EB3] whitespace-nowrap px-2">
            {zipImportStatus ??
              'Capture Snapshot cards appear here — click any card for 0.50s shortest-path recall.'}
          </div>
        ) : (
          snapshots.map((snap) => {
            const isActive = activeSnapshotId === snap.snapshotId;
            const modeMeta = INSPECTION_VIEW_MODE_INFO[snap.viewMode];
            return (
              <div
                key={snap.snapshotId}
                data-snapshot-card={snap.snapshotId}
                className={`h-[50px] pl-1.5 pr-1 py-1 rounded-[2px] border flex items-center gap-2 shrink-0 transition-colors ${
                  isActive
                    ? 'bg-[#2D0E3B] border-[#D8B4FE]/65'
                    : 'bg-[#0D0012]/80 border-[#EBE0F5]/16 hover:bg-[#21072B]/85'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onRecallSnapshot(snap)}
                  aria-label={`Recall ${snap.label}`}
                  className="flex items-center gap-2 cursor-pointer text-left"
                >
                  <SnapshotPreviewSvg snapshot={snap} />
                </button>

                <div className="flex flex-col justify-between min-w-[104px] max-w-[140px]">
                  {editingId === snap.snapshotId ? (
                    <input
                      type="text"
                      autoFocus
                      aria-label={`Edit title for ${snap.label}`}
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      onBlur={() => commitEdit(snap)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit(snap);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="w-full px-1 py-0 text-[10px] font-vera font-bold text-[#FAF6FF] bg-[#16001E] border border-[#D8B4FE] rounded-[2px] focus:outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => onRecallSnapshot(snap)}
                      onDoubleClick={() => beginEdit(snap)}
                      title="Click to recall (0.50s) · Double-click to rename"
                      className="text-left font-vera font-bold text-[10px] text-[#FAF6FF] truncate cursor-pointer hover:text-[#D8B4FE]"
                    >
                      {snap.label}
                    </button>
                  )}

                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-typewriter text-[8.5px] text-[#9E8EB3]">
                      {formatTimeShort(snap.timestamp)}
                    </span>
                    <span className="px-1 py-[0.5px] bg-[#21072B] border border-[#EBE0F5]/16 rounded-[2px] font-vera text-[8px] text-[#D8B4FE] truncate">
                      {modeMeta.shortLabel}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onDeleteSnapshot(snap.snapshotId)}
                  aria-label={`Delete ${snap.label}`}
                  title={`Delete ${snap.label}`}
                  className="self-start p-0.5 text-[#9E8EB3] hover:text-[#FCA5A5] cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
