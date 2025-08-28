import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Camera, CameraOff, Smile, Frown, Meh, Heart, Zap, AlertTriangle, HelpCircle, ChevronDown } from 'lucide-react';
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
  // Webcam state
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [detectedEmotion, setDetectedEmotion] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  
  // UI state
  const [showHelp, setShowHelp] = useState(false);
  const [emotionChanged, setEmotionChanged] = useState(false);
  const [previousEmotion, setPreviousEmotion] = useState<string | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Debug logging function
  const addDebugLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
  }, []);

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
      // Always use CDN for reliability
      addDebugLog('🌐 Loading models from CDN...');
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model'),
        faceapi.nets.faceExpressionNet.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model'),
      ]);
      addDebugLog('✅ Models loaded from CDN successfully');

      setModelsLoaded(true);
      setError(null);
      addDebugLog('🎉 All models loaded and ready for detection!');
    } catch (err) {
      addDebugLog(`❌ Model loading completely failed: ${err}`);
      console.error('Error loading face-api models:', err);
      setError('Failed to load emotion detection models. Please check your internet connection.');
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
        await new Promise(resolve => setTimeout(resolve, 200));
        retries++;
      }

      if (!videoRef.current) {
        addDebugLog('❌ Video element still not available');
        throw new Error('Video element reference is null after waiting');
      }

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
      video.srcObject = stream;
      streamRef.current = stream;
      addDebugLog('🔗 Stream assigned to video element');

      // Wait for video to be ready and play
      addDebugLog('⏳ Waiting for video metadata...');
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          addDebugLog('❌ Timeout waiting for video metadata');
          reject(new Error('Timeout waiting for video metadata'));
        }, 10000);

        const onLoadedMetadata = async () => {
          clearTimeout(timeout);
          addDebugLog(`📊 Video metadata loaded: ${video.videoWidth}x${video.videoHeight}`);

          try {
            if (video.readyState >= 2) {
              addDebugLog('▶️ Attempting to play video...');
              await video.play();
              addDebugLog('✅ Video playing successfully');
              cleanup();
              resolve();
            }
          } catch (err) {
            addDebugLog(`❌ Error playing video: ${err}`);
            cleanup();
            reject(err);
          }
        };

        const onCanPlay = async () => {
          addDebugLog('🎬 Video can play event fired');
          try {
            await video.play();
            addDebugLog('✅ Video playing after canplay');
            cleanup();
            resolve();
          } catch (err) {
            addDebugLog(`❌ Error playing video on canplay: ${err}`);
            cleanup();
            reject(err);
          }
        };

        const onError = () => {
          addDebugLog('❌ Video error event');
          cleanup();
          reject(new Error('Video failed to load'));
        };

        const cleanup = () => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('canplay', onCanPlay);
          video.removeEventListener('error', onError);
        };

        video.addEventListener('loadedmetadata', onLoadedMetadata);
        video.addEventListener('canplay', onCanPlay);
        video.addEventListener('error', onError);

        if (video.readyState >= 2) {
          onLoadedMetadata();
        } else if (video.readyState >= 3) {
          onCanPlay();
        }
      });

      setIsWebcamActive(true);
      setIsLoading(false);
      addDebugLog('🎉 Webcam started successfully!');

      // Start emotion detection loop
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
      addDebugLog(`Models loaded: ${modelsLoaded}, Video: ${!!videoRef.current}, Canvas: ${!!canvasRef.current}`);
      return;
    }

    addDebugLog('🧠 Emotion detection loop started');
    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current || !modelsLoaded) {
        addDebugLog('⚠️ Detection loop: missing requirements, skipping...');
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

        // Set canvas dimensions to match video display
        const rect = video.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        // Calculate scale factors
        const scaleX = rect.width / video.videoWidth;
        const scaleY = rect.height / video.videoHeight;
        addDebugLog(`📐 Scale factors: ${scaleX.toFixed(2)}x${scaleY.toFixed(2)}`);

        // Detect faces and expressions
        addDebugLog('🤖 Running face detection...');
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
          .withFaceExpressions();

        addDebugLog(`👤 Detected ${detections.length} faces`);

        // Clear canvas and draw detections
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (detections.length > 0) {
            const detection = detections[0];
            const { x, y, width, height } = detection.detection.box;

            // Scale coordinates
            const scaledX = x * scaleX;
            const scaledY = y * scaleY;
            const scaledWidth = width * scaleX;
            const scaledHeight = height * scaleY;

            // Draw face detection box
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 3;
            ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);

            // Get all expressions for debugging
            const expressions = detection.expressions;
            addDebugLog(`😊 Expression scores: ${JSON.stringify(Object.fromEntries(
              Object.entries(expressions).map(([key, val]) => [key, (val * 100).toFixed(1) + '%'])
            ))}`);

            // Get dominant emotion
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

            addDebugLog(`��� Dominant emotion: ${maxExpression} (${(confidence * 100).toFixed(1)}%) -> ${mappedEmotion}`);

            // Lower threshold for better detection
            if (confidence > 0.2) {
              setDetectedEmotion(mappedEmotion);
              onEmotionDetected(mappedEmotion, 'webcam');
              addDebugLog(`✅ Emotion updated to: ${mappedEmotion}`);
            } else {
              addDebugLog(`⚠️ Confidence too low: ${(confidence * 100).toFixed(1)}%`);
            }

            // Draw emotion label with background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(scaledX, scaledY - 35, scaledWidth, 25);

            ctx.fillStyle = '#00ff00';
            ctx.font = `bold ${Math.max(14, scaledWidth * 0.08)}px Arial`;
            ctx.fillText(`${maxExpression} (${(confidence * 100).toFixed(0)}%)`, scaledX + 5, scaledY - 15);
          } else {
            addDebugLog('👤 No faces detected in frame');
          }
        }

        setIsDetecting(false);
      } catch (err) {
        addDebugLog(`❌ Detection error: ${err}`);
        console.error('Emotion detection error:', err);
        setIsDetecting(false);
      }
    }, 2000); // Slightly slower interval for better performance
  };


  const handleEmotionSelect = (emotion: string) => {
    setDetectedEmotion(emotion);
    onEmotionDetected(emotion, 'emoji');
  };

  // Manual emotion detection trigger
  const detectEmotionNow = async () => {
    if (!videoRef.current || !canvasRef.current || !modelsLoaded || !isWebcamActive) {
      addDebugLog('❌ Cannot detect: requirements not met');
      return;
    }

    addDebugLog('🎯 Manual emotion detection triggered');
    setIsDetecting(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        addDebugLog('⏳ Video not ready for manual detection');
        setIsDetecting(false);
        return;
      }

      // Set canvas dimensions
      const rect = video.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      const scaleX = rect.width / video.videoWidth;
      const scaleY = rect.height / video.videoHeight;

      // Detect faces and expressions
      addDebugLog('🤖 Running manual face detection...');
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
        .withFaceExpressions();

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (detections.length > 0) {
          const detection = detections[0];
          const { x, y, width, height } = detection.detection.box;

          const scaledX = x * scaleX;
          const scaledY = y * scaleY;
          const scaledWidth = width * scaleX;
          const scaledHeight = height * scaleY;

          // Draw detection box with pulsing effect
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 4;
          ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);

          const expressions = detection.expressions;
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
          const confidence = expressions[maxExpression as keyof typeof expressions];

          addDebugLog(`🎭 Manual detection result: ${maxExpression} (${(confidence * 100).toFixed(1)}%)`);

          if (confidence > 0.15) {
            setDetectedEmotion(mappedEmotion);
            onEmotionDetected(mappedEmotion, 'webcam');
            addDebugLog(`✅ Manual detection successful: ${mappedEmotion}`);
          }

          // Draw label with enhanced styling
          ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
          ctx.fillRect(scaledX, scaledY - 40, scaledWidth, 30);

          ctx.fillStyle = '#000';
          ctx.font = `bold ${Math.max(16, scaledWidth * 0.1)}px Arial`;
          ctx.fillText(`${maxExpression} (${(confidence * 100).toFixed(0)}%)`, scaledX + 5, scaledY - 20);
        } else {
          addDebugLog('👤 No faces detected in manual detection');
          // Draw "no face" indicator
          ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          ctx.fillStyle = '#ff0000';
          ctx.font = 'bold 24px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('No Face Detected', canvas.width / 2, canvas.height / 2);
          ctx.textAlign = 'left';
        }
      }

      setIsDetecting(false);
    } catch (error) {
      addDebugLog(`❌ Manual detection error: ${error}`);
      setIsDetecting(false);
    }
  };


  // Handle emotion changes with animations
  useEffect(() => {
    if (detectedEmotion && detectedEmotion !== previousEmotion) {
      setEmotionChanged(true);
      setPreviousEmotion(detectedEmotion);

      const timer = setTimeout(() => {
        setEmotionChanged(false);
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [detectedEmotion, previousEmotion]);

  // Component initialization
  useEffect(() => {
    addDebugLog('🚀 EmotionDetector component mounted');

    const envInfo = getEnvironmentInfo();
    addDebugLog(`🌍 Environment - Browser: ${envInfo.browserInfo}, HTTPS: ${envInfo.isHTTPS}`);
    addDebugLog(`🔒 Secure context: ${envInfo.isSecure}`);

    return () => {
      addDebugLog('🔥 EmotionDetector component unmounting');
      stopWebcam();
    };
  }, [addDebugLog]);

  return (
    <Card className={cn("glass border-border/50", className)}>
      <div className="p-6 space-y-6">
        {/* AI Webcam Section */}
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
              {/* Video element */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isWebcamActive ? 'block' : 'hidden'}`}
                onError={(e) => {
                  addDebugLog(`❌ Video error event: ${e.type}`);
                  setError('Video playback failed');
                }}
              />

              {/* Canvas overlay for face detection */}
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
                        <p className="text-sm font-medium">Starting camera...</p>
                        <p className="text-xs mt-2 text-muted-foreground/70">Preparing AI emotion detection</p>
                      </>
                    ) : error ? (
                      <div className="space-y-3">
                        <AlertTriangle className="w-12 h-12 mx-auto text-red-400" />
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-red-400">Camera Access Issue</p>
                          <p className="text-xs text-red-300">{error}</p>
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
                        <Camera className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="font-medium mb-2">AI Emotion Detection Ready</p>
                        <p className="text-xs text-muted-foreground/70">Start camera to detect emotions and get personalized music</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Detection indicator */}
              {isDetecting && (
                <div className="absolute top-2 right-2 bg-gradient-to-r from-green-500 to-blue-500 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-lg animate-pulse">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                    <span>AI Detecting...</span>
                  </div>
                </div>
              )}

              {/* Models loading indicator */}
              {isModelLoading && (
                <div className="absolute top-2 left-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-spin"></div>
                    <span>Loading AI...</span>
                  </div>
                </div>
              )}

              {/* Models ready indicator */}
              {modelsLoaded && isWebcamActive && !isDetecting && (
                <div className="absolute top-2 left-2 bg-gradient-to-r from-green-400 to-emerald-500 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                    <span>AI Ready</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-2">
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

            </div>

            {/* Detection Controls - Only show when webcam is active */}
            {isWebcamActive && (
              <div className="flex gap-2">
                <Button
                  onClick={detectEmotionNow}
                  variant="default"
                  size="sm"
                  disabled={isDetecting || !modelsLoaded || !isWebcamActive}
                  className="flex-1 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  {isDetecting ? 'Detecting...' : 'Detect Emotion'}
                </Button>
              </div>
            )}

            {/* Detection Status Indicator */}
            {isWebcamActive && (
              <div className="text-center p-2 bg-muted/20 rounded-lg">
                <div className="flex items-center justify-center space-x-2 text-xs">
                  {modelsLoaded ? (
                    <>
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-green-400">AI Models Ready</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                      <span className="text-yellow-400">Loading AI Models...</span>
                    </>
                  )}
                </div>

                {isDetecting && (
                  <div className="flex items-center justify-center space-x-2 text-xs mt-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    <span className="text-blue-400">Analyzing facial expressions...</span>
                  </div>
                )}
              </div>
            )}
          </div>
          

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
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Manual Emotion Selection */}
        <div className="space-y-4">
          <div className="text-center">
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Manual Mood Selection</h4>
            <p className="text-xs text-muted-foreground/70">Click an emotion to instantly get music recommendations</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {emotionEmojis.map(({ emotion, icon: Icon, label, color }) => (
              <Button
                key={emotion}
                onClick={() => handleEmotionSelect(emotion)}
                variant={detectedEmotion === emotion ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-auto py-3 flex flex-col gap-1 transition-all duration-300",
                  detectedEmotion === emotion && "ring-2 ring-primary/50 shadow-lg scale-105"
                )}
              >
                <Icon className={cn("w-5 h-5 transition-all duration-300", color, detectedEmotion === emotion && "scale-110")} />
                <span className="text-xs">{label}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Current Emotion Display */}
        {detectedEmotion && (
          <div className={cn("relative", emotionChanged && "emotion-change")}>
            <div className={cn(
              "text-center p-6 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg border border-primary/30 backdrop-blur-sm transition-all duration-700",
              emotionChanged && "scale-105"
            )}>
              <div className="mb-3">
                <div className={cn(
                  "w-16 h-16 mx-auto mb-3 rounded-full bg-primary/20 flex items-center justify-center transition-all duration-500",
                  emotionChanged ? "bounce-in emotion-glow-pulse" : "animate-pulse"
                )}>
                  {emotionEmojis.find(e => e.emotion === detectedEmotion)?.icon && (
                    React.createElement(emotionEmojis.find(e => e.emotion === detectedEmotion)!.icon, {
                      className: cn(
                        'w-8 h-8 transition-all duration-500',
                        emotionEmojis.find(e => e.emotion === detectedEmotion)!.color,
                        emotionChanged && "scale-125"
                      )
                    })
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-1">Detected Emotion</p>
                <p className={cn(
                  "text-2xl font-bold text-primary capitalize mb-2 transition-all duration-500",
                  emotionChanged && "text-3xl"
                )}>{detectedEmotion}</p>
              </div>

              <div className={cn("space-y-2", emotionChanged && "slide-in-up")}>
                <div className="flex items-center justify-center space-x-2 text-xs text-muted-foreground">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span>Generating personalized music...</span>
                </div>
                <div className="flex items-center justify-center space-x-2 text-xs text-muted-foreground">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  <span>Updating your aura visualization</span>
                </div>
              </div>
            </div>

            {/* Enhanced glow effect with animation */}
            <div className={cn(
              "absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg blur-xl -z-10",
              emotionChanged ? "emotion-glow-pulse" : "animate-pulse"
            )}></div>

            {/* Ripple effect on emotion change */}
            {emotionChanged && (
              <div className="absolute inset-0 border-2 border-primary/30 rounded-lg ripple-effect"></div>
            )}
          </div>
        )}


      </div>
    </Card>
  );
};

export default EmotionDetector;
