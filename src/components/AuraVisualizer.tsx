import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface AuraVisualizerProps {
  emotion: string;
  intensity?: number;
  className?: string;
}

const emotionColors = {
  happy: 'hsl(45 100% 65%)',
  sad: 'hsl(220 60% 50%)',
  angry: 'hsl(0 80% 60%)',
  surprised: 'hsl(280 100% 70%)',
  fearful: 'hsl(260 40% 40%)',
  disgusted: 'hsl(120 30% 40%)',
  neutral: 'hsl(210 15% 60%)',
  calm: 'hsl(180 50% 60%)',
};

const AuraVisualizer: React.FC<AuraVisualizerProps> = ({
  emotion,
  intensity = 1,
  className
}) => {
  const [currentEmotion, setCurrentEmotion] = useState(emotion);

  useEffect(() => {
    setCurrentEmotion(emotion);
  }, [emotion]);

  const emotionColor = emotionColors[emotion as keyof typeof emotionColors] || emotionColors.neutral;

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      {/* Outer glow rings */}
      <div 
        className="absolute inset-0 rounded-full opacity-30 aura-pulse"
        style={{
          background: `radial-gradient(circle, ${emotionColor}20 0%, transparent 70%)`,
          transform: `scale(${1.5 + intensity * 0.5})`,
        }}
      />
      <div 
        className="absolute inset-0 rounded-full opacity-20 aura-pulse"
        style={{
          background: `radial-gradient(circle, ${emotionColor}15 0%, transparent 80%)`,
          transform: `scale(${2 + intensity * 0.7})`,
          animationDelay: '1s',
        }}
      />
      
      {/* Main aura orb */}
      <div 
        className="relative w-48 h-48 rounded-full aura-breathe emotion-transition glass"
        style={{
          background: `radial-gradient(circle at 30% 30%, ${emotionColor}60, ${emotionColor}20)`,
          boxShadow: `
            0 0 60px ${emotionColor}40,
            inset 0 0 60px ${emotionColor}20,
            0 0 120px ${emotionColor}20
          `,
        }}
      >
        {/* Inner sparkles */}
        <div className="absolute inset-4 rounded-full opacity-60">
          <div 
            className="absolute top-6 left-8 w-2 h-2 rounded-full animate-pulse"
            style={{ background: emotionColor, animationDelay: '0.5s' }}
          />
          <div 
            className="absolute top-12 right-6 w-1 h-1 rounded-full animate-pulse"
            style={{ background: emotionColor, animationDelay: '1.5s' }}
          />
          <div 
            className="absolute bottom-8 left-12 w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: emotionColor, animationDelay: '2s' }}
          />
        </div>

        {/* Center highlight */}
        <div 
          className="absolute top-8 left-8 w-16 h-16 rounded-full opacity-40"
          style={{
            background: `radial-gradient(circle, ${emotionColor}80 0%, transparent 70%)`,
          }}
        />
      </div>

      {/* Floating particles */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 rounded-full opacity-60 float"
          style={{
            background: emotionColor,
            top: `${20 + i * 10}%`,
            left: `${15 + i * 12}%`,
            animationDelay: `${i * 0.8}s`,
            animationDuration: `${4 + i * 0.5}s`,
          }}
        />
      ))}
    </div>
  );
};

export default AuraVisualizer;