import React, { useState, Suspense, useMemo } from 'react';
import { OrbitControls } from '@react-three/drei';
import { SceneCanvas } from './SceneCanvas';
import { LightingSetup } from './LightingSetup';
import { VolumetricImageMesh } from './VolumetricImageMesh';
import { AuthenticProductMesh } from './AuthenticProductMesh';
import {
  resolveProduct3DProfile,
  Product3DProfile,
} from '../../services/product3dRegistry';
import {
  Rotate3d,
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
  Sun,
  Layers,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { getProductImageUrl } from '../../utils/imageUrl';

interface ProductViewerProps {
  productName: string;
  categorySlug?: string;
  slug?: string;
  productId?: string;
  imageUrl?: string;
  className?: string;
}

export const ProductViewer: React.FC<ProductViewerProps> = ({
  productName,
  categorySlug = '',
  slug = '',
  productId = '',
  imageUrl,
  className = 'h-[380px] sm:h-[460px] md:h-[500px]',
}) => {
  const [viewMode, setViewMode] = useState<'3d' | 'photo'>('3d');
  const [autoRotate, setAutoRotate] = useState(true);
  const [lightingPreset, setLightingPreset] = useState<'farm' | 'studio' | 'harvest'>('studio');

  // Resolve authoritative product profile from registry
  const profile: Product3DProfile = useMemo(() => {
    return resolveProduct3DProfile(slug, productName, categorySlug);
  }, [slug, productName, categorySlug]);

  // Resolve the true original product image URL
  const displayImg = useMemo(() => {
    return getProductImageUrl(imageUrl, productName);
  }, [imageUrl, productName]);

  // Lighting parameters based on selected studio preset
  const lightingProps = useMemo(() => {
    switch (lightingPreset) {
      case 'farm':
        return { intensity: 1.4, ambientIntensity: 0.8, color: '#fef3c7' };
      case 'harvest':
        return { intensity: 1.25, ambientIntensity: 0.65, color: '#ffedd5' };
      case 'studio':
      default:
        return { intensity: 1.2, ambientIntensity: 0.7, color: '#ffffff' };
    }
  }, [lightingPreset]);

  // Determine active 3D mode
  const isFull3DMesh = profile.renderMode === '3d-mesh' && Boolean(profile.meshType);
  const is25DVolumetric = !isFull3DMesh;

  return (
    <div
      className={`relative w-full rounded-3xl overflow-hidden bg-gradient-to-b from-forest-950 via-forest-900 to-forest-950 border border-forest-800 shadow-soft-lg group select-none ${className}`}
    >
      {/* Top Header Controls Bar */}
      <div className="absolute top-3.5 left-3.5 right-3.5 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-auto">
        {/* Mode & Authenticity Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-forest-900/85 backdrop-blur-md border border-leaf-500/30 text-[11px] font-bold text-leaf-300 uppercase tracking-wider shadow-soft">
          <Sparkles className="w-3.5 h-3.5 text-leaf-400" />
          <span>
            {viewMode === 'photo'
              ? 'Original Product Photo'
              : isFull3DMesh
              ? '360° Botanical 3D'
              : 'Volumetric 2.5D Studio'}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {viewMode === '3d' && (
            <>
              {/* Lighting Preset Selector */}
              <button
                type="button"
                onClick={() => {
                  setLightingPreset((prev) =>
                    prev === 'studio' ? 'farm' : prev === 'farm' ? 'harvest' : 'studio'
                  );
                }}
                className="p-2 rounded-xl backdrop-blur-md border border-forest-700 bg-forest-900/80 text-cream-200 hover:text-cream-50 hover:border-forest-600 transition-all text-xs font-semibold flex items-center gap-1 cursor-pointer"
                title={`Lighting: ${lightingPreset.toUpperCase()} (Click to toggle)`}
                aria-label="Toggle lighting preset"
              >
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline capitalize text-[10px]">{lightingPreset}</span>
              </button>

              {/* Auto-Rotation Toggle */}
              <button
                type="button"
                onClick={() => setAutoRotate(!autoRotate)}
                className={`p-2 rounded-xl backdrop-blur-md border transition-all text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                  autoRotate
                    ? 'bg-leaf-500/20 border-leaf-400/40 text-leaf-300'
                    : 'bg-forest-900/80 border-forest-700 text-cream-200 hover:text-cream-50'
                }`}
                title={autoRotate ? 'Pause auto-rotation' : 'Start auto-rotation'}
                aria-label="Toggle auto rotation"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
              </button>
            </>
          )}

          {/* 3D vs Photo Tab Toggle */}
          <div className="bg-forest-900/85 backdrop-blur-md border border-forest-700 p-1 rounded-2xl flex items-center gap-1 shadow-soft">
            <button
              type="button"
              onClick={() => setViewMode('3d')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === '3d'
                  ? 'bg-leaf-500 text-forest-950 shadow-soft'
                  : 'text-cream-200 hover:text-cream-50'
              }`}
            >
              <Rotate3d className="w-3.5 h-3.5" />
              <span>3D</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('photo')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'photo'
                  ? 'bg-leaf-500 text-forest-950 shadow-soft'
                  : 'text-cream-200 hover:text-cream-50'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Photo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Presentation Stage */}
      {viewMode === 'photo' ? (
        /* ================= PHOTO MODE: Untouched Original Image ================= */
        <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-surface/95 relative overflow-hidden">
          <div className="relative max-h-[380px] w-full flex items-center justify-center">
            <img
              src={displayImg}
              alt={productName}
              className="max-h-[360px] max-w-full object-contain drop-shadow-xl transition-transform duration-500 hover:scale-105"
              onError={(e) => {
                e.currentTarget.src =
                  'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80';
              }}
            />
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-forest-950/80 backdrop-blur-md border border-forest-800 text-[11px] text-cream-200 font-sans flex items-center gap-1.5 shadow-soft">
            <ImageIcon className="w-3.5 h-3.5 text-leaf-400" />
            <span>High-Resolution Original Product Photograph</span>
          </div>
        </div>
      ) : (
        /* ================= 3D MODE: Authentic 3D or Volumetric 2.5D Studio ================= */
        <div className="w-full h-full relative cursor-grab active:cursor-grabbing">
          <SceneCanvas
            camera={{ position: [0, 0, 4.4], fov: 42 }}
            fallbackImage={displayImg}
            fallbackTitle={productName}
            touchAction="none"
          >
            <LightingSetup intensity={lightingProps.intensity} />

            {/* Model Selection: Genuine 3D Mesh OR Volumetric 2.5D Original Image */}
            <Suspense fallback={null}>
              {isFull3DMesh ? (
                <AuthenticProductMesh
                  meshType={profile.meshType!}
                  scale={1.3}
                />
              ) : (
                <VolumetricImageMesh
                  imageUrl={displayImg}
                  profile={profile}
                  scale={1.25}
                />
              )}
            </Suspense>

            {/* Studio Shadow Base Plane */}
            <mesh position={[0, -1.9, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[12, 12]} />
              <shadowMaterial opacity={0.35} />
            </mesh>

            {/* Orbit Controls (Respects Product Rotation Range) */}
            <OrbitControls
              enablePan={false}
              enableZoom={true}
              minDistance={2.4}
              maxDistance={6.5}
              autoRotate={autoRotate}
              autoRotateSpeed={isFull3DMesh ? 2.2 : 1.4}
              dampingFactor={0.06}
              minAzimuthAngle={profile.rotationLimits.minAzimuth}
              maxAzimuthAngle={profile.rotationLimits.maxAzimuth}
              minPolarAngle={profile.rotationLimits.minPolar}
              maxPolarAngle={profile.rotationLimits.maxPolar}
            />
          </SceneCanvas>

          {/* Interactive Navigation Hint Pill */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none z-10 px-4 py-1.5 rounded-full bg-forest-950/75 backdrop-blur-md border border-forest-800 text-[10px] sm:text-xs text-forest-300 font-sans flex items-center gap-2 shadow-soft">
            <Rotate3d className="w-3.5 h-3.5 text-leaf-400 animate-pulse" />
            <span>
              {isFull3DMesh
                ? 'Drag to rotate 360° • Pinch / Scroll to zoom'
                : 'Drag to inspect depth • Pinch / Scroll to zoom'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
