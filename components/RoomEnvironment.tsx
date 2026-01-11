
import React from 'react';
import { GraphicsQuality } from '../types';

export const RoomEnvironment: React.FC<{ children: React.ReactNode; quality: GraphicsQuality }> = ({ children, quality }) => {
  const isHigh = quality === 'HIGH';
  const isLow = quality === 'LOW';

  return (
    <div className="relative w-full h-screen bg-[#050505] flex items-center justify-center overflow-hidden">
      {/* 
         Lighting Logic: 
         - Base is black (#050505).
         - A radial gradient mimics the lamp casting light on the white back wall.
         - The texture is blended in, visible mostly in the light.
      */}
      
      {/* The "Spotlight" on the wall - simulates the lamp hitting the white plaster */}
      {!isLow && (
        <div className="absolute top-[-400px] left-1/2 -translate-x-1/2 w-[2000px] h-[2000px] bg-[radial-gradient(circle,rgba(220,220,220,0.15)_0%,rgba(20,20,20,1)_70%)] pointer-events-none z-0"></div>
      )}

      {/* Realistic Wall Texture (Concrete/Plaster) - Visible in the light */}
      {!isLow && (
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/concrete-wall.png')] opacity-20 mix-blend-overlay pointer-events-none"></div>
      )}
      
      {/* Subtle Noise for realism - High Only */}
      {isHigh && (
        <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/stucco.png')]"></div>
      )}

      {/* Volumetric Glow from the Lamp (The Haze) - High Only */}
      {isHigh && (
        <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[1400px] h-[900px] bg-[radial-gradient(circle,rgba(255,255,255,0.08)_0%,transparent_70%)] blur-[80px] pointer-events-none z-10"></div>
      )}
      
      {/* Ambient Occlusion / Vignette - Crushing the corners to black - Not on Low */}
      {!isLow && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,#000000_90%)] pointer-events-none z-10"></div>
      )}

      {/* Main Board Area Wrapper for Perspective - No perspective on Low for flat 2D speed */}
      <div className={`relative z-20 flex items-center justify-center w-full h-full ${!isLow ? 'perspective-2000' : ''}`}>
        {children}
      </div>
      
      {/* Deep shadows at very edges - High Only */}
      {isHigh && (
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_200px_rgba(0,0,0,1)] z-30"></div>
      )}
    </div>
  );
};
