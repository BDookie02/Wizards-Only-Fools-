import { type RefObject } from "react";
import { getFallbackSpellThumbnail } from "./spellMenuRuntime";

type SpellThumbnailImageProbeProps = {
  imgRef: RefObject<HTMLImageElement | null>;
  src: string;
  animate: boolean;
  onFrameLoaded: () => void;
  onFallbackSrc: (src: string) => void;
};

export function SpellThumbnailImageProbe({
  imgRef,
  src,
  animate,
  onFrameLoaded,
  onFallbackSrc,
}: SpellThumbnailImageProbeProps) {
  return (
    <img
      ref={imgRef}
      src={src}
      alt=""
      crossOrigin="anonymous"
      loading={animate ? "eager" : "lazy"}
      decoding="async"
      className="pointer-events-none absolute h-px w-px opacity-0"
      onLoad={onFrameLoaded}
      onError={() => {
        const fallback = getFallbackSpellThumbnail();
        if (src !== fallback) onFallbackSrc(fallback);
      }}
    />
  );
}
