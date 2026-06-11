import type * as THREE from "three";
import type { PlantLineShader } from "./SurvivalFoliagePrimitives";
export type SurvivalLocalGrassFadeUniforms = {
  viewerXZ: { value: THREE.Vector2 };
  viewerY: { value: number };
  radius: { value: number };
  fadeWidth: { value: number };
  altitudeFade: { value: number };
  verticalFadeStart: { value: number };
  verticalFadeEnd: { value: number };
  nearFadeStart?: { value: number };
  nearFadeEnd?: { value: number };
};

export function applySurvivalLocalGrassShader(
  shader: PlantLineShader,
  fadeUniforms: SurvivalLocalGrassFadeUniforms,
  beginVertexExtra = "",
  nearFadeStart = 0,
  nearFadeEnd = 0,
) {
  shader.uniforms.uLocalGrassViewerXZ = fadeUniforms.viewerXZ;
  shader.uniforms.uLocalGrassViewerY = fadeUniforms.viewerY;
  shader.uniforms.uLocalGrassRadius = fadeUniforms.radius;
  shader.uniforms.uLocalGrassFadeWidth = fadeUniforms.fadeWidth;
  shader.uniforms.uLocalGrassAltitudeFade = fadeUniforms.altitudeFade;
  shader.uniforms.uLocalGrassVerticalFadeStart = fadeUniforms.verticalFadeStart;
  shader.uniforms.uLocalGrassVerticalFadeEnd = fadeUniforms.verticalFadeEnd;
  shader.uniforms.uLocalGrassNearFadeStart = fadeUniforms.nearFadeStart ?? { value: nearFadeStart };
  shader.uniforms.uLocalGrassNearFadeEnd = fadeUniforms.nearFadeEnd ?? { value: nearFadeEnd };

  shader.vertexShader = `varying vec3 vLocalGrassWorldPosition;
${shader.vertexShader.replace(
    "#include <begin_vertex>",
    `#include <begin_vertex>
              ${beginVertexExtra}
              vec4 localGrassWorldPosition = vec4(transformed, 1.0);
              #ifdef USE_INSTANCING
                localGrassWorldPosition = instanceMatrix * localGrassWorldPosition;
              #endif
              localGrassWorldPosition = modelMatrix * localGrassWorldPosition;
              vLocalGrassWorldPosition = localGrassWorldPosition.xyz;`,
  )}`;
  shader.fragmentShader = `uniform vec2 uLocalGrassViewerXZ;
uniform float uLocalGrassViewerY;
uniform float uLocalGrassRadius;
uniform float uLocalGrassFadeWidth;
uniform float uLocalGrassAltitudeFade;
uniform float uLocalGrassVerticalFadeStart;
uniform float uLocalGrassVerticalFadeEnd;
uniform float uLocalGrassNearFadeStart;
uniform float uLocalGrassNearFadeEnd;
varying vec3 vLocalGrassWorldPosition;
${shader.fragmentShader.replace(
    "vec4 diffuseColor = vec4( diffuse, opacity );",
    `vec4 diffuseColor = vec4( diffuse, opacity );
  float localGrassDistance = distance(vLocalGrassWorldPosition.xz, uLocalGrassViewerXZ);
  float localGrassEdgeFade = 1.0 - smoothstep(
    max(0.0, uLocalGrassRadius - uLocalGrassFadeWidth),
    uLocalGrassRadius,
    localGrassDistance
  );
  float localGrassNearFade = uLocalGrassNearFadeEnd > uLocalGrassNearFadeStart
    ? smoothstep(uLocalGrassNearFadeStart, uLocalGrassNearFadeEnd, localGrassDistance)
    : 1.0;
  if (uLocalGrassNearFadeEnd > uLocalGrassNearFadeStart && localGrassNearFade < 0.72) discard;
  float localGrassAboveViewer = vLocalGrassWorldPosition.y - uLocalGrassViewerY;
  float localGrassVerticalFade = uLocalGrassVerticalFadeEnd > uLocalGrassVerticalFadeStart
    ? 1.0 - smoothstep(uLocalGrassVerticalFadeStart, uLocalGrassVerticalFadeEnd, localGrassAboveViewer)
    : 1.0;
  diffuseColor.a *= clamp(localGrassNearFade * localGrassEdgeFade * localGrassVerticalFade * uLocalGrassAltitudeFade, 0.0, 1.0);
  if (diffuseColor.a < 0.018) discard;`,
  )}`;
}


