import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, CameraOff, Smile, Frown, Meh, Heart, Zap, AlertTriangle, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as faceapi from 'face-api.js';

interface EmotionDetectorProps {
  onEmotionDetected: (emotion: string, source: 'webcam' | 'emoji' | 'upload') => void;
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
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load face-api.js models
  const loadModels = useCallback(async () => {
    if (modelsLoaded) return;
    
    setIsModelLoading(true);
    try {
      const MODEL_URL = '/models'; // We'll need to copy models to public folder
      
      // Try to load models, fallback to CDN if local fails
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);
      } catch {
        // Fallback to CDN
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model'),
          faceapi.nets.faceExpressionNet.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model'),
        ]);
      }
      
      setModelsLoaded(true);
      setError(null);
    } catch (err) {
      console.error('Error loading face-api models:', err);
      setError('Failed to load emotion detection models');
    } finally {
      setIsModelLoading(false);
    }
  }, [modelsLoaded]);

  // Start webcam with canvas rendering
  const startWebcam = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Load models first
      await loadModels();
      
      // Get webcam stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        // Wait for video to be ready
        await new Promise<void>((resolve, reject) => {
          if (!videoRef.current) return reject();
          
          videoRef.current.onloadedmetadata = async () => {
            try {
              await videoRef.current!.play();
              setIsWebcamActive(true);
              setIsLoading(false);
              resolve();
            } catch (err) {
              reject(err);
            }
          };
        });

        // Start emotion detection loop
        startEmotionDetection();
      }
    } catch (error) {
      console.error('Error starting webcam:', error);
      let errorMessage = 'Camera access failed';
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera permission denied. Please allow camera access and try again.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera found. Please connect a camera and try again.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera is in use by another application.';
        }
      }
      
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  // Stop webcam
  const stopWebcam = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
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

  // Real emotion detection with face-api.js
  const startEmotionDetection = () => {
    if (!modelsLoaded || !videoRef.current || !canvasRef.current) return;

    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current || !modelsLoaded) return;

      try {
        setIsDetecting(true);
        
        // Set canvas dimensions to match video
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Detect faces and expressions
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();

        // Clear canvas and draw detections
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          if (detections.length > 0) {
            // Draw face detection box
            const detection = detections[0];
            const { x, y, width, height } = detection.detection.box;
            
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);
            
            // Get dominant emotion
            const expressions = detection.expressions;
            const maxExpression = Object.keys(expressions).reduce((a, b) => 
              expressions[a as keyof typeof expressions] > expressions[b as keyof typeof expressions] ? a : b
            );
            
            // Map face-api emotions to our emotions
            const emotionMap: { [key: string]: string } = {
              'happy': 'happy',
              'sad': 'sad',
              'angry': 'angry',
              'surprised': 'surprised',
              'neutral': 'neutral',
              'disgusted': 'angry',
              'fearful': 'surprised'
            };
            
            const mappedEmotion = emotionMap[maxExpression] || 'neutral';
            const confidence = expressions[maxExpression as keyof typeof expressions];
            
            // Only update if confidence is high enough
            if (confidence > 0.5) {
              setDetectedEmotion(mappedEmotion);
              onEmotionDetected(mappedEmotion, 'webcam');
            }
            
            // Draw emotion label
            ctx.fillStyle = '#00ff00';
            ctx.font = '16px Arial';
            ctx.fillText(`${maxExpression} (${(confidence * 100).toFixed(0)}%)`, x, y - 10);
          }
        }
        
        setIsDetecting(false);
      } catch (err) {
        console.error('Error in emotion detection:', err);
        setIsDetecting(false);
      }
    }, 1000); // Check every second
  };

  // Handle file upload for image emotion detection
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!modelsLoaded) {
      await loadModels();
    }

    try {
      setIsDetecting(true);
      
      // Create image element
      const img = new Image();
      const canvas = canvasRef.current;
      
      if (!canvas) return;
      
      img.onload = async () => {
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.drawImage(img, 0, 0);
        
        // Detect emotions in uploaded image
        const detections = await faceapi
          .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();
        
        if (detections.length > 0) {
          const expressions = detections[0].expressions;
          const maxExpression = Object.keys(expressions).reduce((a, b) => 
            expressions[a as keyof typeof expressions] > expressions[b as keyof typeof expressions] ? a : b
          );
          
          const emotionMap: { [key: string]: string } = {
            'happy': 'happy',
            'sad': 'sad',
            'angry': 'angry',
            'surprised': 'surprised',
            'neutral': 'neutral',
            'disgusted': 'angry',
            'fearful': 'surprised'
          };
          
          const mappedEmotion = emotionMap[maxExpression] || 'neutral';
          setDetectedEmotion(mappedEmotion);
          onEmotionDetected(mappedEmotion, 'upload');
        } else {
          setError('No face detected in the uploaded image');
        }
        
        setIsDetecting(false);
      };
      
      img.src = URL.createObjectURL(file);
    } catch (err) {
      console.error('Error processing uploaded image:', err);
      setError('Failed to process uploaded image');
      setIsDetecting(false);
    }
  };

  const handleEmotionSelect = (emotion: string) => {
    setDetectedEmotion(emotion);
    onEmotionDetected(emotion, 'emoji');
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
          <h3 className="text-lg font-semibold text-glow">AI Emotion Detection</h3>
          
          {/* Model Loading Status */}
          {isModelLoading && (
            <div className="text-center p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <p className="text-sm text-blue-400">Loading AI models...</p>
            </div>
          )}
          
          <div className="relative">
            {/* Video Display */}
            <div className="relative rounded-lg overflow-hidden bg-muted/50" style={{ aspectRatio: '4/3' }}>
              {isWebcamActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      console.error('Video error:', e);
                      setError('Video playback failed');
                    }}
                    onLoadedMetadata={() => {
                      console.log('Video metadata loaded');
                    }}
                  />
                  {/* Canvas overlay for face detection */}
                  <canvas
                    ref={canvasRef}
                    className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-80"
                  />
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    {isLoading ? (
                      <>
                        <div className="w-12 h-12 mx-auto mb-2 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                        <p>Starting camera...</p>
                      </>
                    ) : error ? (
                      <>
                        <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50 text-red-400" />
                        <p className="text-sm text-red-400 max-w-xs">{error}</p>
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

              {/* Detection indicator */}
              {isDetecting && (
                <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs">
                  Detecting...
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            <Button
              onClick={isWebcamActive ? stopWebcam : startWebcam}
              variant={isWebcamActive ? "destructive" : "default"}
              size="sm"
              className="flex-1"
              disabled={isLoading || isModelLoading}
            >
              {isWebcamActive ? <CameraOff className="w-4 h-4 mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
              {isLoading ? 'Starting...' : isWebcamActive ? 'Stop Camera' : 'Start Camera'}
            </Button>
            
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              size="sm"
              disabled={isModelLoading || isDetecting}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Photo
            </Button>
          </div>
          
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
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
