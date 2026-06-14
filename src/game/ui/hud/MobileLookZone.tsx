import type { PointerEventHandler } from "react";

export function MobileLookZone({
  beginLook,
  moveLook,
  endLook,
}: {
  beginLook: PointerEventHandler<HTMLDivElement>;
  moveLook: PointerEventHandler<HTMLDivElement>;
  endLook: PointerEventHandler<HTMLDivElement>;
}) {
  return (
    <div
      className="mobile-look-zone pointer-events-auto absolute inset-y-0 right-0 w-[58%]"
      style={{ touchAction: "none" }}
      onPointerDown={beginLook}
      onPointerMove={moveLook}
      onPointerUp={endLook}
      onPointerCancel={endLook}
    />
  );
}
