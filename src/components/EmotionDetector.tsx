import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, CameraOff, Smile, Frown, Meh, Zap, AlertTriangle, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as faceapi from 'face-api.js';
import { useI18n } from '@/i18n/I18nProvider';

interface EmotionDetectorProps {
  onEmotionDetected: (emotion: string, source: 'webcam' | 'emoji' | 'upload') => void;
  className?: string;
}

const emotionDefs = [
  { emotion: 'happy', icon: Smile, color: 'text-yellow-400' },
  { emotion: 'sad', icon: Frown, color: 'text-blue-400' },
  { emotion: 'neutral', icon: Meh, color: 'text-gray-400' },
  { emotion: 'surprised', icon: Zap, color: 'text-purple-400' },
  { emotion: 'angry', icon: AlertTriangle, color: 'text-red-400' },
];

const EmotionDetector: React.FC<EmotionDetectorProps> = ({ onEmotionDetected, className }) => {
  const { t } = useI18n();

  // Webcam state
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [detectedEmotion, setDetectedEmotion] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isEmotionLocked, setIsEmotionLocked] = useState(false);
  const emotionLockedRef = useRef(false);
  const MIN_CONFIDENCE = 0.55;

  // UI state
  const [emotionChanged, setEmotionChanged] = useState(false);
  const [previousEmotion, setPreviousEmotion] = useState<string | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const addDebugLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
  }, []);

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

  const loadModels = useCallback(async () => {
    if (modelsLoaded) {
      addDebugLog('✅ Models already loaded, skipping...');
      return;
    }

    addDebugLog('📦 Starting model loading...');
    setIsModelLoading(true);
    try {
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
      setError(t('emotion.loading_models'));
    } finally {
      setIsModelLoading(false);
    }
  }, [modelsLoaded, addDebugLog, t]);

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

  const startWebcam = async () => {
    addDebugLog('🔄 Starting webcam initialization...');
    setIsLoading(true);
    setError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported');
      }

      const envInfo = getEnvironmentInfo();
      if (!envInfo.isSecure) {
        setError('Camera access requires HTTPS.');
        setIsLoading(false);
        return;
      }

      const permissionStatus = await checkCameraPermission();
      if (permissionStatus === 'denied') {
        setError('Camera access is blocked.');
        setIsLoading(false);
        return;
      }

      let retries = 0;
      const maxRetries = 10;
      while (!videoRef.current && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 200));
        retries++;
      }

      if (!videoRef.current || !canvasRef.current) {
        throw new Error('Video/canvas not ready');
      }

      await loadModels();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });

      const video = videoRef.current;
      video.srcObject = stream;
      streamRef.current = stream;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout waiting for video metadata')), 10000);
        const onLoaded = async () => {
          clearTimeout(timeout);
          try {
            if (video.readyState >= 2) {
              await video.play();
              cleanup();
              resolve();
            }
          } catch (err) {
            cleanup();
            reject(err);
          }
        };
        const onError = () => { cleanup(); reject(new Error('Video failed to load')); };
        const cleanup = () => {
          video.removeEventListener('loadedmetadata', onLoaded);
          video.removeEventListener('canplay', onLoaded);
          video.removeEventListener('error', onError);
        };
        video.addEventListener('loadedmetadata', onLoaded);
        video.addEventListener('canplay', onLoaded);
        video.addEventListener('error', onError);
        if (video.readyState >= 2) onLoaded();
      });

      setIsWebcamActive(true);
      setIsLoading(false);
      setTimeout(() => startEmotionDetection(), 500);
    } catch (error) {
      console.error('Error starting webcam:', error);
      let errorMessage = 'Camera access failed';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') errorMessage = 'Camera permission denied.';
        else if (error.name === 'NotFoundError') errorMessage = 'No camera found.';
        else if (error.name === 'NotReadableError') errorMessage = 'Camera is in use by another application.';
        else if (error.name === 'AbortError') errorMessage = 'Camera access was interrupted.';
        else if (error.message.includes('Video failed to load')) errorMessage = 'Video playback failed.';
        else if (error.message.includes('getUserMedia not supported')) errorMessage = 'Camera not supported in this browser.';
      }
      setError(errorMessage);
      setIsLoading(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  };

  const stopWebcam = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsWebcamActive(false);
    setIsDetecting(false);
    setError(null);
    setIsLoading(false);
  };

  const startEmotionDetection = () => {
    if (!modelsLoaded || !videoRef.current || !canvasRef.current) {
      return;
    }

    intervalRef.current = setInterval(async () => {
      if (emotionLockedRef.current) return;
      if (!videoRef.current || !canvasRef.current || !modelsLoaded) return;

      try {
        setIsDetecting(true);
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          setIsDetecting(false);
          return;
        }

        const rect = video.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        const scaleX = rect.width / video.videoWidth;
        const scaleY = rect.height / video.videoHeight;

        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.6 }))
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

            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 3;
            ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);

            const expressions = detection.expressions;
            const maxExpression = Object.keys(expressions).reduce((a, b) =>
              expressions[a as keyof typeof expressions] > expressions[b as keyof typeof expressions] ? a : b
            );

            const emotionMap: { [key: string]: string } = {
              happy: 'happy',
              sad: 'sad',
              angry: 'angry',
              surprised: 'surprised',
              neutral: 'neutral',
              disgusted: 'angry',
              fearful: 'surprised',
            };

            const mappedEmotion = emotionMap[maxExpression] || 'neutral';
            const confidence = expressions[maxExpression as keyof typeof expressions];

            if (confidence >= MIN_CONFIDENCE) {
              setDetectedEmotion(mappedEmotion);
              onEmotionDetected(mappedEmotion, 'webcam');
            }

            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(scaledX, scaledY - 35, scaledWidth, 25);

            ctx.fillStyle = '#00ff00';
            ctx.font = `bold ${Math.max(14, scaledWidth * 0.08)}px Arial`;
            ctx.fillText(`${maxExpression} (${(confidence * 100).toFixed(0)}%)`, scaledX + 5, scaledY - 15);
          }
        }

        setIsDetecting(false);
      } catch (err) {
        console.error('Emotion detection error:', err);
        setIsDetecting(false);
      }
    }, 2000);
  };

  const handleEmotionSelect = (emotion: string) => {
    setDetectedEmotion(emotion);
    onEmotionDetected(emotion, 'emoji');
  };

  const detectEmotionNow = async () => {
    if (!videoRef.current || !canvasRef.current || !modelsLoaded || !isWebcamActive) return;

    setIsDetecting(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        setIsDetecting(false);
        return;
      }

      const rect = video.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      const scaleX = rect.width / video.videoWidth;
      const scaleY = rect.height / video.videoHeight;

      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.6 }))
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

          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 4;
          ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);

          const expressions = detections[0].expressions;
          const maxExpression = Object.keys(expressions).reduce((a, b) =>
            expressions[a as keyof typeof expressions] > expressions[b as keyof typeof expressions] ? a : b
          );

          const emotionMap: { [key: string]: string } = {
            happy: 'happy',
            sad: 'sad',
            angry: 'angry',
            surprised: 'surprised',
            neutral: 'neutral',
            disgusted: 'angry',
            fearful: 'surprised',
          };

          const mappedEmotion = emotionMap[maxExpression] || 'neutral';
          const confidence = expressions[maxExpression as keyof typeof expressions];

          if (confidence >= 0.5) {
            setDetectedEmotion(mappedEmotion);
            onEmotionDetected(mappedEmotion, 'webcam');
          }

          ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
          ctx.fillRect(scaledX, scaledY - 40, scaledWidth, 30);

          ctx.fillStyle = '#000';
          ctx.font = `bold ${Math.max(16, scaledWidth * 0.1)}px Arial`;
          ctx.fillText(`${maxExpression} (${(confidence * 100).toFixed(0)}%)`, scaledX + 5, scaledY - 20);
        } else {
          ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          ctx.fillStyle = '#ff0000';
          ctx.font = 'bold 24px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(t('emotion.no_face'), canvas.width / 2, canvas.height / 2);
          ctx.textAlign = 'left';
        }
      }

      setIsDetecting(false);
    } catch (error) {
      setIsDetecting(false);
    }
  };

  const handleDetectEmotionToggle = async () => {
    if (!isEmotionLocked) {
      await detectEmotionNow();
      setIsEmotionLocked(true);
    } else {
      setIsEmotionLocked(false);
    }
  };

  useEffect(() => {
    emotionLockedRef.current = isEmotionLocked;
  }, [isEmotionLocked]);

  useEffect(() => {
    if (detectedEmotion && detectedEmotion !== previousEmotion) {
      setEmotionChanged(true);
      setPreviousEmotion(detectedEmotion);
      const timer = setTimeout(() => setEmotionChanged(false), 800);
      return () => clearTimeout(timer);
    }
  }, [detectedEmotion, previousEmotion]);

  useEffect(() => {
    return () => { stopWebcam(); };
  }, []);

  return (
    <Card className={cn('glass border-border/50', className)}>
      <div className="p-6 space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-glow">{t('emotion.detector.title')}</h3>

          {isModelLoading && (
            <div className="text-center p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <p className="text-sm text-blue-400">{t('emotion.loading_models')}</p>
            </div>
          )}

          <div className="relative">
            <div className="relative rounded-lg overflow-hidden bg-muted/50" style={{ aspectRatio: '4/3' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isWebcamActive ? 'block' : 'hidden'}`}
                onError={(e) => { setError('Video playback failed'); }}
              />

              <canvas ref={canvasRef} className={`absolute top-0 left-0 w-full h-full pointer-events-none opacity-80 ${isWebcamActive ? 'block' : 'hidden'}`} />

              {!isWebcamActive && (
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div className="text-center text-muted-foreground max-w-md">
                    {isLoading ? (
                      <>
                        <div className="w-12 h-12 mx-auto mb-2 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                        <p className="text-sm font-medium">{t('emotion.starting_camera')}</p>
                        <p className="text-xs mt-2 text-muted-foreground/70">{t('emotion.preparing')}</p>
                      </>
                    ) : error ? (
                      <div className="space-y-3">
                        <AlertTriangle className="w-12 h-12 mx-auto text-red-400" />
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-red-400">{t('emotion.camera_issue')}</p>
                          <p className="text-xs text-red-300">{error}</p>
                          <Button onClick={startWebcam} variant="outline" size="sm" className="mt-2">
                            {t('emotion.try_again')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Camera className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="font-medium mb-2">{t('emotion.ready')}</p>
                        <p className="text-xs text-muted-foreground/70">{t('emotion.ready_sub')}</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {isDetecting && (
                <div className="absolute top-2 right-2 bg-gradient-to-r from-green-500 to-blue-500 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-lg animate-pulse">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                    <span>{t('emotion.ai_detecting')}</span>
                  </div>
                </div>
              )}

              {isModelLoading && (
                <div className="absolute top-2 left-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-spin"></div>
                    <span>{t('emotion.loading_ai')}</span>
                  </div>
                </div>
              )}

              {modelsLoaded && isWebcamActive && !isDetecting && (
                <div className="absolute top-2 left-2 bg-gradient-to-r from-green-400 to-emerald-500 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                    <span>{t('emotion.ai_ready')}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                onClick={isWebcamActive ? stopWebcam : startWebcam}
                variant={isWebcamActive ? 'destructive' : 'default'}
                size="sm"
                className="flex-1"
                disabled={isLoading || isModelLoading}
              >
                {isWebcamActive ? <CameraOff className="w-4 h-4 mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
                {isLoading ? t('emotion.starting') : isWebcamActive ? t('emotion.stop_camera') : t('emotion.start_camera')}
              </Button>
            </div>

            {isWebcamActive && (
              <div className="flex gap-2">
                <Button
                  onClick={handleDetectEmotionToggle}
                  variant="default"
                  size="sm"
                  disabled={isDetecting || (!modelsLoaded && !isEmotionLocked) || !isWebcamActive}
                  className="flex-1 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                >
                  {isEmotionLocked ? <Unlock className="w-4 h-4 mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                  {isDetecting ? t('emotion.detecting') : isEmotionLocked ? t('emotion.resume_detection') : t('emotion.detect_emotion')}
                </Button>
              </div>
            )}

            {isWebcamActive && (
              <div className="text-center p-2 bg-muted/20 rounded-lg">
                <div className="flex items-center justify-center space-x-2 text-xs">
                  {modelsLoaded ? (
                    <>
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-green-400">{t('emotion.models_ready')}</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                      <span className="text-yellow-400">{t('emotion.models_loading')}</span>
                    </>
                  )}
                </div>

                {isDetecting && (
                  <div className="flex items-center justify-center space-x-2 text-xs mt-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    <span className="text-blue-400">{t('emotion.analyzing')}</span>
                  </div>
                )}
                {isEmotionLocked && (
                  <div className="flex items-center justify-center space-x-2 text-xs mt-1">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                    <span className="text-yellow-400">{t('emotion.locked')}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-center">
            <h4 className="text-sm font-medium text-muted-foreground mb-1">{t('emotion.manual.title')}</h4>
            <p className="text-xs text-muted-foreground/70">{t('emotion.manual.subtitle')}</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {emotionDefs.map(({ emotion, icon: Icon, color }) => (
              <Button
                key={emotion}
                onClick={() => handleEmotionSelect(emotion)}
                variant={detectedEmotion === emotion ? 'default' : 'outline'}
                size="sm"
                className={cn('h-auto py-3 flex flex-col gap-1 transition-all duration-300', detectedEmotion === emotion && 'ring-2 ring-primary/50 shadow-lg scale-105')}
              >
                <Icon className={cn('w-5 h-5 transition-all duration-300', color, detectedEmotion === emotion && 'scale-110')} />
                <span className="text-xs">{t(`emotions.${emotion}`)}</span>
              </Button>
            ))}
          </div>
        </div>

        {detectedEmotion && (
          <div className={cn('relative', emotionChanged && 'emotion-change')}>
            <div className={cn('text-center p-6 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg border border-primary/30 backdrop-blur-sm transition-all duration-700', emotionChanged && 'scale-105')}>
              <div className="mb-3">
                <div className={cn('w-16 h-16 mx-auto mb-3 rounded-full bg-primary/20 flex items-center justify-center transition-all duration-500', emotionChanged ? 'bounce-in emotion-glow-pulse' : 'animate-pulse')}>
                  {emotionDefs.find(e => e.emotion === detectedEmotion)?.icon && (
                    React.createElement(emotionDefs.find(e => e.emotion === detectedEmotion)!.icon, {
                      className: cn('w-8 h-8 transition-all duration-500', emotionDefs.find(e => e.emotion === detectedEmotion)!.color, emotionChanged && 'scale-125')
                    })
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-1">{t('emotion.detected_label')}</p>
                <p className={cn('text-2xl font-bold text-primary capitalize mb-2 transition-all duration-500', emotionChanged && 'text-3xl')}>{detectedEmotion}</p>
              </div>

              <div className={cn('space-y-2', emotionChanged && 'slide-in-up')}>
                <div className="flex items-center justify-center space-x-2 text-xs text-muted-foreground">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span>{t('emotion.generating_music')}</span>
                </div>
                <div className="flex items-center justify-center space-x-2 text-xs text-muted-foreground">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  <span>{t('emotion.updating_aura')}</span>
                </div>
              </div>
            </div>

            <div className={cn('absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg blur-xl -z-10', emotionChanged ? 'emotion-glow-pulse' : 'animate-pulse')}></div>
            {emotionChanged && <div className="absolute inset-0 border-2 border-primary/30 rounded-lg ripple-effect"></div>}
          </div>
        )}
      </div>
    </Card>
  );
};

export default EmotionDetector;
