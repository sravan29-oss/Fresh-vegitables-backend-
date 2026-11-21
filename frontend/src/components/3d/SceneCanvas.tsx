import React, { Suspense, useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { SceneFallback } from './SceneFallback';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class CanvasErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[3D Canvas Error caught]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

interface SceneCanvasProps {
  children: ReactNode;
  className?: string;
  camera?: {
    position?: [number, number, number];
    fov?: number;
    near?: number;
    far?: number;
  };
  fallbackTitle?: string;
  fallbackSubtitle?: string;
  fallbackImage?: string;
  interactive?: boolean;
  touchAction?: 'none' | 'pan-y' | 'auto';
}

export const SceneCanvas: React.FC<SceneCanvasProps> = ({
  children,
  className = 'w-full h-full',
  camera = { position: [0, 0, 5], fov: 45, near: 0.1, far: 100 },
  fallbackTitle,
  fallbackSubtitle,
  fallbackImage,
  interactive = true,
  touchAction = 'pan-y',
}) => {
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // 1. Check for reduced motion preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);
      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, []);

  useEffect(() => {
    // 2. Check WebGL availability safely
    try {
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
      setIsSupported(Boolean(gl));
    } catch {
      setIsSupported(false);
    }
  }, []);

  const fallbackNode = (
    <SceneFallback
      title={fallbackTitle}
      subtitle={fallbackSubtitle}
      image={fallbackImage}
      className={className}
    />
  );

  // If WebGL is not supported or user prefers reduced motion, render lightweight fallback
  if (isSupported === false || prefersReducedMotion) {
    return fallbackNode;
  }

  // During SSR / initial client mount before check
  if (isSupported === null) {
    return (
      <div className={`relative flex items-center justify-center bg-forest-950/20 rounded-3xl ${className}`}>
        <div className="w-8 h-8 border-2 border-leaf-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <CanvasErrorBoundary fallback={fallbackNode}>
      <div
        style={{ touchAction: interactive ? touchAction : 'auto' }}
        className={`relative ${className} ${interactive ? '' : 'pointer-events-none'}`}
      >
        <Canvas
          camera={camera}
          dpr={[1, typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1]}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true,
          }}
          className="w-full h-full"
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}
        >
          <Suspense fallback={null}>
            {children}
          </Suspense>
        </Canvas>
      </div>
    </CanvasErrorBoundary>
  );
};
