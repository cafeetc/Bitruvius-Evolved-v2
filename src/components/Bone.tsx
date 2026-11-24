import React from 'react';
import { JointId } from '../types';
import { SkeletonPieceRender } from '../utils/skeletonAttachment';

interface BoneProps {
  piece: SkeletonPieceRender;
  isSelected: boolean;
  isHovered: boolean;
  pureShadow: boolean;
  onPointerDown?: (e: React.PointerEvent<SVGGElement>, jointId: JointId) => void;
  onPointerEnter?: (jointId: JointId) => void;
  onPointerLeave?: () => void;
}

export const Bone: React.FC<BoneProps> = ({
  piece,
  isSelected,
  isHovered,
  pureShadow,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
}) => {
  const { asset, jointId, matrixCss } = piece;

  const filterAttr = pureShadow
    ? undefined
    : isSelected
    ? 'url(#skeleton-selected-glow)'
    : isHovered
    ? 'url(#skeleton-hover-glow)'
    : undefined;

  return (
    <g
      data-bone-id={asset.nodeId}
      data-piece-key={piece.key}
      data-joint-id={jointId}
      data-draw-order={piece.drawOrder}
      transform={matrixCss}
      onPointerDown={onPointerDown ? (e) => onPointerDown(e, jointId) : undefined}
      onPointerEnter={onPointerEnter ? () => onPointerEnter(jointId) : undefined}
      onPointerLeave={onPointerLeave}
      style={{
        cursor: 'pointer',
      }}
    >
      <image
        href={asset.assetUrl}
        x={asset.x}
        y={asset.y}
        width={asset.w}
        height={asset.h}
        preserveAspectRatio="none"
        filter={filterAttr}
        style={{
          opacity: pureShadow ? 1 : 0.94,
          transition: 'opacity 140ms ease',
        }}
      />
    </g>
  );
};
