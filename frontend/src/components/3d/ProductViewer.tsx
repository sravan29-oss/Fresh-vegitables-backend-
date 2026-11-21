import React, { useState, Suspense } from 'react';
import { OrbitControls, Float } from '@react-three/drei';
import { SceneCanvas } from './SceneCanvas';
import { LightingSetup } from './LightingSetup';
import { VegetableModel, VegetableType } from './VegetableModel';
import { Rotate3d, Image as ImageIcon, Sparkles, RefreshCw } from 'lucide-react';
import { getProductImageUrl } from '../../utils/imageUrl';

interface ProductViewerProps {
  productName: string;
  categorySlug?: string;
  imageUrl?: string;
  className?: string;
}

export const ProductViewer: React.FC<ProductViewerProps> = ({
  productName,
  categorySlug = '',
  imageUrl,
  className = 'h-[360px] sm:h-[440px] md:h-[480px]',
}) => {
  const [viewMode, setViewMode] = useState<'3d' | 'photo'>('3d');
  const [autoRotate, setAutoRotate] = useState(true);

  // Map product name or category slug to a vegetable type for 3D model
  const resolveVegType = (): VegetableType => {
    const p = (productName + ' ' + categorySlug).toLowerCase();
    if (p.includes('carrot') || p.includes('mooli') || p.includes('radish') || p.includes('beet') || p.includes('root')) {
      return 'carrot';
    }
    if (p.includes('broccoli') || p.includes('gobi') || p.includes('cauliflower')) {
      return 'broccoli';
    }
    if (p.includes('capsicum') || p.includes('mirchi') || p.includes('pepper') || p.includes('shimla')) {
      return 'capsicum';
    }
    if (p.includes('palak') || p.includes('spinach') || p.includes('methi') || p.includes('coriander') || p.includes('leaf')) {
      return 'spinach';
    }
    if (p.includes('brinjal') || p.includes('eggplant') || p.includes('baingan') || p.includes('vankaya')) {
      return 'eggplant';
    }
    return 'tomato';
  };

  const vegType = resolveVegType();
  const displayImg = getProductImageUrl(imageUrl, productName);

  return (
    <div className={`relative w-full rounded-3xl overflow-hidden bg-gradient-to-b from-forest-950 via-forest-900 to-forest-950 border border-forest-800 shadow-soft-lg group ${className}`}>
      {/* View Switcher Header Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-forest-900/80 backdrop-blur-md border border-leaf-500/30 text-[11px] font-bold text-leaf-300 uppercase tracking-wider shadow-soft">
          <Sparkles className="w-3.5 h-3.5 text-leaf-400" />
          <span>{viewMode === '3d' ? 'Interactive 3D Studio' : 'High-Res Photo'}</span>
        </div>

        <div className="flex items-center gap-2">
          {viewMode === '3d' && (
            <button
              type="button"
              onClick={() => setAutoRotate(!autoRotate)}
              className={`p-2 rounded-xl backdrop-blur-md border transition-all text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                autoRotate
                  ? 'bg-leaf-500/20 border-leaf-400/40 text-leaf-300'
                  : 'bg-forest-900/80 border-forest-700 text-cream-200 hover:text-cream-50'
              }`}
              title={autoRotate ? 'Pause 360° rotation' : 'Start 360° rotation'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
            </button>
          )}

          <div className="bg-forest-900/85 backdrop-blur-md border border-forest-700 p-1 rounded-2xl flex items-center gap-1">
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

      {/* Main View Area */}
      {viewMode === 'photo' ? (
        <div className="w-full h-full flex items-center justify-center p-8 bg-surface">
          <img
            src={displayImg}
            alt={productName}
            className="w-full h-full object-contain max-h-[380px] drop-shadow-lg transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.src =
                'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80';
            }}
          />
        </div>
      ) : (
        <div className="w-full h-full relative cursor-grab active:cursor-grabbing">
          <SceneCanvas
            camera={{ position: [0, 0, 4.2], fov: 42 }}
            fallbackImage={displayImg}
            fallbackTitle={productName}
            touchAction="none"
          >
            <LightingSetup intensity={1.2} />

            <Float speed={1.2} rotationIntensity={0.3} floatIntensity={0.4}>
              <VegetableModel
                type={vegType}
                scale={1.3}
                position={[0, -0.1, 0]}
                animate={false}
              />
            </Float>

            {/* Soft Shadow Base Plane */}
            <mesh position={[0, -1.8, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[10, 10]} />
              <shadowMaterial opacity={0.3} />
            </mesh>

            <OrbitControls
              enablePan={false}
              enableZoom={true}
              minDistance={2.5}
              maxDistance={6.5}
              autoRotate={autoRotate}
              autoRotateSpeed={2.2}
              dampingFactor={0.06}
            />
          </SceneCanvas>

          {/* Micro hint footer */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none z-10 px-4 py-1.5 rounded-full bg-forest-950/70 backdrop-blur-md border border-forest-800 text-[10px] sm:text-xs text-forest-300 font-sans flex items-center gap-2">
            <Rotate3d className="w-3.5 h-3.5 text-leaf-400 animate-pulse" />
            <span>Drag to rotate • Pinch / Scroll to zoom</span>
          </div>
        </div>
      )}
    </div>
  );
};
