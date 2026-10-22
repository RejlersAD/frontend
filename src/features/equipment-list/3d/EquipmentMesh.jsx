import React from "react";
import { Html, Instances, Instance } from "@react-three/drei";
import { SELECTED_EMISSIVE, FILTERED_OPACITY } from "./colors";

/**
 * Parametric equipment mesh. The scene group is rotated so the model works
 * in Z-up plant coordinates (x east, y north, z elevation of item base).
 */

const labelStyle = {
  fontSize: 11,
  fontFamily: "var(--rd-font-mono, monospace)",
  background: "rgba(255,255,255,0.92)",
  border: "1px solid #cbd5e1",
  borderRadius: 4,
  padding: "1px 5px",
  whiteSpace: "nowrap",
  color: "#132746",
  pointerEvents: "none",
};

function Material({ color, selected, hovered, dimmed }) {
  return (
    <meshStandardMaterial
      color={color}
      transparent={dimmed}
      opacity={dimmed ? FILTERED_OPACITY : 1}
      emissive={selected ? SELECTED_EMISSIVE : hovered ? "#0B1B3A" : "#000000"}
      emissiveIntensity={selected ? 0.35 : hovered ? 0.15 : 0}
      roughness={0.65}
      metalness={0.15}
    />
  );
}

function ShapeGeometry({ item, matProps }) {
  const { dims, shapeKind } = item;
  switch (shapeKind) {
    case "column":
    case "vessel":
    case "filter":
    case "tank": {
      const r = (dims.diameter || 1) / 2;
      const h = dims.height || 2;
      return (
        // Cylinder geometry is Y-axis aligned; rotate +90° about X so the
        // axis points along local Z (plant up).
        <mesh position={[0, 0, h / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[r, r, h, 20]} />
          <Material {...matProps} />
        </mesh>
      );
    }
    case "drum":
    case "exchanger": {
      const r = (dims.diameter || 1) / 2;
      const len = dims.length || 4;
      // Horizontal cylinder lying east-west (axis along X), on saddles.
      return (
        <group>
          <mesh position={[0, 0, r + 0.4]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[r, r, len, 16]} />
            <Material {...matProps} />
          </mesh>
          <mesh position={[-len / 4, 0, 0.2]}>
            <boxGeometry args={[0.3, r * 1.6, 0.4]} />
            <Material {...matProps} />
          </mesh>
          <mesh position={[len / 4, 0, 0.2]}>
            <boxGeometry args={[0.3, r * 1.6, 0.4]} />
            <Material {...matProps} />
          </mesh>
        </group>
      );
    }
    case "airCooler":
      return (
        <mesh position={[0, 0, (dims.height || 1.5) / 2]}>
          <boxGeometry args={[dims.length || 5, dims.width || 5, dims.height || 1.5]} />
          <Material {...matProps} />
        </mesh>
      );
    case "pump":
      return (
        <group>
          <mesh position={[-0.5, 0, 0.4]}>
            <boxGeometry args={[1.6, 0.8, 0.8]} />
            <Material {...matProps} />
          </mesh>
          <mesh position={[0.8, 0, 0.3]}>
            <boxGeometry args={[1.0, 0.6, 0.6]} />
            <Material {...matProps} />
          </mesh>
        </group>
      );
    case "compressor":
      return (
        <mesh position={[0, 0, (dims.height || 3) / 2]}>
          <boxGeometry args={[dims.width || 4, dims.length || 3, dims.height || 3]} />
          <Material {...matProps} />
        </mesh>
      );
    default:
      return (
        <group>
          <mesh position={[0, 0, (dims.height || 2) / 2]}>
            <boxGeometry args={[dims.width || 2, dims.length || 2, dims.height || 2]} />
            <Material {...matProps} />
          </mesh>
          <Html position={[0, 0, (dims.height || 2) + 0.6]} center style={labelStyle}>
            ?
          </Html>
        </group>
      );
  }
}

export function EquipmentMesh({
  item,
  color,
  selected,
  hovered,
  dimmed,
  showLabel,
  onSelect,
  onHover,
}) {
  const { position } = item;
  const matProps = { color, selected, hovered, dimmed };
  return (
    <group
      position={[position.x, position.y, position.z]}
      rotation={[0, 0, ((position.rotationDeg || 0) * Math.PI) / 180]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.(item);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        onHover?.(item);
      }}
      onPointerOut={() => onHover?.(null)}
    >
      <ShapeGeometry item={item} matProps={matProps} />
      {showLabel && !dimmed && (
        <Html
          position={[0, 0, item.height + 1.2]}
          center
          style={{ ...labelStyle, fontWeight: selected ? 700 : 500 }}
        >
          {item.tag}
        </Html>
      )}
    </group>
  );
}

/**
 * Instanced rendering for large same-type groups (> 200 items).
 * Only simple kinds are instanced; complex groups fall back to meshes.
 */
export function InstancedEquipmentGroup({
  items,
  colorMode,
  colorFor,
  selectedTag,
  onSelect,
}) {
  const boxes = items.filter((i) =>
    ["compressor", "airCooler", "unknown"].includes(i.shapeKind),
  );
  const cylinders = items.filter((i) =>
    ["column", "vessel", "filter", "tank"].includes(i.shapeKind),
  );
  const rest = items.filter((i) => !boxes.includes(i) && !cylinders.includes(i));

  return (
    <group>
      {boxes.length > 0 && (
        <Instances limit={boxes.length} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial roughness={0.65} metalness={0.15} />
          {boxes.map((item) => (
            <Instance
              key={item.tag}
              color={colorFor(item)}
              position={[
                item.position.x,
                item.position.y,
                item.position.z + item.height / 2,
              ]}
              scale={[item.dims.width || 2, item.dims.length || 2, item.height]}
              onClick={(event) => {
                event.stopPropagation();
                onSelect?.(item);
              }}
            />
          ))}
        </Instances>
      )}
      {cylinders.length > 0 && (
        <Instances limit={cylinders.length}>
          <cylinderGeometry args={[0.5, 0.5, 1, 12]} />
          <meshStandardMaterial roughness={0.65} metalness={0.15} />
          {cylinders.map((item) => (
            <Instance
              key={item.tag}
              color={colorFor(item)}
              position={[
                item.position.x,
                item.position.y,
                item.position.z + item.height / 2,
              ]}
              scale={[item.dims.diameter || 1, item.height, item.dims.diameter || 1]}
              rotation={[Math.PI / 2, 0, 0]}
              onClick={(event) => {
                event.stopPropagation();
                onSelect?.(item);
              }}
            />
          ))}
        </Instances>
      )}
      {rest.map((item) => (
        <EquipmentMesh
          key={item.tag}
          item={item}
          color={colorFor(item)}
          selected={item.tag === selectedTag}
          hovered={false}
          dimmed={false}
          showLabel={false}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

export const INSTANCING_THRESHOLD = 200;
