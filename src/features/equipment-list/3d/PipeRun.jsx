import React, { useMemo } from "react";
import * as THREE from "three";

/**
 * A routed line rendered as orthogonal tube segments.
 * Path points are in Z-up plant coordinates (scene group handles rotation).
 */
export function PipeRun({ line, highlighted, dimmed }) {
  const geometry = useMemo(() => {
    if (!line.path || line.path.length < 2) return null;
    const curvePath = new THREE.CurvePath();
    for (let i = 0; i < line.path.length - 1; i += 1) {
      const a = line.path[i];
      const b = line.path[i + 1];
      curvePath.add(
        new THREE.LineCurve3(
          new THREE.Vector3(a.x, a.y, a.z),
          new THREE.Vector3(b.x, b.y, b.z),
        ),
      );
    }
    const segments = Math.max(12, line.path.length * 8);
    return new THREE.TubeGeometry(curvePath, segments, line.radius || 0.05, 8, false);
  }, [line.path, line.radius]);

  if (!geometry) return null;
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={highlighted ? "#0A5EF5" : "#8A97AB"}
        transparent={dimmed}
        opacity={dimmed ? 0.15 : 0.9}
        roughness={0.5}
        metalness={0.3}
      />
    </mesh>
  );
}
