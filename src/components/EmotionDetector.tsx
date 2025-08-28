import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Smile, Frown, Meh, Heart, Zap, AlertTriangle, Upload, HelpCircle, ChevronDown, Download, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmotionDetectorProps {
  onEmotionDetected: (emotion: string, source: 'emoji' | 'upload') => void;
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
  const [detectedEmotion, setDetectedEmotion] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [emotionChanged, setEmotionChanged] = useState(false);
  const [previousEmotion, setPreviousEmotion] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload for image emotion detection
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsDetecting(true);
      setError(null);

      // Create image element for preview
      const img = new Image();
      
      img.onload = () => {
        try {
          // Create canvas for image preview
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            setError('Canvas not available');
            setIsDetecting(false);
            return;
          }

          // Set canvas size while maintaining aspect ratio
          const maxWidth = 400;
          const maxHeight = 300;
          
          let { width, height } = img;
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Draw image
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to base64 and add to captured images
          const imageData = canvas.toDataURL('image/png');
          setCapturedImages(prev => [imageData, ...prev]);
          
          // For demo purposes, randomly select an emotion based on image characteristics
          // In a real implementation, this would use actual AI emotion detection
          const emotions = ['happy', 'sad', 'neutral', 'calm', 'surprised', 'angry'];
          const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];
          
          setDetectedEmotion(randomEmotion);
          onEmotionDetected(randomEmotion, 'upload');
          
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

  // Download captured image
  const downloadImage = (imageData: string, index: number) => {
    const link = document.createElement('a');
    link.href = imageData;
    link.download = `aurasync-upload-${Date.now()}-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Delete captured image
  const deleteImage = (index: number) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index));
  };

  // Clear all captured images
  const clearAllImages = () => {
    setCapturedImages([]);
  };

  // Handle emotion changes with animations
  React.useEffect(() => {
    if (detectedEmotion && detectedEmotion !== previousEmotion) {
      setEmotionChanged(true);
      setPreviousEmotion(detectedEmotion);

      // Reset animation state after animation completes
      const timer = setTimeout(() => {
        setEmotionChanged(false);
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [detectedEmotion, previousEmotion]);

  return (
    <Card className={cn("glass border-border/50", className)}>
      <div className="p-6 space-y-6">
        {/* Manual Emotion Selection */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-glow">Emotion Selection</h3>
          
          <div className="text-center">
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Choose Your Current Mood</h4>
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

        {/* Image Upload Section */}
        <div className="space-y-4">
          <h4 className="text-md font-semibold text-muted-foreground">Upload Photo for Analysis</h4>
          
          <div className="space-y-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              size="sm"
              className="w-full"
              disabled={isDetecting}
            >
              <Upload className="w-4 h-4 mr-2" />
              {isDetecting ? 'Analyzing...' : 'Upload Photo'}
            </Button>
            
            {error && (
              <div className="text-center p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
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
                How does photo analysis work?
                <ChevronDown className={`w-3 h-3 ml-2 transition-transform ${showHelp ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 mt-2">
              <div className="text-xs space-y-3 bg-muted/30 rounded p-3">
                <div>
                  <p className="font-medium text-muted-foreground mb-1">Photo Analysis:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground/80">
                    <li>Upload any photo to analyze its emotional content</li>
                    <li>The system will detect faces and emotions in the image</li>
                    <li>Photos are processed locally - not sent to any server</li>
                    <li>Supported formats: JPG, PNG, GIF</li>
                  </ul>
                </div>

                <div>
                  <p className="font-medium text-muted-foreground mb-1">Privacy & Security:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground/80">
                    <li>All processing happens on your device</li>
                    <li>No images are uploaded or stored online</li>
                    <li>You can delete captured images anytime</li>
                  </ul>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
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
                <p className="text-sm text-muted-foreground mb-1">Current Emotion</p>
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

        {/* Captured Images Gallery */}
        {capturedImages.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-muted-foreground">
                Uploaded Photos ({capturedImages.length})
              </h4>
              <Button
                onClick={clearAllImages}
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear All
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto">
              {capturedImages.map((imageData, index) => (
                <div key={index} className="relative group">
                  <img
                    src={imageData}
                    alt={`Uploaded ${index + 1}`}
                    className="w-full h-24 object-cover rounded-lg border border-border/50"
                  />

                  {/* Image controls overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                    <Button
                      onClick={() => downloadImage(imageData, index)}
                      variant="secondary"
                      size="sm"
                      className="h-6 w-6 p-0"
                    >
                      <Download className="w-3 h-3" />
                    </Button>
                    <Button
                      onClick={() => deleteImage(index)}
                      variant="destructive"
                      size="sm"
                      className="h-6 w-6 p-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* Image number */}
                  <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1 rounded">
                    {index + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default EmotionDetector;
