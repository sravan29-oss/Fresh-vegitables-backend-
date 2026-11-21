import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { LightingSetup } from './LightingSetup';
import { VegetableModel } from './VegetableModel';

interface FloatingVegetablesProps {
  interactive?: boolean;
}

// Gentle floating natural pollen/dew particles
const NatureParticles: React.FC = () => {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 35;

  const [positions] = React.useState(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    return pos;
  });

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y += delta * 0.03;
    pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.05;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        color="#a3d977"
        transparent
        opacity={0.65}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

export const FloatingVegetables: React.FC<FloatingVegetablesProps> = ({
  interactive = true,
}) => {
  const sceneGroupRef = useRef<THREE.Group>(null);
  const mousePos = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    if (!sceneGroupRef.current) return;

    if (interactive) {
      // Smooth lerp toward mouse coordinates for cinematic parallax
      const targetX = (state.pointer.x * Math.PI) / 10;
      const targetY = (-state.pointer.y * Math.PI) / 12;

      sceneGroupRef.current.rotation.y = THREE.MathUtils.damp(
        sceneGroupRef.current.rotation.y,
        targetX,
        2.5,
        delta
      );
      sceneGroupRef.current.rotation.x = THREE.MathUtils.damp(
        sceneGroupRef.current.rotation.x,
        targetY,
        2.5,
        delta
      );
    }
  });

  return (
    <>
      <LightingSetup intensity={1.1} />

      <group ref={sceneGroupRef}>
        {/* Central Hero Tomato */}
        <VegetableModel
          type="tomato"
          scale={0.85}
          position={[0.2, 0.1, 0.4]}
          rotation={[0.2, 0.4, -0.1]}
          floatSpeed={1.1}
          rotSpeed={0.5}
        />

        {/* Crisp Carrot at Angle (Top Right) */}
        <VegetableModel
          type="carrot"
          scale={0.7}
          position={[2.4, 0.7, -0.6]}
          rotation={[-0.3, 0.8, -0.6]}
          floatSpeed={1.3}
          rotSpeed={0.7}
        />

        {/* Emerald Broccoli (Left) */}
        <VegetableModel
          type="broccoli"
          scale={0.8}
          position={[-2.2, 0.4, -0.3]}
          rotation={[0.3, -0.5, 0.2]}
          floatSpeed={0.9}
          rotSpeed={0.4}
        />

        {/* Bell Pepper / Capsicum (Bottom Right) */}
        <VegetableModel
          type="capsicum"
          scale={0.75}
          position={[1.8, -1.2, 0.2]}
          rotation={[0.4, 0.6, -0.2]}
          floatSpeed={1.2}
          rotSpeed={0.6}
        />

        {/* Fresh Leafy Spinach (Bottom Left) */}
        <VegetableModel
          type="spinach"
          scale={0.8}
          position={[-1.6, -1.1, 0.5]}
          rotation={[-0.2, 0.7, 0.3]}
          floatSpeed={1.4}
          rotSpeed={0.8}
        />

        {/* Deep Glossy Eggplant (Distant Background Center-Top) */}
        <VegetableModel
          type="eggplant"
          scale={0.55}
          position={[-0.6, 1.4, -1.5]}
          rotation={[0.2, -0.3, -0.4]}
          floatSpeed={0.8}
          rotSpeed={0.3}
        />

        {/* Ambient Organic Floating Pollen */}
        <NatureParticles />
      </group>
    </>
  );
};
