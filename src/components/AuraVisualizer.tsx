import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface AuraVisualizerProps {
  emotion: string;
  intensity?: number;
  className?: string;
}

const emotionColors = {
  happy: 'hsl(60 100% 70%)',     // Bright vibrant yellow
  sad: 'hsl(220 100% 60%)',      // Deep vibrant blue
  angry: 'hsl(0 100% 65%)',      // Intense vibrant red
  surprised: 'hsl(280 100% 75%)', // Electric vibrant purple
  fearful: 'hsl(260 80% 55%)',   // Dark vibrant purple
  disgusted: 'hsl(120 80% 50%)', // Vibrant green
  neutral: 'hsl(210 50% 70%)',   // Soft blue-gray
  calm: 'hsl(180 100% 65%)',     // Bright vibrant cyan
};

const AuraVisualizer: React.FC<AuraVisualizerProps> = ({
  emotion,
  intensity = 1,
  className
}) => {
  const [currentEmotion, setCurrentEmotion] = useState(emotion);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVibrating, setIsVibrating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentEmotion(emotion);

    // Trigger vibration effect when emotion changes
    setIsVibrating(true);
    const timer = setTimeout(() => setIsVibrating(false), 1000);
    return () => clearTimeout(timer);
  }, [emotion]);

  // Mouse movement tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Calculate offset from center (reduced sensitivity)
        const offsetX = (e.clientX - centerX) * 0.05;
        const offsetY = (e.clientY - centerY) * 0.05;

        setMousePosition({ x: offsetX, y: offsetY });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const emotionColor = emotionColors[emotion as keyof typeof emotionColors] || emotionColors.neutral;

  return (
    <div
      ref={containerRef}
      className={cn("relative flex items-center justify-center", className)}
      style={{
        transform: `translate(${mousePosition.x}px, ${mousePosition.y}px)`,
        transition: 'transform 0.1s ease-out',
      }}
    >
      {/* Outer glow rings with enhanced vibrance */}
      <div
        className={`absolute inset-0 rounded-full opacity-40 aura-pulse ${isVibrating ? 'vibrate-intense' : ''}`}
        style={{
          background: `radial-gradient(circle, ${emotionColor}40 0%, ${emotionColor}10 40%, transparent 70%)`,
          transform: `scale(${1.8 + intensity * 0.7})`,
          filter: 'blur(8px)',
        }}
      />
      <div
        className={`absolute inset-0 rounded-full opacity-30 aura-pulse ${isVibrating ? 'vibrate-intense' : ''}`}
        style={{
          background: `radial-gradient(circle, ${emotionColor}30 0%, ${emotionColor}08 50%, transparent 80%)`,
          transform: `scale(${2.5 + intensity * 1})`,
          animationDelay: '1s',
          filter: 'blur(12px)',
        }}
      />

      {/* Vibrant energy waves */}
      <div
        className={`absolute inset-0 rounded-full opacity-20 energy-wave ${isVibrating ? 'vibrate-subtle' : ''}`}
        style={{
          background: `conic-gradient(${emotionColor}60, transparent, ${emotionColor}60, transparent, ${emotionColor}60)`,
          transform: `scale(${3 + intensity * 1.2}) rotate(0deg)`,
          animation: 'spin 8s linear infinite',
        }}
      />

      {/* Main aura orb with enhanced vibrancy */}
      <div
        className={`relative w-48 h-48 rounded-full aura-breathe emotion-transition glass ${isVibrating ? 'vibrate-main' : ''}`}
        style={{
          background: `radial-gradient(circle at 25% 25%, ${emotionColor}90, ${emotionColor}60 40%, ${emotionColor}30 80%)`,
          boxShadow: `
            0 0 80px ${emotionColor}60,
            inset 0 0 80px ${emotionColor}30,
            0 0 160px ${emotionColor}40,
            0 0 240px ${emotionColor}20
          `,
          border: `2px solid ${emotionColor}40`,
        }}
      >
        {/* Enhanced inner sparkles with more vibrant colors */}
        <div className="absolute inset-2 rounded-full opacity-80">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={`absolute rounded-full animate-pulse sparkle-float ${isVibrating ? 'vibrate-sparkle' : ''}`}
              style={{
                background: `linear-gradient(45deg, ${emotionColor}, white)`,
                width: `${8 + (i % 3) * 4}px`,
                height: `${8 + (i % 3) * 4}px`,
                top: `${15 + (i * 11)}%`,
                left: `${20 + (i * 8)}%`,
                animationDelay: `${i * 0.3}s`,
                boxShadow: `0 0 10px ${emotionColor}80`,
              }}
            />
          ))}
        </div>

        {/* Enhanced center highlight with vibrant glow */}
        <div
          className={`absolute top-6 left-6 w-20 h-20 rounded-full opacity-50 ${isVibrating ? 'vibrate-subtle' : ''}`}
          style={{
            background: `radial-gradient(circle, white 0%, ${emotionColor}80 30%, transparent 70%)`,
            filter: 'blur(2px)',
          }}
        />

        {/* Pulsing core */}
        <div
          className={`absolute top-1/2 left-1/2 w-12 h-12 rounded-full transform -translate-x-1/2 -translate-y-1/2 ${isVibrating ? 'vibrate-core' : ''}`}
          style={{
            background: `radial-gradient(circle, white, ${emotionColor}90)`,
            boxShadow: `0 0 30px ${emotionColor}90, inset 0 0 20px ${emotionColor}60`,
            animation: 'pulse 2s ease-in-out infinite',
          }}
        />
      </div>

      {/* Enhanced floating particles with vibrant trails */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className={`absolute rounded-full opacity-70 particle-float ${isVibrating ? 'vibrate-particle' : ''}`}
          style={{
            background: `linear-gradient(45deg, ${emotionColor}, white)`,
            width: `${3 + (i % 4)}px`,
            height: `${3 + (i % 4)}px`,
            top: `${10 + (i * 7)}%`,
            left: `${5 + (i * 8)}%`,
            animationDelay: `${i * 0.6}s`,
            animationDuration: `${3 + (i % 3)}s`,
            boxShadow: `0 0 8px ${emotionColor}70`,
          }}
        />
      ))}

      {/* Emotion-specific special effects */}
      {emotion === 'happy' && (
        <div className="absolute inset-0 rounded-full animate-spin" style={{ animation: 'spin 4s linear infinite' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                background: 'gold',
                top: '10%',
                left: '50%',
                transformOrigin: '0 140px',
                transform: `rotate(${i * 60}deg)`,
                boxShadow: '0 0 15px gold',
              }}
            />
          ))}
        </div>
      )}

      {emotion === 'angry' && (
        <div className={`absolute inset-0 ${isVibrating ? 'lightning-effect' : ''}`}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-16 bg-red-500 opacity-60 animate-pulse"
              style={{
                top: `${20 + i * 15}%`,
                left: `${30 + i * 10}%`,
                transform: `rotate(${i * 45}deg)`,
                animationDelay: `${i * 0.2}s`,
                boxShadow: '0 0 10px red',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AuraVisualizer;

// Add these CSS animations to your global stylesheet
// Or you can add them via a style tag in your component
