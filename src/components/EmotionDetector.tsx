import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, CameraOff, Smile, Frown, Meh, Heart, Zap, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmotionDetectorProps {
  onEmotionDetected: (emotion: string, source: 'webcam' | 'emoji') => void;
  className?: string;
}

const emotionEmojis = [
  { emotion: 'happy', icon: Smile, label: 'Happy', color: 'text-yellow-400' },
  { emotion: 'sad', icon: Frown, label: 'Sad', color: 'text-blue-400' },
  { emotion: 'neutral', icon: Meh, label: 'Neutral', color: 'text-gray-400' },
  { emotion: 'calm', icon: Heart, label: 'Calm', color: 'text-green-400' },
  { emotion: 'surprised', icon: Zap, label: 'Surprised', color: 'text-purple-400' },
  { emotion: 'angry', icon: AlertTriangle, label: 'Angry', color: 'text-red-400' },
];

const EmotionDetector: React.FC<EmotionDetectorProps> = ({
  onEmotionDetected,
  className
}) => {
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [detectedEmotion, setDetectedEmotion] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startWebcam = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported by this browser');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;

        // Wait for video to be ready and play
        videoRef.current.onloadedmetadata = async () => {
          try {
            if (videoRef.current) {
              await videoRef.current.play();
              setIsWebcamActive(true);
              setIsLoading(false);
            }
          } catch (playError) {
            console.error('Error playing video:', playError);
            setError('Failed to start video playback');
            setIsLoading(false);
          }
        };

        // Handle errors
        videoRef.current.onerror = () => {
          setError('Video playback error');
          setIsLoading(false);
        };
      }
    } catch (error) {
      console.error('Error accessing webcam:', error);
      let errorMessage = 'Camera access denied or unavailable';

      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera permission denied. Please allow camera access.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera found on this device.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera is already in use by another application.';
        } else {
          errorMessage = error.message;
        }
      }

      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsWebcamActive(false);
    setIsDetecting(false);
    setError(null);
    setIsLoading(false);
  };

  const handleEmotionSelect = (emotion: string) => {
    setDetectedEmotion(emotion);
    onEmotionDetected(emotion, 'emoji');
  };

  const simulateDetection = () => {
    if (!isWebcamActive) return;
    
    setIsDetecting(true);
    
    // Simulate emotion detection (in real app, this would use face-api.js)
    setTimeout(() => {
      const emotions = ['happy', 'calm', 'neutral', 'surprised'];
      const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];
      setDetectedEmotion(randomEmotion);
      onEmotionDetected(randomEmotion, 'webcam');
      setIsDetecting(false);
    }, 2000);
  };

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  return (
    <Card className={cn("glass border-border/50", className)}>
      <div className="p-6 space-y-6">
        {/* Webcam Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-glow">Emotion Detection</h3>
          
          <div className="relative">
            {isWebcamActive ? (
              <div className="relative rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-48 object-cover bg-muted"
                />
                {isDetecting && (
                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                    <div className="text-white font-semibold">Detecting emotion...</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-48 bg-muted/50 rounded-lg flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  {isLoading ? (
                    <>
                      <div className="w-12 h-12 mx-auto mb-2 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                      <p>Starting camera...</p>
                    </>
                  ) : error ? (
                    <>
                      <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50 text-red-400" />
                      <p className="text-sm text-red-400">{error}</p>
                    </>
                  ) : (
                    <>
                      <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Webcam off</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={isWebcamActive ? stopWebcam : startWebcam}
              variant={isWebcamActive ? "destructive" : "default"}
              size="sm"
              className="flex-1"
              disabled={isLoading}
            >
              {isWebcamActive ? <CameraOff className="w-4 h-4 mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
              {isLoading ? 'Starting...' : isWebcamActive ? 'Stop Camera' : 'Start Camera'}
            </Button>
            
            {isWebcamActive && (
              <Button
                onClick={simulateDetection}
                disabled={isDetecting}
                variant="secondary"
                size="sm"
                className="flex-1"
              >
                {isDetecting ? 'Detecting...' : 'Detect Mood'}
              </Button>
            )}
          </div>
        </div>

        {/* Manual Emotion Selection */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">Or select your mood:</h4>
          <div className="grid grid-cols-3 gap-3">
            {emotionEmojis.map(({ emotion, icon: Icon, label, color }) => (
              <Button
                key={emotion}
                onClick={() => handleEmotionSelect(emotion)}
                variant={detectedEmotion === emotion ? "default" : "outline"}
                size="sm"
                className="h-auto py-3 flex flex-col gap-1"
              >
                <Icon className={cn("w-5 h-5", color)} />
                <span className="text-xs">{label}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Current Emotion Display */}
        {detectedEmotion && (
          <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
            <p className="text-sm text-muted-foreground">Current mood:</p>
            <p className="font-semibold text-primary capitalize">{detectedEmotion}</p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default EmotionDetector;
