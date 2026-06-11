import type { PixelBlock } from "./magicHandSpellEffectsRuntime";

export function PixelBlocks({ blocks }: { blocks: PixelBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => (
        <rect
          key={`${block.x}-${block.y}-${block.w}-${block.h}-${index}`}
          x={block.x}
          y={block.y}
          width={block.w}
          height={block.h}
          fill={block.color}
          opacity={block.opacity ?? 1}
          transform={block.rotation ? `rotate(${block.rotation} ${block.x + block.w / 2} ${block.y + block.h / 2})` : undefined}
        />
      ))}
    </>
  );
}
