import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GridOriginMode, PYXL_PX, SUBPYXL_PX } from '../types';
import { ModelBounds, SideCalloutDescriptor, WorldExclusionRect } from '../utils/kinematics';

export const DEFAULT_FPS = 12;
export const INTERTITLE_BACKSPACE_FRAMES = 6;
export const INTERTITLE_LETTER_PYXLS = 2;

const TARGET_CAP_HEIGHT_PX = INTERTITLE_LETTER_PYXLS * PYXL_PX; // 200 world px = 2.00 pyx
const LINE_LEADING_PX = PYXL_PX; // 1.00 pyx leading between lines
const LINE_STEP_PX = TARGET_CAP_HEIGHT_PX + LINE_LEADING_PX; // 3.00 pyx baseline-to-baseline

// Fallback Computer Modern Typewriter Bold cap-height ratio (~0.611 of em)
const DEFAULT_CAP_RATIO = 0.611;
const DEFAULT_ADVANCE_RATIO = 0.525;

export interface IntertitleItem {
  id: string;
  lines: string[];
  imageUrl?: string;
  imageAlt?: string;
  position?: 'top-half' | 'center' | 'below-model';
}

interface GridIntertitleLayerProps {
  item: IntertitleItem | null;
  dismissing: boolean;
  originMode: GridOriginMode;
  originOffset: { x: number; y: number };
  viewportWidth: number;
  zoom: number;
  modelBounds?: ModelBounds | null;
  sideCallouts?: SideCalloutDescriptor[];
  extraExclusions?: WorldExclusionRect[];
  onTriggerDismiss: () => void;
  onDismissComplete: () => void;
  fps?: number;
  backspaceFrames?: number;
}

interface CalibratedTypeMetrics {
  fontSize: number;
  cellWidth: number;
}

function measureUMTypewriterMetrics(): CalibratedTypeMetrics {
  if (typeof document === 'undefined') {
    const fontSize = TARGET_CAP_HEIGHT_PX / DEFAULT_CAP_RATIO;
    return {
      fontSize,
      cellWidth: Math.round((fontSize * DEFAULT_ADVANCE_RATIO) / (SUBPYXL_PX * 2)) * (SUBPYXL_PX * 2),
    };
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fontSize = TARGET_CAP_HEIGHT_PX / DEFAULT_CAP_RATIO;
    return {
      fontSize,
      cellWidth: 160,
    };
  }

  const probeEm = 1000;
  ctx.font = `700 ${probeEm}px UMTypewriter, monospace`;
  const capSample = ctx.measureText('WB');
  const capAscent =
    capSample.actualBoundingBoxAscent > 0
      ? capSample.actualBoundingBoxAscent
      : probeEm * DEFAULT_CAP_RATIO;
  const capRatio = capAscent / probeEm;

  const advanceSample = ctx.measureText('M');
  const advanceRatio =
    advanceSample.width > 0 ? advanceSample.width / probeEm : DEFAULT_ADVANCE_RATIO;

  const fontSize = TARGET_CAP_HEIGHT_PX / capRatio;
  const rawAdvance = fontSize * advanceRatio;
  // Snap monospace sort advance to 10px subpyxl grid increments (150px = 1.50 pyx clean letter spacing)
  const cellWidth = Math.max(150, Math.min(160, Math.round(rawAdvance / SUBPYXL_PX) * SUBPYXL_PX));

  return { fontSize, cellWidth };
}

function wrapTextToGridMeasure(sourceLines: string[], maxChars: number): string[] {
  const safeMax = Math.max(4, maxChars);
  const words = sourceLines
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return [''];

  const fullSingleLine = words.join(' ');
  if (fullSingleLine.length <= safeMax) {
    return [fullSingleLine];
  }

  const lines: string[] = [];
  let current = '';

  const pushWrappedWord = (word: string) => {
    const numParts = Math.max(
      2,
      Math.ceil((word.length - 1) / Math.max(1, safeMax - 1))
    );
    let idx = 0;
    for (let p = 0; p < numParts; p++) {
      const remParts = numParts - p;
      const remLen = word.length - idx;
      const take = Math.ceil(remLen / remParts);
      const cappedTake =
        p < numParts - 1 ? Math.min(take, Math.max(1, safeMax - 1)) : take;
      const chunk = word.slice(idx, idx + cappedTake);
      idx += cappedTake;
      if (p < numParts - 1) {
        lines.push(`${chunk}-`);
      } else if (chunk.length > 0) {
        current = chunk;
      }
    }
  };

  for (const word of words) {
    if (!current) {
      if (word.length <= safeMax) {
        current = word;
      } else {
        pushWrappedWord(word);
      }
    } else if (current.length + 1 + word.length <= safeMax) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = '';
      if (word.length <= safeMax) {
        current = word;
      } else {
        pushWrappedWord(word);
      }
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

export const GridIntertitleLayer: React.FC<GridIntertitleLayerProps> = ({
  item,
  dismissing,
  originMode,
  originOffset,
  viewportWidth,
  zoom,
  modelBounds,
  sideCallouts = [],
  extraExclusions = [],
  onTriggerDismiss,
  onDismissComplete,
  fps = DEFAULT_FPS,
  backspaceFrames = INTERTITLE_BACKSPACE_FRAMES,
}) => {
  const [frameIndex, setFrameIndex] = useState(0);
  const completedRef = useRef(false);
  const [metrics, setMetrics] = useState<CalibratedTypeMetrics>(() =>
    measureUMTypewriterMetrics()
  );

  // Re-calibrate exact cap height once UMTypewriter webfont finishes loading
  useEffect(() => {
    let cancelled = false;
    const recalibrate = () => {
      if (!cancelled) {
        setMetrics(measureUMTypewriterMetrics());
      }
    };
    if (document.fonts) {
      document.fonts.load('700 100px UMTypewriter').then(recalibrate).catch(() => {});
      document.fonts.ready.then(recalibrate).catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // Compute responsive grid measure (1 line on wider views, 2 lines on thinner views, 3+ on very thin views)
  const wrappedLines = useMemo(() => {
    if (!item) return [];
    const safeZoom = Math.max(0.1, zoom);
    // Keep clear margin inside the 28px stretched borders
    const availableWorldW = Math.max(metrics.cellWidth * 4, (viewportWidth - 64) / safeZoom);
    const maxCharsPerLine = Math.max(4, Math.floor(availableWorldW / metrics.cellWidth));
    return wrapTextToGridMeasure(item.lines, maxCharsPerLine);
  }, [item, metrics.cellWidth, viewportWidth, zoom]);

  const fullText = useMemo(() => wrappedLines.join('\n'), [wrappedLines]);

  useEffect(() => {
    setFrameIndex(0);
    completedRef.current = false;
  }, [item?.id]);

  // Step discrete 12 fps frames to simulate backspace over 6 frames
  useEffect(() => {
    if (!dismissing || !item) return;

    const frameDurationMs = 1000 / fps;
    let currentFrame = 0;
    setFrameIndex(0);

    const intervalId = window.setInterval(() => {
      currentFrame += 1;
      setFrameIndex(currentFrame);

      if (currentFrame >= backspaceFrames) {
        window.clearInterval(intervalId);
        if (!completedRef.current) {
          completedRef.current = true;
          onDismissComplete();
        }
      }
    }, frameDurationMs);

    return () => window.clearInterval(intervalId);
  }, [dismissing, item, fps, backspaceFrames, onDismissComplete]);

  if (!item) return null;

  const totalChars = fullText.length;
  const remainingChars = dismissing
    ? Math.max(0, Math.round(totalChars * (1 - frameIndex / backspaceFrames)))
    : totalChars;

  let charCursor = 0;
  const lineSlices = wrappedLines.map((targetLine, lineIdx) => {
    const sliceLen = Math.max(0, Math.min(targetLine.length, remainingChars - charCursor));
    const visibleLine = targetLine.slice(0, sliceLen);
    const hasActiveCaret =
      dismissing &&
      remainingChars > 0 &&
      remainingChars >= charCursor &&
      remainingChars <= charCursor + targetLine.length;
    charCursor += targetLine.length + 1;
    return {
      targetLen: targetLine.length,
      visibleLine,
      hasActiveCaret,
      lineIdx,
    };
  });

  const anchorX = originMode === 'center' ? originOffset.x : 7 * PYXL_PX;
  const posMode = item.position ?? 'below-model';
  const isTopHalf = posMode === 'top-half';
  const isBelowModel = posMode === 'below-model';
  const lineCount = wrappedLines.length;
  const stackPyxls = lineCount * INTERTITLE_LETTER_PYXLS + Math.max(0, lineCount - 1);
  const originBaseY = originMode === 'center' ? originOffset.y : 0;

  // Align every line's baseline & cap-line strictly to integer pyxl rows
  let firstCapPyxlFromOrigin: number;
  if (isBelowModel) {
    if (modelBounds) {
      // Snap strictly to the next integer pyxl row cleanly below the feet / lower silhouette
      firstCapPyxlFromOrigin = Math.ceil((modelBounds.maxY - originBaseY) / PYXL_PX);
    } else {
      firstCapPyxlFromOrigin = originMode === 'center' ? 5 : 14;
    }
  } else if (isTopHalf && lineCount <= 3) {
    const minCap = originMode === 'center' ? -8 : 1;
    if (lineCount === 1) {
      firstCapPyxlFromOrigin = minCap;
    } else {
      const midPyxl = originMode === 'center' ? -5.0 : 4.0;
      firstCapPyxlFromOrigin = Math.max(minCap, Math.floor(midPyxl - stackPyxls / 2));
    }
  } else {
    const midPyxl = originMode === 'center' ? 0 : 9;
    firstCapPyxlFromOrigin = Math.floor(midPyxl - stackPyxls / 2);
  }

  const maxChars = Math.max(1, ...wrappedLines.map((l) => l.length));
  const hitWidth = maxChars * metrics.cellWidth;

  // Safeguard: ensure typeset intertitle block never intersects modelBounds OR any side-rail callout menu
  const exclusionRects: { minX: number; maxX: number; minY: number; maxY: number }[] = [];
  if (modelBounds) {
    exclusionRects.push({
      minX: modelBounds.minX - 12,
      maxX: modelBounds.maxX + 12,
      minY: modelBounds.minY - 12,
      maxY: modelBounds.maxY + 12,
    });
  }
  for (const c of sideCallouts) {
    exclusionRects.push({
      minX: c.worldRect.x - 10,
      maxX: c.worldRect.x + c.worldRect.width + 10,
      minY: c.worldRect.y - 8,
      maxY: c.worldRect.y + c.worldRect.height + 8,
    });
  }
  for (const ex of extraExclusions) {
    exclusionRects.push(ex);
  }

  if (exclusionRects.length > 0) {
    const stackHeightPx = stackPyxls * PYXL_PX;
    const proposedLeftX = anchorX - hitWidth / 2;
    const proposedRightX = anchorX + hitWidth / 2;

    for (let guard = 0; guard < 12; guard++) {
      const proposedTopY = originBaseY + firstCapPyxlFromOrigin * PYXL_PX;
      const proposedBottomY = proposedTopY + stackHeightPx;

      const blocker = exclusionRects.find(
        (rect) =>
          proposedRightX > rect.minX &&
          proposedLeftX < rect.maxX &&
          proposedBottomY > rect.minY &&
          proposedTopY < rect.maxY
      );
      if (!blocker) break;

      if (isBelowModel) {
        firstCapPyxlFromOrigin = Math.ceil((blocker.maxY - originBaseY) / PYXL_PX);
      } else {
        firstCapPyxlFromOrigin =
          Math.floor((blocker.minY - originBaseY) / PYXL_PX) - stackPyxls;
      }
    }
  }

  const firstBaselineY = originBaseY + (firstCapPyxlFromOrigin + INTERTITLE_LETTER_PYXLS) * PYXL_PX;

  const topCapY = firstBaselineY - TARGET_CAP_HEIGHT_PX;
  const bottomBaselineY = firstBaselineY + (lineCount - 1) * LINE_STEP_PX;
  const hitHeight = bottomBaselineY - topCapY;
  const inkFill = '#16001E';

  return (
    <g
      role="button"
      aria-label={wrappedLines.join(' ')}
      onPointerDown={(e) => {
        e.stopPropagation();
        onTriggerDismiss();
      }}
      style={{
        cursor: 'pointer',
        mixBlendMode: 'multiply',
      }}
    >
      {/* Invisible composing galley hit target covering entire typeset block */}
      <rect
        x={anchorX - hitWidth / 2}
        y={topCapY}
        width={hitWidth}
        height={hitHeight}
        fill="transparent"
      />

      {item.imageUrl && (
        <image
          href={item.imageUrl}
          x={anchorX - 2 * PYXL_PX}
          y={topCapY - 4 * PYXL_PX}
          width={4 * PYXL_PX}
          height={3 * PYXL_PX}
          preserveAspectRatio="xMidYMid meet"
        />
      )}

      {lineSlices.map(({ targetLen, visibleLine, hasActiveCaret, lineIdx }) => {
        const baselineY = firstBaselineY + lineIdx * LINE_STEP_PX;
        const firstCharCenterX = anchorX - ((targetLen - 1) * metrics.cellWidth) / 2;

        return (
          <g key={`intertitle-line-${lineIdx}`}>
            {visibleLine.split('').map((ch, charIdx) => (
              <text
                key={`char-${lineIdx}-${charIdx}`}
                x={firstCharCenterX + charIdx * metrics.cellWidth}
                y={baselineY}
                textAnchor="middle"
                dominantBaseline="alphabetic"
                textRendering="geometricPrecision"
                fill={inkFill}
                fillOpacity={0.78}
                fontSize={metrics.fontSize}
                fontWeight={700}
                fontFamily="UMTypewriter, monospace"
                style={{ userSelect: 'none' }}
              >
                {ch}
              </text>
            ))}

            {hasActiveCaret && visibleLine.length > 0 && (
              <rect
                x={
                  firstCharCenterX +
                  visibleLine.length * metrics.cellWidth -
                  metrics.cellWidth * 0.35
                }
                y={baselineY - TARGET_CAP_HEIGHT_PX}
                width={SUBPYXL_PX * 2}
                height={TARGET_CAP_HEIGHT_PX}
                fill={inkFill}
                fillOpacity={0.78}
              />
            )}
          </g>
        );
      })}
    </g>
  );
};
