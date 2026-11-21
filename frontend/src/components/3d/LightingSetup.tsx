import React from 'react';

interface LightingSetupProps {
  intensity?: number;
}

export const LightingSetup: React.FC<LightingSetupProps> = ({ intensity = 1 }) => {
  return (
    <>
      {/* Soft natural ambient fill */}
      <ambientLight intensity={0.65 * intensity} color="#f5f7f2" />

      {/* Main sunlight */}
      <directionalLight
        position={[6, 8, 5]}
        intensity={1.4 * intensity}
        color="#fffaf0"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={25}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0005}
      />

      {/* Organic ground bounce (simulates lush soil / vegetation bounce) */}
      <directionalLight
        position={[-4, -3, -2]}
        intensity={0.45 * intensity}
        color="#c8e6c9"
      />

      {/* Rim / edge highlight to give physical depth */}
      <pointLight position={[-5, 4, -4]} intensity={0.8 * intensity} color="#a3d977" />
      <pointLight position={[4, -2, 3]} intensity={0.5 * intensity} color="#ffffff" />
    </>
  );
};
