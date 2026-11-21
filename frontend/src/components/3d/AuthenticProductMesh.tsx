import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface AuthenticProductMeshProps {
  meshType:
    | 'cucumber'
    | 'tomato'
    | 'carrot'
    | 'potato'
    | 'onion'
    | 'lady-finger'
    | 'chilli'
    | string;
  scale?: number;
}

// -------------------------------------------------------------
// 1. Botanical 3D Green Cucumber (Kheera)
// Elongated gently curved form with subtle ridges and stem node
// -------------------------------------------------------------
const CucumberMesh: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
  const curve = useMemo(() => {
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -1.3, 0),
      new THREE.Vector3(0.08, -0.6, 0.04),
      new THREE.Vector3(0.12, 0, 0.05),
      new THREE.Vector3(0.06, 0.7, 0.02),
      new THREE.Vector3(0, 1.3, 0),
    ]);
  }, []);

  return (
    <group scale={scale} rotation={[0, 0, 0.15]}>
      {/* Main Cucumber Body (Tube along organic curve) */}
      <mesh castShadow receiveShadow>
        <tubeGeometry args={[curve, 32, 0.38, 16, false]} />
        <meshPhysicalMaterial
          color="#2d6a4f"
          roughness={0.28}
          metalness={0.06}
          clearcoat={0.45}
          clearcoatRoughness={0.25}
          reflectivity={0.6}
        />
      </mesh>

      {/* Tapered Bottom Blossom End */}
      <mesh position={[0, -1.32, 0]} scale={[0.36, 0.22, 0.36]} castShadow>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial color="#1b4332" roughness={0.4} />
      </mesh>

      {/* Top Stem Node */}
      <group position={[0, 1.32, 0]}>
        <mesh scale={[0.34, 0.15, 0.34]} castShadow>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial color="#1e4620" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.2, 0]} rotation={[0.1, 0, 0.15]} castShadow>
          <cylinderGeometry args={[0.06, 0.09, 0.4, 10]} />
          <meshStandardMaterial color="#14361b" roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
};

// -------------------------------------------------------------
// 2. Botanical 3D Tomato
// Oblate organic spheroid with top indentation, 5-sepaled calyx & stem
// -------------------------------------------------------------
const TomatoMesh: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
  return (
    <group scale={scale}>
      {/* Glossy Crimson Body */}
      <mesh castShadow receiveShadow scale={[1.15, 0.96, 1.15]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshPhysicalMaterial
          color="#dc2626"
          roughness={0.16}
          metalness={0.05}
          clearcoat={0.7}
          clearcoatRoughness={0.18}
          reflectivity={0.65}
        />
      </mesh>

      {/* Top Indentation */}
      <mesh position={[0, 0.92, 0]} scale={[0.3, 0.08, 0.3]}>
        <cylinderGeometry args={[0.2, 0.4, 0.2, 16]} />
        <meshStandardMaterial color="#991b1b" roughness={0.5} />
      </mesh>

      {/* 5-Sepal Calyx & Stem */}
      <group position={[0, 0.94, 0]}>
        {[0, 72, 144, 216, 288].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          return (
            <mesh
              key={i}
              position={[Math.cos(rad) * 0.36, 0.04, Math.sin(rad) * 0.36]}
              rotation={[0.2, -rad, -0.38]}
              castShadow
            >
              <coneGeometry args={[0.12, 0.48, 5]} />
              <meshStandardMaterial color="#16a34a" roughness={0.4} />
            </mesh>
          );
        })}
        <mesh position={[0, 0.28, 0]} rotation={[0.08, 0, 0.18]} castShadow>
          <cylinderGeometry args={[0.05, 0.08, 0.55, 10]} />
          <meshStandardMaterial color="#14532d" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
};

// -------------------------------------------------------------
// 3. Botanical 3D Carrot
// Tapered root with horizontal rings and green leafy crown
// -------------------------------------------------------------
const CarrotMesh: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
  return (
    <group scale={scale} rotation={[0, 0, 0.25]}>
      {/* Tapered Orange Root Body */}
      <mesh position={[0, -0.85, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.48, 2.3, 24]} />
        <meshStandardMaterial color="#ea580c" roughness={0.38} metalness={0.05} />
      </mesh>

      {/* Horizontal Root Growth Rings */}
      {[-0.2, -0.6, -1.0, -1.4, -1.8].map((y, idx) => (
        <mesh key={idx} position={[0, y, 0]}>
          <torusGeometry args={[0.44 + y * 0.18, 0.016, 8, 24]} />
          <meshStandardMaterial color="#c2410c" roughness={0.55} />
        </mesh>
      ))}

      {/* Rounded Top Shoulder */}
      <mesh position={[0, 0.3, 0]} scale={[0.48, 0.18, 0.48]} castShadow>
        <sphereGeometry args={[1, 20, 14]} />
        <meshStandardMaterial color="#9a3412" roughness={0.5} />
      </mesh>

      {/* Feathering Leafy Green Crown */}
      <group position={[0, 0.42, 0]}>
        {[0, 60, 120, 180, 240, 300].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          return (
            <mesh
              key={i}
              position={[Math.cos(rad) * 0.14, 0.35, Math.sin(rad) * 0.14]}
              rotation={[0.3, rad, 0.2]}
              castShadow
            >
              <coneGeometry args={[0.09, 0.75, 5]} />
              <meshStandardMaterial color="#16a34a" roughness={0.4} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
};

// -------------------------------------------------------------
// 4. Botanical 3D Earthy Potato
// Natural asymmetric ellipsoid with surface dimples
// -------------------------------------------------------------
const PotatoMesh: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
  return (
    <group scale={scale} rotation={[0.2, 0.4, 0]}>
      <mesh castShadow receiveShadow scale={[1.25, 0.9, 0.95]}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial color="#a16207" roughness={0.65} metalness={0.05} />
      </mesh>
      {/* Subtle Surface Indentations / Eyes */}
      {[
        [0.6, 0.3, 0.5],
        [-0.5, -0.2, 0.6],
        [0.2, -0.5, -0.5],
        [-0.7, 0.2, -0.4],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} scale={[0.12, 0.08, 0.12]}>
          <sphereGeometry args={[1, 10, 10]} />
          <meshStandardMaterial color="#713f12" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
};

// -------------------------------------------------------------
// 5. Botanical 3D Fresh Onion
// Bulbous form with papery neck and delicate root tuft
// -------------------------------------------------------------
const OnionMesh: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
  return (
    <group scale={scale}>
      {/* Bulbous Body */}
      <mesh castShadow receiveShadow scale={[1.05, 0.95, 1.05]}>
        <sphereGeometry args={[1, 28, 28]} />
        <meshPhysicalMaterial
          color="#c2410c"
          roughness={0.24}
          metalness={0.08}
          clearcoat={0.5}
          clearcoatRoughness={0.25}
        />
      </mesh>

      {/* Tapered Papery Neck at Top */}
      <mesh position={[0, 1.05, 0]} scale={[0.24, 0.45, 0.24]} castShadow>
        <coneGeometry args={[1, 1, 16]} />
        <meshStandardMaterial color="#9a3412" roughness={0.4} />
      </mesh>

      {/* Root Base Plate at Bottom */}
      <mesh position={[0, -0.96, 0]} scale={[0.28, 0.1, 0.28]}>
        <cylinderGeometry args={[0.3, 0.6, 0.3, 12]} />
        <meshStandardMaterial color="#78350f" roughness={0.7} />
      </mesh>
    </group>
  );
};

// -------------------------------------------------------------
// 6. Botanical 3D Lady Finger (Bhindi)
// 5-ridged pentagonal pyramid with tapered tail and stem cap
// -------------------------------------------------------------
const LadyFingerMesh: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
  return (
    <group scale={scale} rotation={[0, 0, 0.2]}>
      {/* Slender 5-sided Body */}
      <mesh position={[0, -0.6, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.26, 0.08, 2.0, 5]} />
        <meshStandardMaterial color="#15803d" roughness={0.35} metalness={0.06} />
      </mesh>

      {/* Tapered Tail */}
      <mesh position={[0, -1.7, 0]} castShadow>
        <coneGeometry args={[0.08, 0.4, 5]} />
        <meshStandardMaterial color="#166534" roughness={0.4} />
      </mesh>

      {/* Pentagonal Stem Cap at Top */}
      <group position={[0, 0.48, 0]}>
        <mesh scale={[0.3, 0.12, 0.3]} castShadow>
          <cylinderGeometry args={[0.28, 0.32, 0.3, 5]} />
          <meshStandardMaterial color="#14532d" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.22, 0]} rotation={[0.08, 0, 0.12]} castShadow>
          <cylinderGeometry args={[0.05, 0.07, 0.32, 8]} />
          <meshStandardMaterial color="#052e16" roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
};

// -------------------------------------------------------------
// 7. Botanical 3D Green Chilli
// Slender curved horn shape with calyx stem
// -------------------------------------------------------------
const ChilliMesh: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
  const curve = useMemo(() => {
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -1.2, 0),
      new THREE.Vector3(0.12, -0.5, 0.05),
      new THREE.Vector3(0.15, 0.2, 0.08),
      new THREE.Vector3(0.04, 0.8, 0.02),
      new THREE.Vector3(0, 1.1, 0),
    ]);
  }, []);

  return (
    <group scale={scale} rotation={[0, 0, 0.18]}>
      <mesh castShadow receiveShadow>
        <tubeGeometry args={[curve, 28, 0.16, 12, false]} />
        <meshPhysicalMaterial
          color="#16a34a"
          roughness={0.2}
          metalness={0.05}
          clearcoat={0.65}
          clearcoatRoughness={0.2}
        />
      </mesh>
      {/* Green Calyx Cap */}
      <mesh position={[0, 1.12, 0]} scale={[0.18, 0.14, 0.18]} castShadow>
        <sphereGeometry args={[1, 10, 10]} />
        <meshStandardMaterial color="#14532d" roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.3, 0]} rotation={[0.2, 0, 0.2]} castShadow>
        <cylinderGeometry args={[0.03, 0.05, 0.3, 8]} />
        <meshStandardMaterial color="#052e16" roughness={0.5} />
      </mesh>
    </group>
  );
};

export const AuthenticProductMesh: React.FC<AuthenticProductMeshProps> = ({
  meshType,
  scale = 1.3,
}) => {
  const groupRef = React.useRef<THREE.Group>(null);

  // Subtle breathing idle float
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    groupRef.current.position.y = Math.sin(t * 1.5) * 0.06;
  });

  return (
    <group ref={groupRef} scale={scale}>
      {meshType === 'cucumber' && <CucumberMesh />}
      {meshType === 'tomato' && <TomatoMesh />}
      {meshType === 'carrot' && <CarrotMesh />}
      {meshType === 'potato' && <PotatoMesh />}
      {meshType === 'onion' && <OnionMesh />}
      {meshType === 'lady-finger' && <LadyFingerMesh />}
      {meshType === 'chilli' && <ChilliMesh />}

      {/* Contact Shadow Below Produce */}
      <mesh position={[0, -1.8, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[6, 6]} />
        <shadowMaterial opacity={0.35} />
      </mesh>
    </group>
  );
};
