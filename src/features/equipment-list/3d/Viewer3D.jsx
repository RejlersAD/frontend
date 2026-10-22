import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { EquipmentMesh, InstancedEquipmentGroup, INSTANCING_THRESHOLD } from "./EquipmentMesh";
import { PipeRun } from "./PipeRun";
import { colorForItem, RACK_COLOR, GRID_COLOR } from "./colors";
import { UNIT_AREA_WIDTH, UNIT_GAP, RACK_LEVELS } from "./layout";

const tooltipStyle = {
  fontSize: 12,
  background: "rgba(11,27,58,0.92)",
  color: "#fff",
  borderRadius: 6,
  padding: "3px 8px",
  whiteSpace: "nowrap",
  pointerEvents: "none",
  transform: "translateY(-8px)",
};

/** Pipe rack: two beam levels along X at y = 0 per unit area, plus posts. */
function PipeRack({ units }) {
  const beams = [];
  units.forEach((unit, unitIndex) => {
    const x0 = unitIndex * (UNIT_AREA_WIDTH + UNIT_GAP);
    const x1 = x0 + UNIT_AREA_WIDTH;
    const cx = (x0 + x1) / 2;
    const len = UNIT_AREA_WIDTH;
    for (const z of RACK_LEVELS) {
      beams.push(
        <mesh key={`${unit}-beam-${z}`} position={[cx, 0, z]}>
          <boxGeometry args={[len, 0.4, 0.4]} />
          <meshStandardMaterial color={RACK_COLOR} roughness={0.7} />
        </mesh>,
      );
    }
    for (let x = x0; x <= x1; x += 16) {
      beams.push(
        <mesh key={`${unit}-post-${x}`} position={[x, 0, RACK_LEVELS[1] / 2]}>
          <boxGeometry args={[0.4, 0.4, RACK_LEVELS[1]]} />
          <meshStandardMaterial color={RACK_COLOR} roughness={0.7} />
        </mesh>,
      );
    }
  });
  return <group>{beams}</group>;
}

/**
 * Imperative camera helper — registers an API on controllerRef:
 *   frame(position, radius), fitBounds(bounds), setView(name),
 *   zoom(factor), reset()
 */
function CameraRig({ controllerRef, bounds, view, frameRequest }) {
  const { camera, controls, invalidate } = useThree();
  const viewRef = useRef(view);

  const center = useMemo(() => {
    if (!bounds) return new THREE.Vector3(40, -5, 5);
    return new THREE.Vector3(
      (bounds.min.x + bounds.max.x) / 2,
      (bounds.min.y + bounds.max.y) / 2,
      (bounds.min.z + bounds.max.z) / 2,
    );
  }, [bounds]);

  const radius = useMemo(() => {
    if (!bounds) return 60;
    const size = new THREE.Vector3(
      bounds.max.x - bounds.min.x,
      bounds.max.y - bounds.min.y,
      bounds.max.z - bounds.min.z,
    );
    return Math.max(size.length() / 2, 15);
  }, [bounds]);

  const applyView = useCallback(
    (name, target = center, dist = radius * 2.2) => {
      let az = 35;
      let el = 30;
      if (name === "plan") {
        az = 0;
        el = 89.9;
      } else if (name === "north") {
        az = 0;
        el = 4;
      } else if (name === "east") {
        az = 90;
        el = 4;
      }
      const azR = (az * Math.PI) / 180;
      const elR = (el * Math.PI) / 180;
      // Plant coords (z-up): elevation from z, azimuth in the x/y plane.
      const offset = new THREE.Vector3(
        dist * Math.cos(elR) * Math.sin(azR),
        -dist * Math.cos(elR) * Math.cos(azR),
        dist * Math.sin(elR),
      );
      camera.position.copy(target.clone().add(offset));
      camera.up.set(0, 0, 1);
      camera.lookAt(target);
      if (controls) {
        controls.target.copy(target);
        controls.update();
      }
      invalidate();
    },
    [camera, controls, center, radius, invalidate],
  );

  useEffect(() => {
    viewRef.current = view;
    applyView(view);
  }, [view, applyView]);

  useEffect(() => {
    if (!frameRequest) return;
    const target = new THREE.Vector3(
      frameRequest.x,
      frameRequest.y,
      frameRequest.z + (frameRequest.height || 2) / 2,
    );
    applyView(viewRef.current, target, Math.max((frameRequest.height || 4) * 4, 18));
  }, [frameRequest, applyView]);

  useEffect(() => {
    if (!controllerRef) return undefined;
    controllerRef.current = {
      frame: (position, h) =>
        applyView(
          viewRef.current,
          new THREE.Vector3(position.x, position.y, position.z + (h || 2) / 2),
          Math.max((h || 4) * 4, 18),
        ),
      fitAll: () => applyView(viewRef.current),
      setView: (name) => applyView(name),
      zoom: (factor) => {
        if (!controls) return;
        const direction = camera.position.clone().sub(controls.target);
        direction.multiplyScalar(factor);
        camera.position.copy(controls.target.clone().add(direction));
        controls.update();
        invalidate();
      },
      reset: () => applyView("iso"),
    };
    return () => {
      if (controllerRef.current) controllerRef.current = null;
    };
  }, [controllerRef, applyView, camera, controls, invalidate]);

  return null;
}

export function Viewer3D({
  items,
  lines,
  units,
  colorMode,
  systemIndex,
  showLines,
  showRack,
  showLabels,
  fadeFiltered, // true = fade, false = hide
  filteredTags, // Set of tags passing the page filters
  selectedTag,
  view,
  frameRequest,
  controllerRef,
  onSelect,
  onHoverTag,
  dark,
}) {
  const [hovered, setHovered] = useState(null);
  const bounds = useMemo(() => {
    if (!items.length) return null;
    const min = { x: Infinity, y: Infinity, z: 0 };
    const max = { x: -Infinity, y: -Infinity, z: 10 };
    for (const item of items) {
      const fp = item.footprint || 2;
      min.x = Math.min(min.x, item.position.x - fp);
      max.x = Math.max(max.x, item.position.x + fp);
      min.y = Math.min(min.y, item.position.y - fp);
      max.y = Math.max(max.y, item.position.y + fp);
      max.z = Math.max(max.z, item.position.z + (item.height || 2));
    }
    return { min, max };
  }, [items]);

  const handleHover = useCallback(
    (item) => {
      setHovered(item);
      onHoverTag?.(item?.tag || null);
    },
    [onHoverTag],
  );

  const colorFor = useCallback(
    (item) => colorForItem(colorMode, item, systemIndex),
    [colorMode, systemIndex],
  );

  const isDimmed = useCallback(
    (item) => filteredTags && !filteredTags.has(item.tag),
    [filteredTags],
  );

  const visibleItems = useMemo(
    () =>
      fadeFiltered ? items : items.filter((item) => !isDimmed(item)),
    [items, fadeFiltered, isDimmed],
  );

  // Instancing path when a single type exceeds the threshold.
  const { instancedGroups, regularItems } = useMemo(() => {
    const byType = new Map();
    for (const item of visibleItems) {
      if (!byType.has(item.typeCode)) byType.set(item.typeCode, []);
      byType.get(item.typeCode).push(item);
    }
    const instanced = [];
    const regular = [];
    for (const [typeCode, group] of byType) {
      if (group.length > INSTANCING_THRESHOLD) instanced.push(group);
      else regular.push(...group);
    }
    return { instancedGroups: instanced, regularItems: regular };
  }, [visibleItems]);

  const gridSize = Math.max(200, (bounds ? bounds.max.x - bounds.min.x : 100) + 80);

  return (
    <Canvas
      frameloop="demand"
      camera={{ position: [60, -80, 60], up: [0, 0, 1], fov: 45, near: 0.5, far: 4000 }}
      onPointerMissed={() => onSelect?.(null)}
      style={{ background: dark ? "#0b1220" : "#eef2f7" }}
    >
      <ambientLight intensity={0.75} />
      <directionalLight position={[80, -60, 120]} intensity={1.05} />
      <directionalLight position={[-60, 80, 40]} intensity={0.3} />
      {/* Z-up plant scene */}
      <group rotation={[0, 0, 0]}>
        <gridHelper
          args={[gridSize, Math.round(gridSize / 6), 0xc3cede, GRID_COLOR]}
          rotation={[Math.PI / 2, 0, 0]}
          position={[gridSize / 2 - 20, 0, 0]}
        />
        {showRack && <PipeRack units={units} />}
        {instancedGroups.map((group) => (
          <InstancedEquipmentGroup
            key={group[0].typeCode}
            items={group}
            colorMode={colorMode}
            colorFor={colorFor}
            selectedTag={selectedTag}
            onSelect={onSelect}
          />
        ))}
        {regularItems.map((item) => (
          <EquipmentMesh
            key={item.tag}
            item={item}
            color={colorFor(item)}
            selected={item.tag === selectedTag}
            hovered={hovered?.tag === item.tag}
            dimmed={isDimmed(item)}
            showLabel={showLabels}
            onSelect={onSelect}
            onHover={handleHover}
          />
        ))}
        {showLines &&
          lines
            .filter((line) => line.routed)
            .map((line) => (
              <PipeRun
                key={line.lineNo}
                line={line}
                highlighted={false}
                dimmed={false}
              />
            ))}
        {hovered && (
          <Html
            position={[
              hovered.position.x,
              hovered.position.y,
              hovered.position.z + hovered.height + 2.5,
            ]}
            center
            style={tooltipStyle}
          >
            {hovered.tag} · {hovered.description || "No description"}
          </Html>
        )}
      </group>
      <OrbitControls
        makeDefault
        enableDamping={false}
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
      />
      <CameraRig
        controllerRef={controllerRef}
        bounds={bounds}
        view={view}
        frameRequest={frameRequest}
      />
    </Canvas>
  );
}
