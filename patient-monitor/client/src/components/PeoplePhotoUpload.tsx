import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFaceDetection } from "@/hooks/useFaceDetection";
import { toast } from "sonner";
import { Upload, Check, AlertCircle, Loader2 } from "lucide-react";

interface PeoplePhotoUploadProps {
  personId: string;
  personName: string;
  onPhotoEnrolled: (photoUrl: string, faceDescriptor: Float32Array) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PeoplePhotoUpload({
  personId,
  personName,
  onPhotoEnrolled,
  isOpen,
  onOpenChange,
}: PeoplePhotoUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const { modelsLoaded, detectFaces } = useFaceDetection();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
      setDetectionStatus("idle");
      setErrorMessage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleEnrollFace = async () => {
    if (!selectedFile || !preview || !imageRef.current) {
      toast.error("Please select a photo first");
      return;
    }

    if (!modelsLoaded) {
      toast.error("Face detection models are still loading");
      return;
    }

    setIsProcessing(true);
    setDetectionStatus("processing");

    try {
      // Wait for image to load
      await new Promise((resolve) => {
        if (imageRef.current?.complete) {
          resolve(null);
        } else {
          imageRef.current?.addEventListener("load", resolve, { once: true });
        }
      });

      // Detect faces in the image
      const faces = await detectFaces(imageRef.current!);

      if (faces.length === 0) {
        setDetectionStatus("error");
        setErrorMessage("No face detected in the image. Please try another photo.");
        toast.error("No face detected in the image");
      } else if (faces.length > 1) {
        setDetectionStatus("error");
        setErrorMessage("Multiple faces detected. Please provide a photo with only one person.");
        toast.error("Multiple faces detected");
      } else {
        // Single face detected - use it as the enrolled descriptor
        const enrolledDescriptor = faces[0].descriptor;
        setDetectionStatus("success");

        // Call the callback with the photo URL and descriptor
        onPhotoEnrolled(preview, enrolledDescriptor);

        // Reset form
        setTimeout(() => {
          setSelectedFile(null);
          setPreview(null);
          setDetectionStatus("idle");
          setErrorMessage(null);
          onOpenChange(false);
        }, 1500);
      }
    } catch (error) {
      setDetectionStatus("error");
      const errorMsg = error instanceof Error ? error.message : "Failed to process photo";
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enroll Person Photo</DialogTitle>
          <DialogDescription>
            Upload a clear photo of {personName} for facial recognition enrollment
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-square border-2 border-dashed border-gray-300">
            {preview ? (
              <>
                <img
                  ref={imageRef}
                  src={preview}
                  alt="Person photo preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white"
                  >
                    Change Photo
                  </Button>
                </div>
              </>
            ) : (
              <div
                className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-600 text-center px-4">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 10MB</p>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {detectionStatus === "processing" && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6 text-center">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin mx-auto mb-2" />
                <p className="font-medium text-blue-900 text-sm">Detecting face...</p>
              </CardContent>
            </Card>
          )}

          {detectionStatus === "success" && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-6 text-center">
                <Check className="w-5 h-5 text-green-600 mx-auto mb-2" />
                <p className="font-medium text-green-900 text-sm">Face enrolled!</p>
              </CardContent>
            </Card>
          )}

          {detectionStatus === "error" && errorMessage && (
            <Card className="bg-red-50 border-red-200">
              <CardContent className="pt-6 text-center">
                <AlertCircle className="w-5 h-5 text-red-600 mx-auto mb-2" />
                <p className="text-sm text-red-700">{errorMessage}</p>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEnrollFace}
              disabled={!preview || isProcessing || !modelsLoaded || detectionStatus === "success"}
              className="flex-1"
            >
              {isProcessing ? "Processing..." : "Enroll Face"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
