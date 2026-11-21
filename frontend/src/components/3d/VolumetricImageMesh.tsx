import React, { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Product3DProfile } from '../../services/product3dRegistry';

interface VolumetricImageMeshProps {
  imageUrl: string;
  profile: Product3DProfile;
  scale?: number;
}

export const VolumetricImageMesh: React.FC<VolumetricImageMeshProps> = ({
  imageUrl,
  profile,
  scale = 1.2,
}) => {
  const meshRef = React.useRef<THREE.Group>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [aspect, setAspect] = useState<number>(profile.aspectRatio || 1);

  // Load the original product image safely as a Three.js texture
  useEffect(() => {
    let isMounted = true;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    // Also measure native image dimensions to guarantee zero distortion
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!isMounted) return;
      if (img.naturalWidth && img.naturalHeight) {
        setAspect(img.naturalWidth / img.naturalHeight);
      }
    };
    img.src = imageUrl;

    loader.load(
      imageUrl,
      (loadedTex) => {
        if (!isMounted) return;
        loadedTex.colorSpace = THREE.SRGBColorSpace;
        loadedTex.generateMipmaps = true;
        loadedTex.minFilter = THREE.LinearMipmapLinearFilter;
        loadedTex.magFilter = THREE.LinearFilter;
        setTexture(loadedTex);
      },
      undefined,
      (err) => {
        console.warn('[VolumetricImageMesh] Texture load error, falling back:', err);
      }
    );

    return () => {
      isMounted = false;
    };
  }, [imageUrl]);

  // Compute realistic physical dimensions based on aspect ratio
  const { width, height, depth } = useMemo(() => {
    const baseSize = 2.4;
    let w = baseSize;
    let h = baseSize;

    if (aspect >= 1) {
      w = baseSize * Math.min(aspect, 1.4);
      h = w / aspect;
    } else {
      h = baseSize * Math.min(1 / aspect, 1.5);
      w = h * aspect;
    }

    const d = (profile.depth || 0.25) * (w > h ? 0.9 : 1.1);
    return { width: w, height: h, depth: d };
  }, [aspect, profile.depth]);

  // Subtle natural idle float
  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    meshRef.current.position.y = Math.sin(t * 1.4) * 0.06;
  });

  return (
    <group ref={meshRef} scale={scale}>
      {/* Front Face: High-Resolution Original Image with Clearcoat Specular */}
      <mesh position={[0, 0, depth / 2]} castShadow receiveShadow>
        <planeGeometry args={[width, height, 32, 32]} />
        {texture ? (
          <meshPhysicalMaterial
            map={texture}
            transparent={true}
            roughness={profile.roughness || 0.28}
            metalness={0.05}
            clearcoat={profile.clearcoat || 0.45}
            clearcoatRoughness={0.2}
            reflectivity={0.5}
            side={THREE.FrontSide}
          />
        ) : (
          <meshStandardMaterial color={profile.themeColor} roughness={0.4} />
        )}
      </mesh>

      {/* Volumetric Organic Core & Beveled Side Rim (Samples Product Hue) */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[width * 0.98, height * 0.98, depth]} />
        <meshPhysicalMaterial
          color={profile.themeColor}
          roughness={profile.roughness || 0.35}
          metalness={0.08}
          clearcoat={0.3}
          clearcoatRoughness={0.3}
        />
      </mesh>

      {/* Back Plate: Tactile Studio Finish */}
      <mesh position={[0, 0, -depth / 2]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[width * 0.98, height * 0.98]} />
        <meshStandardMaterial
          color="#1b3022"
          roughness={0.65}
          metalness={0.1}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* Contact Shadow Below Produce */}
      <mesh position={[0, -height / 2 - 0.35, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width * 1.5, width * 1.5]} />
        <shadowMaterial opacity={0.35} />
      </mesh>
    </group>
  );
};
