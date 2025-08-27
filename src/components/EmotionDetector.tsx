import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Camera, CameraOff, Smile, Frown, Meh, Heart, Zap, AlertTriangle, Upload, HelpCircle, ChevronDown } from 'lucide-react';
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
  const [debugMode, setDebugMode] = useState(true); // Enable debug mode
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showHelp, setShowHelp] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debug logging function
  const addDebugLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    if (debugMode) {
      setDebugLogs(prev => [...prev.slice(-9), logMessage]); // Keep last 10 logs
    }
  }, [debugMode]);

  // Get environment info for better error messages
  const getEnvironmentInfo = () => {
    const isHTTPS = location.protocol === 'https:';
    const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const browserInfo = navigator.userAgent;

    return {
      isHTTPS,
      isLocalhost,
      isSecure: isHTTPS || isLocalhost,
      browserInfo: browserInfo.includes('Chrome') ? 'Chrome' :
                   browserInfo.includes('Firefox') ? 'Firefox' :
                   browserInfo.includes('Safari') ? 'Safari' :
                   browserInfo.includes('Edge') ? 'Edge' : 'Unknown'
    };
  };

  // Load face-api.js models
  const loadModels = useCallback(async () => {
    if (modelsLoaded) {
      addDebugLog('✅ Models already loaded, skipping...');
      return;
    }

    addDebugLog('📦 Starting model loading...');
    setIsModelLoading(true);
    try {
      const MODEL_URL = '/models'; // We'll need to copy models to public folder

      // Try to load models, fallback to CDN if local fails
      try {
        addDebugLog('🔄 Attempting to load models from local path...');
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);
        addDebugLog('✅ Models loaded from local path');
      } catch (localError) {
        addDebugLog(`❌ Local model loading failed: ${localError}`);
        addDebugLog('🌐 Falling back to CDN...');
        // Fallback to CDN
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model'),
          faceapi.nets.faceExpressionNet.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model'),
        ]);
        addDebugLog('✅ Models loaded from CDN');
      }

      setModelsLoaded(true);
      setError(null);
      addDebugLog('🎉 All models loaded successfully!');
    } catch (err) {
      addDebugLog(`❌ Model loading completely failed: ${err}`);
      console.error('Error loading face-api models:', err);
      setError('Failed to load emotion detection models');
    } finally {
      setIsModelLoading(false);
    }
  }, [modelsLoaded, addDebugLog]);

  // Check camera permission status
  const checkCameraPermission = async () => {
    try {
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
        addDebugLog(`🔐 Camera permission status: ${permission.state}`);
        return permission.state;
      }
    } catch (err) {
      addDebugLog(`⚠️ Could not check camera permission: ${err}`);
    }
    return 'unknown';
  };

  // Start webcam with canvas rendering
  const startWebcam = async () => {
    addDebugLog('🔄 Starting webcam initialization...');
    setIsLoading(true);
    setError(null);

    try {
      addDebugLog('📱 Checking media devices support...');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported');
      }

      // Check environment and security requirements
      const envInfo = getEnvironmentInfo();
      addDebugLog(`🌍 Environment: ${envInfo.browserInfo}, HTTPS: ${envInfo.isHTTPS}, Localhost: ${envInfo.isLocalhost}`);

      if (!envInfo.isSecure) {
        addDebugLog('⚠️ Not on secure connection - camera access blocked');
        setError(`Camera access requires HTTPS. You're currently on ${location.protocol}//. Please use a secure connection or run on localhost for development.`);
        setIsLoading(false);
        return;
      }

      // Check permission status
      const permissionStatus = await checkCameraPermission();
      if (permissionStatus === 'denied') {
        addDebugLog('❌ Camera permission explicitly denied');
        setError('Camera access is blocked. Click the camera icon in your browser\'s address bar, select "Allow", then refresh and try again.');
        setIsLoading(false);
        return;
      }

      // Wait for video element to be available
      addDebugLog('🎥 Waiting for video element...');
      let retries = 0;
      const maxRetries = 10;

      while (!videoRef.current && retries < maxRetries) {
        addDebugLog(`⏳ Video element not ready, retry ${retries + 1}/${maxRetries}`);
        // Force a re-render to ensure DOM is updated
        setIsLoading(prev => prev);
        await new Promise(resolve => setTimeout(resolve, 200));
        retries++;
      }

      if (!videoRef.current) {
        addDebugLog('❌ Video element still not available, forcing component update...');
        // Try one more time after forcing a state update
        setError('Initializing video element...');
        await new Promise(resolve => setTimeout(resolve, 500));
        setError(null);

        if (!videoRef.current) {
          throw new Error('Video element reference is null after waiting and retrying');
        }
      }

      // Also check canvas ref
      if (!canvasRef.current) {
        addDebugLog('❌ Canvas element not available');
        throw new Error('Canvas element reference is null');
      }

      addDebugLog('✅ Video element found!');

      // Load models first
      addDebugLog('🤖 Loading AI models...');
      await loadModels();
      addDebugLog('✅ Models loaded successfully');

      // Get webcam stream
      addDebugLog('📹 Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });
      addDebugLog(`✅ Camera stream obtained: ${stream.getVideoTracks().length} video tracks`);

      const video = videoRef.current;
      addDebugLog(`🎥 Video element found: ${video.tagName}`);

      // Set stream
      video.srcObject = stream;
      streamRef.current = stream;
      addDebugLog('🔗 Stream assigned to video element');

      // Wait for video to be ready and play
      addDebugLog('⏳ Waiting for video metadata...');
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          addDebugLog('❌ Timeout waiting for video metadata');
          reject(new Error('Timeout waiting for video metadata'));
        }, 10000); // 10 second timeout

        // Set up event listeners
        const onLoadedMetadata = async () => {
          clearTimeout(timeout);
          addDebugLog(`📊 Video metadata loaded: ${video.videoWidth}x${video.videoHeight}, readyState: ${video.readyState}`);

          try {
            // Ensure video is ready to play
            if (video.readyState >= 2) {
              addDebugLog('▶️ Attempting to play video...');
              await video.play();
              addDebugLog('✅ Video playing successfully');

              video.removeEventListener('loadedmetadata', onLoadedMetadata);
              video.removeEventListener('error', onError);
              video.removeEventListener('canplay', onCanPlay);
              resolve();
            } else {
              addDebugLog(`⏳ Video not ready (readyState: ${video.readyState}), waiting...`);
              // Wait for canplay event
            }
          } catch (err) {
            addDebugLog(`❌ Error playing video: ${err}`);
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            video.removeEventListener('canplay', onCanPlay);
            reject(err);
          }
        };

        const onCanPlay = async () => {
          addDebugLog('🎬 Video can play event fired');
          try {
            await video.play();
            addDebugLog('✅ Video playing after canplay');
            clearTimeout(timeout);
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            video.removeEventListener('canplay', onCanPlay);
            resolve();
          } catch (err) {
            addDebugLog(`❌ Error playing video on canplay: ${err}`);
            clearTimeout(timeout);
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            video.removeEventListener('canplay', onCanPlay);
            reject(err);
          }
        };

        const onError = (err: Event) => {
          clearTimeout(timeout);
          addDebugLog(`❌ Video error event: ${err.type}`);
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('error', onError);
          video.removeEventListener('canplay', onCanPlay);
          reject(new Error('Video failed to load'));
        };

        video.addEventListener('loadedmetadata', onLoadedMetadata);
        video.addEventListener('error', onError);
        video.addEventListener('canplay', onCanPlay);

        // Check if already loaded
        if (video.readyState >= 2) {
          addDebugLog('📊 Video already has metadata loaded');
          onLoadedMetadata();
        } else if (video.readyState >= 3) {
          addDebugLog('🎬 Video already can play');
          onCanPlay();
        }
      });

      setIsWebcamActive(true);
      setIsLoading(false);
      addDebugLog('🎉 Webcam started successfully!');

      // Start emotion detection loop after a short delay
      setTimeout(() => {
        addDebugLog('🧠 Starting emotion detection...');
        startEmotionDetection();
      }, 500);

    } catch (error) {
      addDebugLog(`❌ Webcam startup failed: ${error}`);
      console.error('Error starting webcam:', error);
      let errorMessage = 'Camera access failed';

      if (error instanceof Error) {
        addDebugLog(`Error details: ${error.name} - ${error.message}`);
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera permission denied. Click the camera icon in your browser\'s address bar to allow access, then try again.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera found. Please connect a camera and try again.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera is in use by another application. Close other apps using the camera and try again.';
        } else if (error.name === 'AbortError') {
          errorMessage = 'Camera access was interrupted. Please try again.';
        } else if (error.message.includes('Video failed to load')) {
          errorMessage = 'Video playback failed. Try refreshing the page.';
        } else if (error.message.includes('getUserMedia not supported')) {
          errorMessage = 'Camera not supported in this browser. Try using Chrome, Firefox, or Safari.';
        } else if (error.message.includes('Timeout')) {
          errorMessage = 'Camera initialization timed out. Check your camera connection and try again.';
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
    addDebugLog('🛑 Stopping webcam...');

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      addDebugLog('⏹️ Emotion detection interval cleared');
    }

    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      addDebugLog(`🚫 Stopping ${tracks.length} media tracks`);
      tracks.forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      addDebugLog('🔌 Video element disconnected');
    }

    setIsWebcamActive(false);
    setIsDetecting(false);
    setError(null);
    setIsLoading(false);
    addDebugLog('✅ Webcam stopped successfully');
  };

  // Real emotion detection with face-api.js
  const startEmotionDetection = () => {
    if (!modelsLoaded || !videoRef.current || !canvasRef.current) {
      addDebugLog('❌ Cannot start detection: missing requirements');
      return;
    }

    addDebugLog('🧠 Emotion detection loop started');
    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current || !modelsLoaded) {
        addDebugLog('❌ Detection stopped: missing refs or models');
        return;
      }

      try {
        setIsDetecting(true);

        const video = videoRef.current;
        const canvas = canvasRef.current;

        // Skip if video is not ready
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          addDebugLog('⏳ Video not ready for detection');
          setIsDetecting(false);
          return;
        }

        addDebugLog(`🔍 Processing frame: ${video.videoWidth}x${video.videoHeight}`);

        // Set canvas dimensions to match the display size
        const rect = video.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        // Calculate scale factors for drawing detections
        const scaleX = rect.width / video.videoWidth;
        const scaleY = rect.height / video.videoHeight;
        addDebugLog(`📐 Scale factors: ${scaleX.toFixed(2)}x${scaleY.toFixed(2)}`);

        // Detect faces and expressions
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();

        addDebugLog(`👤 Detected ${detections.length} faces`);

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

            addDebugLog(`😊 Detected emotion: ${maxExpression} (${(confidence * 100).toFixed(0)}%)`);

            // Only update if confidence is high enough
            if (confidence > 0.4) {
              setDetectedEmotion(mappedEmotion);
              onEmotionDetected(mappedEmotion, 'webcam');
              addDebugLog(`✅ Emotion updated to: ${mappedEmotion}`);
            }

            // Draw emotion label
            ctx.fillStyle = '#00ff00';
            ctx.font = `${Math.max(12, scaledWidth * 0.08)}px Arial`;
            ctx.fillText(`${maxExpression} (${(confidence * 100).toFixed(0)}%)`, scaledX, scaledY - 10);
          } else {
            addDebugLog('👤 No faces detected in frame');
          }
        }

        setIsDetecting(false);
      } catch (err) {
        addDebugLog(`❌ Detection error: ${err}`);
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

  // Component initialization
  useEffect(() => {
    addDebugLog('🚀 EmotionDetector component mounted');

    // Log environment information
    const envInfo = getEnvironmentInfo();
    addDebugLog(`🌍 Environment - Browser: ${envInfo.browserInfo}, HTTPS: ${envInfo.isHTTPS}, Localhost: ${envInfo.isLocalhost}`);
    addDebugLog(`🔒 Secure context: ${envInfo.isSecure}`);
    addDebugLog(`📱 MediaDevices available: ${!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)}`);

    addDebugLog(`Initial refs - Video: ${videoRef.current ? 'Available' : 'NULL'}, Canvas: ${canvasRef.current ? 'Available' : 'NULL'}`);

    // Small delay to ensure refs are set
    setTimeout(() => {
      addDebugLog(`After delay refs - Video: ${videoRef.current ? 'Available' : 'NULL'}, Canvas: ${canvasRef.current ? 'Available' : 'NULL'}`);
    }, 100);

    return () => {
      addDebugLog('🔥 EmotionDetector component unmounting');
      stopWebcam();
    };
  }, [addDebugLog]);

  // Monitor ref changes
  useEffect(() => {
    if (videoRef.current) {
      addDebugLog('✅ Video ref now available');
    }
    if (canvasRef.current) {
      addDebugLog('✅ Canvas ref now available');
    }
  }, [videoRef.current, canvasRef.current, addDebugLog]);

  return (
    <Card className={cn("glass border-border/50", className)}>
      <div className="p-6 space-y-6">
        {/* Webcam Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-glow">AI Emotion Detection</h3>

          {/* Camera Requirements Info */}
          {!isWebcamActive && !error && (
            <div className="text-center p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <p className="text-sm text-blue-400 mb-2">📹 Camera access required for AI emotion detection</p>
              <p className="text-xs text-blue-300">Your browser will ask for permission to use your camera. Please click "Allow" to continue.</p>
            </div>
          )}

          {/* Model Loading Status */}
          {isModelLoading && (
            <div className="text-center p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <p className="text-sm text-blue-400">Loading AI models...</p>
            </div>
          )}
          
          <div className="relative">
            {/* Video Display */}
            <div className="relative rounded-lg overflow-hidden bg-muted/50" style={{ aspectRatio: '4/3' }}>
              {/* Video element - always rendered but conditionally visible */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isWebcamActive ? 'block' : 'hidden'}`}
                onError={(e) => {
                  addDebugLog(`❌ Video error event: ${e.type}`);
                  console.error('Video error:', e);
                  setError('Video playback failed');
                }}
                onLoadedMetadata={() => {
                  addDebugLog('📊 Video onLoadedMetadata event fired');
                  console.log('Video metadata loaded');
                }}
                onCanPlay={() => {
                  addDebugLog('🎬 Video onCanPlay event fired');
                }}
                onPlay={() => {
                  addDebugLog('▶️ Video onPlay event fired');
                }}
                onPause={() => {
                  addDebugLog('⏸️ Video onPause event fired');
                }}
              />

              {/* Canvas overlay for face detection - always rendered */}
              <canvas
                ref={canvasRef}
                className={`absolute top-0 left-0 w-full h-full pointer-events-none opacity-80 ${isWebcamActive ? 'block' : 'hidden'}`}
              />

              {/* Placeholder content when webcam is off */}
              {!isWebcamActive && (
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div className="text-center text-muted-foreground max-w-md">
                    {isLoading ? (
                      <>
                        <div className="w-12 h-12 mx-auto mb-2 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                        <p>Starting camera...</p>
                      </>
                    ) : error ? (
                      <div className="space-y-3">
                        <AlertTriangle className="w-12 h-12 mx-auto text-red-400" />
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-red-400">Camera Access Issue</p>
                          <p className="text-xs text-red-300">{error}</p>

                          {error.includes('permission denied') || error.includes('blocked') ? (
                            <div className="text-left bg-red-500/10 rounded p-3 space-y-2">
                              <p className="text-xs font-medium text-red-400">To fix this:</p>
                              <ol className="text-xs text-red-300 space-y-1 list-decimal list-inside">
                                <li>Look for a camera icon in your browser's address bar</li>
                                <li>Click it and select "Allow" or "Always allow"</li>
                                <li>Refresh the page and try again</li>
                                <li>If no icon appears, check your browser settings</li>
                              </ol>
                            </div>
                          ) : null}

                          <Button
                            onClick={startWebcam}
                            variant="outline"
                            size="sm"
                            className="mt-2"
                          >
                            Try Again
                          </Button>
                        </div>
                      </div>
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

          {/* Help Section */}
          <Collapsible open={showHelp} onOpenChange={setShowHelp}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
                <HelpCircle className="w-3 h-3 mr-2" />
                Camera troubleshooting help
                <ChevronDown className={`w-3 h-3 ml-2 transition-transform ${showHelp ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 mt-2">
              <div className="text-xs space-y-3 bg-muted/30 rounded p-3">
                <div>
                  <p className="font-medium text-muted-foreground mb-1">If camera access is blocked:</p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground/80">
                    <li>Look for a camera icon in your browser's address bar</li>
                    <li>Click it and change from "Block" to "Allow"</li>
                    <li>Refresh the page and try again</li>
                  </ol>
                </div>

                <div>
                  <p className="font-medium text-muted-foreground mb-1">Browser-specific steps:</p>
                  <div className="space-y-2">
                    <div>
                      <span className="font-medium">Chrome:</span> Settings → Privacy & Security → Site Settings → Camera
                    </div>
                    <div>
                      <span className="font-medium">Firefox:</span> Settings → Privacy & Security → Permissions → Camera
                    </div>
                    <div>
                      <span className="font-medium">Safari:</span> Safari → Preferences → Websites → Camera
                    </div>
                  </div>
                </div>

                <div>
                  <p className="font-medium text-muted-foreground mb-1">Other issues:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground/80">
                    <li>Close other apps that might be using your camera</li>
                    <li>Try refreshing the page</li>
                    <li>Restart your browser</li>
                    <li>Check if your camera is properly connected</li>
                  </ul>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
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

        {/* Debug Panel */}
        {debugMode && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-muted-foreground">Debug Console</h4>
              <Button
                onClick={() => setDebugLogs([])}
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
              >
                Clear
              </Button>
            </div>
            <div className="bg-black/80 rounded-lg p-3 max-h-40 overflow-y-auto">
              {debugLogs.length === 0 ? (
                <p className="text-gray-400 text-xs">No debug logs yet...</p>
              ) : (
                <div className="space-y-1">
                  {debugLogs.map((log, index) => (
                    <p key={index} className="text-xs font-mono text-green-400 leading-tight">
                      {log}
                    </p>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setDebugMode(false)}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                Hide Debug
              </Button>
              <Button
                onClick={() => {
                  addDebugLog('🔍 Manual test log');
                  addDebugLog(`Video ref: ${videoRef.current ? 'Available' : 'NULL'}`);
                  addDebugLog(`Canvas ref: ${canvasRef.current ? 'Available' : 'NULL'}`);
                  addDebugLog(`Stream ref: ${streamRef.current ? 'Available' : 'NULL'}`);
                  if (videoRef.current) {
                    const video = videoRef.current;
                    addDebugLog(`Video state: readyState=${video.readyState}, paused=${video.paused}, ended=${video.ended}`);
                    addDebugLog(`Video dimensions: ${video.videoWidth}x${video.videoHeight}`);
                    addDebugLog(`Video src: ${video.src || 'No src'}`);
                    addDebugLog(`Video srcObject: ${video.srcObject ? 'Set' : 'NULL'}`);
                  }
                }}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                Test Debug
              </Button>
              <Button
                onClick={() => {
                  addDebugLog('🔄 Manual component refresh triggered');
                  setIsWebcamActive(false);
                  setIsLoading(false);
                  setError(null);
                  setDetectedEmotion(null);
                  if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                    streamRef.current = null;
                  }
                  if (videoRef.current) {
                    videoRef.current.srcObject = null;
                  }
                  addDebugLog('✅ Component state reset');
                }}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                Reset
              </Button>
            </div>
          </div>
        )}

        {/* Debug toggle for non-debug mode */}
        {!debugMode && (
          <Button
            onClick={() => setDebugMode(true)}
            variant="outline"
            size="sm"
            className="w-full text-xs"
          >
            Show Debug Console
          </Button>
        )}
      </div>
    </Card>
  );
};

export default EmotionDetector;
