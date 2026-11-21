import React, { useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { LightingSetup } from './LightingSetup';
import { VegetableModel } from './VegetableModel';

// Raised soil bed row with crop sprouts
const CropBed: React.FC<{
  position: [number, number, number];
  cropType: 'carrot' | 'spinach' | 'tomato';
  count?: number;
}> = ({ position, cropType, count = 4 }) => {
  return (
    <group position={position}>
      {/* Raised soil mound */}
      <mesh position={[0, -0.05, 0]} receiveShadow castShadow>
        <boxGeometry args={[4.2, 0.25, 0.9]} />
        <meshStandardMaterial color="#3d2617" roughness={0.9} />
      </mesh>

      {/* Wooden planter border */}
      <mesh position={[0, 0, 0.48]}>
        <boxGeometry args={[4.3, 0.3, 0.08]} />
        <meshStandardMaterial color="#5c3d28" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, -0.48]}>
        <boxGeometry args={[4.3, 0.3, 0.08]} />
        <meshStandardMaterial color="#5c3d28" roughness={0.7} />
      </mesh>

      {/* Planted Vegetables in row */}
      {Array.from({ length: count }).map((_, i) => {
        const xOffset = -1.6 + (i * 3.2) / (count - 1);
        return (
          <group key={i} position={[xOffset, 0.15, 0]}>
            <VegetableModel
              type={cropType}
              scale={0.42}
              position={[0, 0, 0]}
              animate={false}
            />
          </group>
        );
      })}
    </group>
  );
};

// Farm Crate with harvest vegetables
const HarvestCrate: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  return (
    <group position={position}>
      {/* Wooden Crate Box */}
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.45, 0.7]} />
        <meshStandardMaterial color="#8b5a2b" roughness={0.7} />
      </mesh>
      {/* Fresh harvest tomatoes poking out */}
      <mesh position={[0.2, 0.45, 0.1]} castShadow>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color="#d62828" roughness={0.2} />
      </mesh>
      <mesh position={[-0.2, 0.45, -0.1]} castShadow>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshStandardMaterial color="#ea580c" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.48, 0]} castShadow>
        <sphereGeometry args={[0.17, 12, 12]} />
        <meshStandardMaterial color="#2d6a4f" roughness={0.4} />
      </mesh>
    </group>
  );
};

// Procedural Stylized Low-Poly Tree
const FarmTree: React.FC<{ position: [number, number, number]; scale?: number }> = ({
  position,
  scale = 1,
}) => {
  return (
    <group position={position} scale={scale}>
      {/* Trunk */}
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.26, 1.6, 8]} />
        <meshStandardMaterial color="#4a2e18" roughness={0.8} />
      </mesh>
      {/* Foliage Cones / Spheres */}
      <mesh position={[0, 2.0, 0]} castShadow>
        <coneGeometry args={[0.9, 1.4, 8]} />
        <meshStandardMaterial color="#2d6a4f" roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.7, 0]} castShadow>
        <coneGeometry args={[0.65, 1.2, 8]} />
        <meshStandardMaterial color="#40916c" roughness={0.6} />
      </mesh>
    </group>
  );
};

export const FarmScene: React.FC = () => {
  const farmGroupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!farmGroupRef.current) return;
    // Very gentle atmospheric sway
    farmGroupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.04;
  });

  return (
    <>
      <LightingSetup intensity={1.3} />

      <group ref={farmGroupRef}>
        {/* Soft Rolling Ground */}
        <mesh position={[0, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[24, 20]} />
          <meshStandardMaterial color="#2d5a27" roughness={0.85} />
        </mesh>

        {/* Central Farm Walking Path */}
        <mesh position={[0, -0.18, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[1.8, 18]} />
          <meshStandardMaterial color="#8c7853" roughness={0.9} />
        </mesh>

        {/* Garden Beds (Left Side) */}
        <CropBed position={[-3.2, 0, 2.2]} cropType="tomato" count={4} />
        <CropBed position={[-3.2, 0, 0.4]} cropType="spinach" count={5} />
        <CropBed position={[-3.2, 0, -1.4]} cropType="carrot" count={4} />

        {/* Garden Beds (Right Side) */}
        <CropBed position={[3.2, 0, 2.2]} cropType="carrot" count={4} />
        <CropBed position={[3.2, 0, 0.4]} cropType="tomato" count={4} />
        <CropBed position={[3.2, 0, -1.4]} cropType="spinach" count={5} />

        {/* Fresh Harvest Crates Along Path */}
        <HarvestCrate position={[-1.3, 0, 3.2]} />
        <HarvestCrate position={[1.3, 0, 1.2]} />

        {/* Perimeter Trees & Shrubs */}
        <FarmTree position={[-6.5, 0, -3.5]} scale={1.2} />
        <FarmTree position={[-5.8, 0, 4.0]} scale={0.95} />
        <FarmTree position={[6.2, 0, -2.8]} scale={1.1} />
        <FarmTree position={[6.6, 0, 3.8]} scale={1.0} />

        {/* Background Mountainous Organic Horizon */}
        <mesh position={[0, 1.5, -9]} castShadow>
          <sphereGeometry args={[10, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#1b4332" roughness={0.9} />
        </mesh>
      </group>

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={6}
        maxDistance={14}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.3}
        autoRotate={true}
        autoRotateSpeed={0.8}
        dampingFactor={0.05}
      />
    </>
  );
};
