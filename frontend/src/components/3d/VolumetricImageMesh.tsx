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

    // Measure native image dimensions to guarantee 1:1 zero distortion
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
        console.warn('[VolumetricImageMesh] Texture load warning:', err);
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

    const d = (profile.depth || 0.22) * (w > h ? 0.9 : 1.1);
    return { width: w, height: h, depth: d };
  }, [aspect, profile.depth]);

  // Subtle natural idle float
  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    meshRef.current.position.y = Math.sin(t * 1.4) * 0.05;
  });

  // Single solid watertight multi-material box:
  // Face 0: Right (+X) -> Organic theme rim
  // Face 1: Left (-X) -> Organic theme rim
  // Face 2: Top (+Y) -> Organic theme rim
  // Face 3: Bottom (-Y) -> Organic theme rim
  // Face 4: Front (+Z) -> Original product image texture
  // Face 5: Back (-Z) -> Studio matte backplate
  // This completely eliminates any co-planar Z-fighting or striped artifacts!
  const rimMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(profile.themeColor),
        roughness: profile.roughness || 0.35,
        metalness: 0.08,
        clearcoat: 0.35,
        clearcoatRoughness: 0.25,
      }),
    [profile.themeColor, profile.roughness]
  );

  const backMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#122316'),
        roughness: 0.65,
        metalness: 0.1,
      }),
    []
  );

  const frontMaterial = useMemo(() => {
    if (!texture) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(profile.themeColor),
        roughness: 0.4,
      });
    }
    return new THREE.MeshPhysicalMaterial({
      map: texture,
      roughness: profile.roughness || 0.25,
      metalness: 0.04,
      clearcoat: profile.clearcoat || 0.4,
      clearcoatRoughness: 0.2,
      reflectivity: 0.5,
    });
  }, [texture, profile.themeColor, profile.roughness, profile.clearcoat]);

  const materials = useMemo(
    () => [rimMaterial, rimMaterial, rimMaterial, rimMaterial, frontMaterial, backMaterial],
    [rimMaterial, frontMaterial, backMaterial]
  );

  return (
    <group ref={meshRef} scale={scale}>
      {/* Seamless Single-Mesh Solid Volumetric Product Slab */}
      <mesh
        castShadow
        receiveShadow
        material={materials}
      >
        <boxGeometry args={[width, height, depth]} />
      </mesh>

      {/* Soft Contact Shadow Below Produce */}
      <mesh position={[0, -height / 2 - 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width * 1.5, width * 1.5]} />
        <shadowMaterial opacity={0.3} />
      </mesh>
    </group>
  );
};
