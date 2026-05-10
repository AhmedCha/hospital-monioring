import { useEffect, useRef, useState, useCallback } from "react";
import * as faceapi from "face-api.js";

interface DetectedFace {
  descriptor: Float32Array;
  confidence: number;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface DetectionResult {
  faces: DetectedFace[];
  isLoading: boolean;
  error: string | null;
}

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";

export function useFaceDetection() {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  // Load face-api models
  useEffect(() => {
    if (loadingRef.current || modelsLoaded) return;
    loadingRef.current = true;

    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
        setError(null);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to load face detection models";
        setError(errorMsg);
        console.error("Face detection model loading error:", err);
      }
    };

    loadModels();
  }, [modelsLoaded]);

  // Detect faces in an image or video frame
  const detectFaces = useCallback(
    async (input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<DetectedFace[]> => {
      if (!modelsLoaded) {
        return [];
      }

      try {
        const detections = await faceapi
          .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptors();

        return detections.map((detection) => ({
          descriptor: detection.descriptor,
          confidence: detection.detection.score,
          box: {
            x: detection.detection.box.x,
            y: detection.detection.box.y,
            width: detection.detection.box.width,
            height: detection.detection.box.height,
          },
        }));
      } catch (err) {
        console.error("Face detection error:", err);
        return [];
      }
    },
    [modelsLoaded]
  );

  // Compare two face descriptors
  const compareFaces = useCallback((descriptor1: Float32Array, descriptor2: Float32Array): number => {
    const distance = faceapi.euclideanDistance(descriptor1, descriptor2);
    // Convert distance to confidence (lower distance = higher confidence)
    // Distance typically ranges from 0 to 1, where < 0.6 is considered a match
    return Math.max(0, 1 - distance);
  }, []);

  // Find best matching face from a list of descriptors
  const findBestMatch = useCallback(
    (detectedDescriptor: Float32Array, enrolledDescriptors: Float32Array[]): { confidence: number; index: number } | null => {
      if (enrolledDescriptors.length === 0) {
        return null;
      }

      let bestConfidence = 0;
      let bestIndex = -1;

      enrolledDescriptors.forEach((enrolled, index) => {
        const confidence = compareFaces(detectedDescriptor, enrolled);
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestIndex = index;
        }
      });

        // Only return match if confidence is above threshold (0.6 confidence = 0.4 distance)
        return bestConfidence > 0.6 ? { confidence: bestConfidence, index: bestIndex } : null;
    },
    [compareFaces]
  );

  return {
    modelsLoaded,
    error,
    detectFaces,
    compareFaces,
    findBestMatch,
  };
}
