import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

export type VegetableType =
  | 'tomato'
  | 'carrot'
  | 'broccoli'
  | 'capsicum'
  | 'spinach'
  | 'eggplant'
  | 'potato'
  | 'chilli';

interface VegetableModelProps {
  type?: VegetableType | string;
  scale?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  animate?: boolean;
  floatSpeed?: number;
  rotSpeed?: number;
}

// -------------------------------------------------------------
// 1. Procedural High-Fidelity 3D Tomato
// -------------------------------------------------------------
const TomatoModel: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
  return (
    <group scale={scale}>
      {/* Tomato Body (Glossy Crimson Squashed Sphere) */}
      <mesh castShadow receiveShadow scale={[1.1, 0.95, 1.1]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshPhysicalMaterial
          color="#d62828"
          roughness={0.18}
          metalness={0.05}
          clearcoat={0.65}
          clearcoatRoughness={0.2}
          reflectivity={0.6}
        />
      </mesh>

      {/* Indented Top Crown */}
      <mesh position={[0, 0.9, 0]} scale={[0.3, 0.1, 0.3]}>
        <cylinderGeometry args={[0.2, 0.4, 0.2, 16]} />
        <meshStandardMaterial color="#8b0000" roughness={0.5} />
      </mesh>

      {/* Calyx (5-point green star sepals) */}
      <group position={[0, 0.95, 0]}>
        {[0, 72, 144, 216, 288].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          return (
            <mesh
              key={i}
              position={[Math.cos(rad) * 0.35, 0.05, Math.sin(rad) * 0.35]}
              rotation={[0.2, -rad, -0.4]}
              castShadow
            >
              <coneGeometry args={[0.12, 0.5, 5]} />
              <meshStandardMaterial color="#2d6a4f" roughness={0.4} />
            </mesh>
          );
        })}

        {/* Stem */}
        <mesh position={[0, 0.3, 0]} rotation={[0.1, 0, 0.2]} castShadow>
          <cylinderGeometry args={[0.06, 0.08, 0.6, 12]} />
          <meshStandardMaterial color="#1b4332" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
};

// -------------------------------------------------------------
// 2. Procedural High-Fidelity 3D Carrot
// -------------------------------------------------------------
const CarrotModel: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
  return (
    <group scale={scale} rotation={[0, 0, 0.35]}>
      {/* Tapered Carrot Root Body */}
      <mesh position={[0, -0.8, 0]} rotation={[0, 0, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.48, 2.2, 24]} />
        <meshStandardMaterial
          color="#ea580c"
          roughness={0.42}
          metalness={0.05}
        />
      </mesh>

      {/* Subtle Horizontal Root Rings */}
      {[-0.2, -0.6, -1.0, -1.4].map((y, idx) => (
        <mesh key={idx} position={[0, y, 0]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.42 + y * 0.18, 0.015, 8, 24]} />
          <meshStandardMaterial color="#c2410c" roughness={0.6} />
        </mesh>
      ))}

      {/* Rounded Top Crown */}
      <mesh position={[0, 0.3, 0]} scale={[1, 0.4, 1]}>
        <sphereGeometry args={[0.46, 20, 16]} />
        <meshStandardMaterial color="#c2410c" roughness={0.4} />
      </mesh>

      {/* Feathery Leafy Stems on Top */}
      <group position={[0, 0.45, 0]}>
        {[-0.25, 0, 0.25].map((x, i) => (
          <group key={i} position={[x, 0, (i % 2) * 0.1]} rotation={[0, i * 0.6, (i - 1) * 0.25]}>
            <mesh position={[0, 0.5, 0]} castShadow>
              <cylinderGeometry args={[0.04, 0.06, 1.0, 8]} />
              <meshStandardMaterial color="#2e8b57" roughness={0.4} />
            </mesh>
            <mesh position={[0, 1.0, 0]} rotation={[0, 0, 0.2]}>
              <coneGeometry args={[0.2, 0.7, 6]} />
              <meshStandardMaterial color="#52b788" roughness={0.5} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
};

// -------------------------------------------------------------
// 3. Procedural High-Fidelity 3D Broccoli
// -------------------------------------------------------------
const BroccoliModel: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
  return (
    <group scale={scale}>
      {/* Main Pale Green Stalk */}
      <mesh position={[0, -0.6, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.38, 0.48, 1.2, 16]} />
        <meshStandardMaterial color="#b7e4c7" roughness={0.5} />
      </mesh>

      {/* Dense Emerald Floret Clusters */}
      <group position={[0, 0.2, 0]}>
        {/* Central main dome */}
        <mesh position={[0, 0.3, 0]} castShadow>
          <sphereGeometry args={[0.6, 24, 24]} />
          <meshStandardMaterial color="#2d6a4f" roughness={0.85} />
        </mesh>

        {/* Outer orbital florets */}
        {[
          [0.45, 0.15, 0],
          [-0.45, 0.15, 0],
          [0, 0.15, 0.45],
          [0, 0.15, -0.45],
          [0.32, 0.25, 0.32],
          [-0.32, 0.25, 0.32],
          [0.32, 0.25, -0.32],
          [-0.32, 0.25, -0.32],
        ].map((pos, idx) => (
          <mesh key={idx} position={pos as [number, number, number]} castShadow>
            <sphereGeometry args={[0.38, 16, 16]} />
            <meshStandardMaterial color={idx % 2 === 0 ? '#1b4332' : '#2d6a4f'} roughness={0.88} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

// -------------------------------------------------------------
// 4. Procedural High-Fidelity 3D Capsicum (Bell Pepper)
// -------------------------------------------------------------
const CapsicumModel: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
  return (
    <group scale={scale}>
      {/* 4 Organic Lobes */}
      <group position={[0, -0.1, 0]}>
        {[
          [0.32, 0, 0.32],
          [-0.32, 0, 0.32],
          [0.32, 0, -0.32],
          [-0.32, 0, -0.32],
        ].map((pos, idx) => (
          <mesh
            key={idx}
            position={pos as [number, number, number]}
            scale={[0.7, 1.1, 0.7]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[0.65, 20, 20]} />
            <meshPhysicalMaterial
              color="#2d6a4f"
              roughness={0.25}
              clearcoat={0.6}
              clearcoatRoughness={0.2}
            />
          </mesh>
        ))}
      </group>

      {/* Crown Indentation & Curved Stalk */}
      <mesh position={[0, 0.65, 0]} rotation={[0.2, 0, 0.2]} castShadow>
        <cylinderGeometry args={[0.08, 0.12, 0.55, 12]} />
        <meshStandardMaterial color="#1b4332" roughness={0.4} />
      </mesh>
    </group>
  );
};

// -------------------------------------------------------------
// 5. Procedural High-Fidelity 3D Leafy Greens / Spinach
// -------------------------------------------------------------
const SpinachModel: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
  return (
    <group scale={scale} rotation={[0.3, 0.4, 0]}>
      {/* Primary Leaf Blade */}
      <mesh castShadow receiveShadow scale={[0.8, 1.4, 0.12]}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial
          color="#2e8b57"
          roughness={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Central Leaf Vein */}
      <mesh position={[0, 0, 0.08]} scale={[0.04, 1.3, 0.04]}>
        <cylinderGeometry args={[1, 1.2, 1, 8]} />
        <meshStandardMaterial color="#95d5b2" roughness={0.4} />
      </mesh>

      {/* Second overlapping young leaf */}
      <mesh
        position={[-0.3, -0.2, 0.15]}
        rotation={[0.2, -0.4, -0.3]}
        scale={[0.6, 1.1, 0.08]}
        castShadow
      >
        <sphereGeometry args={[1, 20, 20]} />
        <meshStandardMaterial
          color="#38b000"
          roughness={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};

// -------------------------------------------------------------
// 6. Procedural High-Fidelity 3D Eggplant / Brinjal
// -------------------------------------------------------------
const EggplantModel: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
  return (
    <group scale={scale} rotation={[0.2, 0, 0.15]}>
      {/* Glossy Indigo Pear Body */}
      <mesh position={[0, -0.4, 0]} scale={[0.85, 1.3, 0.85]} castShadow receiveShadow>
        <sphereGeometry args={[1, 32, 32]} />
        <meshPhysicalMaterial
          color="#3a0ca3"
          roughness={0.15}
          clearcoat={0.7}
          clearcoatRoughness={0.15}
        />
      </mesh>

      {/* Calyx & Stem */}
      <group position={[0, 0.8, 0]}>
        {[0, 90, 180, 270].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          return (
            <mesh
              key={i}
              position={[Math.cos(rad) * 0.35, 0, Math.sin(rad) * 0.35]}
              rotation={[0.3, -rad, -0.4]}
              castShadow
            >
              <coneGeometry args={[0.15, 0.5, 4]} />
              <meshStandardMaterial color="#2d6a4f" roughness={0.4} />
            </mesh>
          );
        })}
        <mesh position={[0, 0.3, 0]} rotation={[0.15, 0, 0.15]} castShadow>
          <cylinderGeometry args={[0.08, 0.1, 0.5, 12]} />
          <meshStandardMaterial color="#1b4332" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
};

// -------------------------------------------------------------
// Master Vegetable Component with Float & Rotation Animation
// -------------------------------------------------------------
export const VegetableModel: React.FC<VegetableModelProps> = ({
  type = 'tomato',
  scale = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  animate = true,
  floatSpeed = 1.2,
  rotSpeed = 0.6,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const initialY = position[1];
  const timeOffset = useRef(Math.random() * 100);

  useFrame((state, delta) => {
    if (!animate || !groupRef.current) return;
    const t = state.clock.getElapsedTime() + timeOffset.current;

    // Gentle floating bob
    groupRef.current.position.y = initialY + Math.sin(t * floatSpeed) * 0.12;

    // Subtle gentle continuous rotation
    groupRef.current.rotation.y += delta * rotSpeed * 0.4;
    groupRef.current.rotation.x = rotation[0] + Math.cos(t * floatSpeed * 0.7) * 0.08;
    groupRef.current.rotation.z = rotation[2] + Math.sin(t * floatSpeed * 0.5) * 0.08;
  });

  const normalizedType = String(type).toLowerCase();

  const renderVegetable = () => {
    if (normalizedType.includes('carrot') || normalizedType.includes('root') || normalizedType.includes('radish')) {
      return <CarrotModel scale={scale} />;
    }
    if (normalizedType.includes('broccoli') || normalizedType.includes('cauliflower')) {
      return <BroccoliModel scale={scale} />;
    }
    if (normalizedType.includes('capsicum') || normalizedType.includes('pepper') || normalizedType.includes('gourd')) {
      return <CapsicumModel scale={scale} />;
    }
    if (normalizedType.includes('spinach') || normalizedType.includes('palak') || normalizedType.includes('leaf') || normalizedType.includes('methi') || normalizedType.includes('coriander')) {
      return <SpinachModel scale={scale} />;
    }
    if (normalizedType.includes('eggplant') || normalizedType.includes('brinjal') || normalizedType.includes('baingan')) {
      return <EggplantModel scale={scale} />;
    }
    // Default to rich glossy tomato
    return <TomatoModel scale={scale} />;
  };

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
    >
      {renderVegetable()}
    </group>
  );
};
