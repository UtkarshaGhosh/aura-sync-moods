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

        // Wait for video to be ready and play
        await new Promise<void>((resolve, reject) => {
          if (!videoRef.current) return reject(new Error('Video element not found'));

          const video = videoRef.current;

          // Set up event listeners
          const onLoadedMetadata = async () => {
            try {
              // Ensure video is ready to play
              if (video.readyState >= 2) {
                await video.play();
                video.removeEventListener('loadedmetadata', onLoadedMetadata);
                video.removeEventListener('error', onError);
                resolve();
              }
            } catch (err) {
              video.removeEventListener('loadedmetadata', onLoadedMetadata);
              video.removeEventListener('error', onError);
              reject(err);
            }
          };

          const onError = (err: Event) => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            reject(new Error('Video failed to load'));
          };

          video.addEventListener('loadedmetadata', onLoadedMetadata);
          video.addEventListener('error', onError);

          // If metadata is already loaded
          if (video.readyState >= 2) {
            onLoadedMetadata();
          }
        });

        setIsWebcamActive(true);
        setIsLoading(false);

        // Start emotion detection loop after a short delay
        setTimeout(startEmotionDetection, 500);
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
        } else if (error.name === 'AbortError') {
          errorMessage = 'Camera access was interrupted.';
        } else if (error.message.includes('Video failed to load')) {
          errorMessage = 'Video playback failed. Try refreshing the page.';
        }
      }

      setError(errorMessage);
      setIsLoading(false);

      // Clean up on error
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
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

        const video = videoRef.current;
        const canvas = canvasRef.current;

        // Skip if video is not ready
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          setIsDetecting(false);
          return;
        }

        // Set canvas dimensions to match the display size
        const rect = video.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        // Calculate scale factors for drawing detections
        const scaleX = rect.width / video.videoWidth;
        const scaleY = rect.height / video.videoHeight;

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

            // Scale coordinates to match display size
            const scaledX = x * scaleX;
            const scaledY = y * scaleY;
            const scaledWidth = width * scaleX;
            const scaledHeight = height * scaleY;

            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);

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
            if (confidence > 0.4) {
              setDetectedEmotion(mappedEmotion);
              onEmotionDetected(mappedEmotion, 'webcam');
            }

            // Draw emotion label
            ctx.fillStyle = '#00ff00';
            ctx.font = `${Math.max(12, scaledWidth * 0.08)}px Arial`;
            ctx.fillText(`${maxExpression} (${(confidence * 100).toFixed(0)}%)`, scaledX, scaledY - 10);
          }
        }

        setIsDetecting(false);
      } catch (err) {
        console.error('Error in emotion detection:', err);
        setIsDetecting(false);
      }
    }, 1500); // Check every 1.5 seconds
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
      setError(null);

      // Create image element
      const img = new Image();
      const canvas = canvasRef.current;

      if (!canvas) {
        setError('Canvas not available');
        setIsDetecting(false);
        return;
      }

      img.onload = async () => {
        try {
          // Calculate display dimensions while maintaining aspect ratio
          const containerRect = canvas.parentElement?.getBoundingClientRect();
          if (!containerRect) return;

          const aspectRatio = img.width / img.height;
          const containerAspectRatio = containerRect.width / containerRect.height;

          let displayWidth, displayHeight;
          if (aspectRatio > containerAspectRatio) {
            displayWidth = containerRect.width;
            displayHeight = containerRect.width / aspectRatio;
          } else {
            displayHeight = containerRect.height;
            displayWidth = containerRect.height * aspectRatio;
          }

          canvas.width = displayWidth;
          canvas.height = displayHeight;

          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          // Clear and draw the image
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, displayWidth, displayHeight);

          // Detect emotions in uploaded image
          const detections = await faceapi
            .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
            .withFaceExpressions();

          if (detections.length > 0) {
            const detection = detections[0];
            const expressions = detection.expressions;
            const maxExpression = Object.keys(expressions).reduce((a, b) =>
              expressions[a as keyof typeof expressions] > expressions[b as keyof typeof expressions] ? a : b
            );

            // Draw detection box
            const { x, y, width, height } = detection.detection.box;
            const scaleX = displayWidth / img.width;
            const scaleY = displayHeight / img.height;

            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.strokeRect(x * scaleX, y * scaleY, width * scaleX, height * scaleY);

            // Draw emotion label
            ctx.fillStyle = '#00ff00';
            ctx.font = '16px Arial';
            const confidence = expressions[maxExpression as keyof typeof expressions];
            ctx.fillText(`${maxExpression} (${(confidence * 100).toFixed(0)}%)`, x * scaleX, y * scaleY - 10);

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
        } catch (err) {
          console.error('Error processing image:', err);
          setError('Failed to analyze the image');
          setIsDetecting(false);
        }
      };

      img.onerror = () => {
        setError('Failed to load the image');
        setIsDetecting(false);
      };

      img.src = URL.createObjectURL(file);
    } catch (err) {
      console.error('Error processing uploaded image:', err);
      setError('Failed to process uploaded image');
      setIsDetecting(false);
    }

    // Clear the file input
    if (event.target) {
      event.target.value = '';
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
