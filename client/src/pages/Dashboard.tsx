import { useState, useRef, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useFaceDetection } from "@/hooks/useFaceDetection";
import { database } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Camera, AlertCircle, CheckCircle, Clock, Loader2, User, UserCheck, Shield, Users, HeartPulse, Activity, Thermometer, Droplets } from "lucide-react";

type DetectionStatus = "idle" | "present" | "absent" | "unknown";

interface VitalsData {
  heartRate: number;
  spO2: number;
  timestamp: number;
}

interface RoomData {
  temperature: number;
  humidity: number;
  timestamp: number;
}

export default function Dashboard() {
  const { data: people } = trpc.people.list.useQuery();
  const logEventMutation = trpc.events.log.useMutation();
  
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState<DetectionStatus>("idle");
  const [lastDetectionTime, setLastDetectionTime] = useState<Date | null>(null);
  const [confidenceScore, setConfidenceScore] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentlyInRoom, setCurrentlyInRoom] = useState<{name: string, role: string}[]>([]);
  
  // Real-time Firebase data states
  const [currentVitals, setCurrentVitals] = useState<VitalsData | null>(null);
  const [currentRoomData, setCurrentRoomData] = useState<RoomData | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastEventTimeRef = useRef<{ [key: string]: number }>({});

  const { modelsLoaded, detectFaces, findBestMatch } = useFaceDetection();

  // Prepare the dataset of known faces and their descriptors
  const { knownPeople, enrolledDescriptors } = useMemo(() => {
    if (!people) {
      console.log("[Dashboard] People query returned no data yet");
      return { knownPeople: [], enrolledDescriptors: [] };
    }
    
    const kp: typeof people = [];
    const ed: Float32Array[] = [];
    
    console.log(`[Dashboard] Processing ${people.length} total people for recognition...`);

    people.forEach(p => {
      const desc = p.enrolledFaceDescriptor;
      if (!desc) return;

      let descriptor: Float32Array | null = null;
      
      try {
        // Case 1: TRPC/JSON serialized Buffer: { type: 'Buffer', data: [...] }
        if (typeof desc === 'object' && desc !== null && 'data' in desc && Array.isArray((desc as any).data)) {
          const uint8 = new Uint8Array((desc as any).data);
          const ab = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
          descriptor = new Float32Array(ab);
        } 
        // Case 2: Already a TypedArray or Buffer instance
        else if (desc instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(desc))) {
          const uint8 = new Uint8Array(desc as any);
          const ab = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
          descriptor = new Float32Array(ab);
        }
        // Case 3: Plain array of numbers
        else if (Array.isArray(desc)) {
          descriptor = new Float32Array(desc as number[]);
        }
        // Case 4: JSON string — could be "[0.12, ...]" or {"0":0.12,"1":...} (Float32Array serialised by MySQL)
        else if (typeof desc === 'string') {
          const parsed = JSON.parse(desc);
          if (Array.isArray(parsed)) {
            // Clean array: "[0.12, -0.34, ...]"
            descriptor = new Float32Array(parsed);
          } else if (parsed && typeof parsed === 'object' && 'data' in parsed && Array.isArray((parsed as any).data)) {
            // Stringified Buffer object: { type: 'Buffer', data: [...] }
            const uint8 = new Uint8Array((parsed as any).data);
            const ab = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
            descriptor = new Float32Array(ab);
          } else if (parsed && typeof parsed === 'object') {
            // Float32Array serialised by MySQL as {"0": x, "1": y, ...}
            const values = Object.values(parsed) as number[];
            descriptor = new Float32Array(values);
          }
        }
      } catch (e) {
        console.error(`[Dashboard] Failed to parse descriptor for ${p.name}:`, e);
      }
      
      if (descriptor && descriptor.length === 128) {
        kp.push(p);
        ed.push(descriptor);
      } else if (descriptor) {
        console.warn(`[Dashboard] Person ${p.name} has invalid descriptor length: ${descriptor.length}`);
      }
    });
    
    console.log(`[Dashboard] Successfully loaded ${kp.length} identities into neural engine`);
    return { knownPeople: kp, enrolledDescriptors: ed };
  }, [people]);

  const selectedPatient = people?.find((p) => String(p.id) === selectedPatientId);

  // Firebase Realtime Subscriptions
  useEffect(() => {
    if (!selectedPatient || !selectedPatient.firebaseId) {
      setCurrentVitals(null);
      return;
    }

    const vitalsRef = ref(database, `patients/${selectedPatient.firebaseId}`);
    const unsubscribeVitals = onValue(vitalsRef, (snapshot) => {
      if (snapshot.exists()) {
        // Find the latest entry (child with the newest timestamp)
        const data = snapshot.val();
        // Since firebase stores pushes as an object of unique IDs:
        const entries = Object.values(data) as VitalsData[];
        if (entries.length > 0) {
          // Sort to find the latest
          entries.sort((a, b) => b.timestamp - a.timestamp);
          setCurrentVitals(entries[0]);
        }
      } else {
        setCurrentVitals(null);
      }
    });

    return () => unsubscribeVitals();
  }, [selectedPatient?.firebaseId]);

  useEffect(() => {
    if (!selectedPatient || !selectedPatient.roomId) {
      setCurrentRoomData(null);
      return;
    }

    const roomRef = ref(database, `rooms/${selectedPatient.roomId}`);
    const unsubscribeRoom = onValue(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const entries = Object.values(data) as RoomData[];
        if (entries.length > 0) {
          entries.sort((a, b) => b.timestamp - a.timestamp);
          setCurrentRoomData(entries[0]);
        }
      } else {
        setCurrentRoomData(null);
      }
    });

    return () => unsubscribeRoom();
  }, [selectedPatient?.roomId]);

  const startCamera = async () => {
    if (!selectedPatient?.enrolledFaceDescriptor) {
      toast.error("Patient must have enrolled face descriptor");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreaming(true);
        startDetection();
      }
    } catch (error) {
      toast.error("Failed to access camera");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach((track) => track.stop());
      streamRef.current = null;
      setIsStreaming(false);
    }
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    setDetectionStatus("idle");
    setCurrentlyInRoom([]);
  };

  const startDetection = () => {
    if (!modelsLoaded || !selectedPatient) return;

    detectionIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current || !selectedPatient) return;

      setIsProcessing(true);
      try {
        const faces = await detectFaces(videoRef.current);
        const now = Date.now();
        const recognizedInFrame: {name: string, role: string}[] = [];

        if (faces.length === 0) {
          setDetectionStatus("absent");
          setConfidenceScore(0);
          setLastDetectionTime(new Date());
          setCurrentlyInRoom([]);

          const lastAbsenceTime = lastEventTimeRef.current["absence"] || 0;
          if (now - lastAbsenceTime > 60000) {
            await logEventMutation.mutateAsync({
              personId: selectedPatient.id,
              eventType: "patient absent",
              severity: "warning",
              roomId: selectedPatient.roomId || "unknown",
              description: "Patient not detected in camera frame",
            });
            lastEventTimeRef.current["absence"] = now;
          }
        } else {
          let isPatientInFrame = false;
          let patientConfidence = 0;

          const ctx = canvasRef.current.getContext("2d");
          if (ctx) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }

          for (const face of faces) {
            const match = findBestMatch(face.descriptor, enrolledDescriptors);
            let personName = "Unknown";
            let personRole = "other";
            let color = "#ef4444";

            if (match) {
              const person = knownPeople[match.index];
              personName = person.name;
              personRole = person.role;
              recognizedInFrame.push({ name: person.name, role: person.role });

              if (person.id === selectedPatient.id) {
                isPatientInFrame = true;
                patientConfidence = match.confidence;
                color = "#10b981";
              } else if (person.role === 'doctor' || person.role === 'nurse') {
                color = "#6366f1";
              } else {
                color = "#f59e0b";
              }

              const lastRecTime = lastEventTimeRef.current[`rec-${person.id}`] || 0;
              if (now - lastRecTime > 120000) {
                await logEventMutation.mutateAsync({
                  personId: person.id,
                  eventType: "person recognized",
                  severity: "info",
                  roomId: selectedPatient.roomId || "unknown",
                  description: `${person.role} ${person.name} detected in room.`,
                });
                lastEventTimeRef.current[`rec-${person.id}`] = now;
              }
            } else {
              const lastUnknownTime = lastEventTimeRef.current["unknown"] || 0;
              if (now - lastUnknownTime > 30000) {
                await logEventMutation.mutateAsync({
                  eventType: "unknown person detected",
                  severity: "alert",
                  roomId: selectedPatient.roomId || "unknown",
                  description: "Unauthorized person detected in room.",
                });
                lastEventTimeRef.current["unknown"] = now;
              }
            }

            if (ctx) {
              ctx.strokeStyle = color;
              ctx.lineWidth = 3;
              ctx.strokeRect(face.box.x, face.box.y, face.box.width, face.box.height);
              
              ctx.fillStyle = color;
              ctx.font = "bold 16px Inter, sans-serif";
              const label = `${personName}${match ? ` (${(match.confidence * 100).toFixed(0)}%)` : ""}`;
              ctx.fillText(label, face.box.x, face.box.y - 10);
            }
          }

          setCurrentlyInRoom(recognizedInFrame);
          
          if (isPatientInFrame) {
            setDetectionStatus("present");
            setConfidenceScore(patientConfidence);
          } else {
            setDetectionStatus("absent");
          }
          setLastDetectionTime(new Date());
        }
      } catch (err) {
        console.error("Detection error:", err);
      } finally {
        setIsProcessing(false);
      }
    }, 600);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Patient Dashboard</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-500" />
            Unified Monitoring & AI Face Recognition
          </p>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Heart Rate */}
        <Card className="bg-white border-slate-100 shadow-sm relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-slate-500">Heart Rate</CardTitle>
            <HeartPulse className={`w-4 h-4 ${currentVitals && currentVitals.heartRate > 100 ? 'text-red-500 animate-pulse' : 'text-slate-400'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">
              {currentVitals ? `${currentVitals.heartRate}` : "--"}
              <span className="text-sm font-medium text-slate-500 ml-1">bpm</span>
            </div>
          </CardContent>
        </Card>

        {/* SpO2 */}
        <Card className="bg-white border-slate-100 shadow-sm relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-slate-500">SpO2</CardTitle>
            <Activity className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">
              {currentVitals ? `${currentVitals.spO2}` : "--"}
              <span className="text-sm font-medium text-slate-500 ml-1">%</span>
            </div>
          </CardContent>
        </Card>

        {/* Temperature */}
        <Card className="bg-white border-slate-100 shadow-sm relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-slate-500">Room Temp</CardTitle>
            <Thermometer className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">
              {currentRoomData ? `${currentRoomData.temperature}` : "--"}
              <span className="text-sm font-medium text-slate-500 ml-1">°C</span>
            </div>
          </CardContent>
        </Card>

        {/* Humidity */}
        <Card className="bg-white border-slate-100 shadow-sm relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-slate-500">Room Humidity</CardTitle>
            <Droplets className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">
              {currentRoomData ? `${currentRoomData.humidity}` : "--"}
              <span className="text-sm font-medium text-slate-500 ml-1">%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Main Feed Section */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-none shadow-xl overflow-hidden bg-slate-900 ring-1 ring-slate-800">
            <div className="relative aspect-video group">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
              
              {!isStreaming && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm">
                  <div className="text-center animate-in fade-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-indigo-500/20">
                      <Camera className="w-10 h-10 text-indigo-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Camera Offline</h3>
                    <p className="text-slate-400 max-w-xs mx-auto">Select a patient and start monitoring to activate the neural recognition engine.</p>
                  </div>
                </div>
              )}

              {isStreaming && (
                <div className="absolute top-4 left-4 flex gap-2">
                  <div className="bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 border border-white/10">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    LIVE FEED
                  </div>
                  {isProcessing && (
                    <div className="bg-indigo-500/80 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      PROCESSING
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="p-6 bg-white border-t border-slate-100">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="text-xs font-bold text-slate-500 mb-2 block uppercase tracking-tight">Active Patient Selection</label>
                  <Select value={selectedPatientId} onValueChange={setSelectedPatientId} disabled={isStreaming}>
                    <SelectTrigger className="h-12 border-slate-200 focus:ring-indigo-500">
                      <SelectValue placeholder="Select a patient to begin monitoring..." />
                    </SelectTrigger>
                    <SelectContent>
                      {people?.filter(p => p.role === 'patient').map((patient) => (
                        <SelectItem key={patient.id} value={String(patient.id)}>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{patient.name}</span>
                            <span className="text-xs text-slate-400">— Room {patient.roomId}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    onClick={startCamera}
                    disabled={isStreaming || !selectedPatientId || !modelsLoaded || !selectedPatient?.enrolledFaceDescriptor}
                    className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Initialize Monitor
                  </Button>
                  <Button
                    onClick={stopCamera}
                    disabled={!isStreaming}
                    variant="outline"
                    className="h-12 px-6 border-slate-200 hover:bg-slate-50 text-slate-600"
                  >
                    Terminate
                  </Button>
                </div>
              </div>
              {!selectedPatient?.enrolledFaceDescriptor && selectedPatientId && (
                <p className="mt-3 text-sm text-red-500 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-4 h-4" />
                  Biometric data missing for this patient. Please enroll their face in Patient Management.
                </p>
              )}
              {selectedPatient && !selectedPatient?.firebaseId && selectedPatientId && (
                <p className="mt-3 text-sm text-amber-500 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-4 h-4" />
                  Patient not synced with Firebase. Real-time vitals will be unavailable.
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar Info Section */}
        <div className="lg:col-span-4 space-y-6">
          <Card className={`border-none shadow-lg transition-all duration-500 ${
            detectionStatus === 'present' ? 'bg-emerald-50 ring-1 ring-emerald-200' : 
            detectionStatus === 'absent' ? 'bg-amber-50 ring-1 ring-amber-200' : 
            detectionStatus === 'unknown' ? 'bg-rose-50 ring-1 ring-rose-200' : 'bg-white'
          }`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500">Detection Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 py-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                  detectionStatus === 'present' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' :
                  detectionStatus === 'absent' ? 'bg-amber-500 text-white shadow-lg shadow-amber-200' :
                  detectionStatus === 'unknown' ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'bg-slate-100 text-slate-400'
                }`}>
                  {detectionStatus === 'present' ? <CheckCircle className="w-8 h-8" /> :
                   detectionStatus === 'absent' ? <Clock className="w-8 h-8" /> :
                   detectionStatus === 'unknown' ? <AlertCircle className="w-8 h-8" /> : <Camera className="w-8 h-8" />}
                </div>
                <div>
                  <h4 className="text-2xl font-black text-slate-900 leading-tight">
                    {detectionStatus === 'present' ? "Patient Present" :
                     detectionStatus === 'absent' ? "Patient Absent" :
                     detectionStatus === 'unknown' ? "Unknown Activity" : "Standby Mode"}
                  </h4>
                  <p className="text-sm font-medium text-slate-500 mt-0.5">
                    {isStreaming ? `Tracking Room ${selectedPatient?.roomId || '...'}` : "Monitoring inactive"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500 flex justify-between">
                Who's In Room
                <Users className="w-4 h-4" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {currentlyInRoom.length > 0 ? (
                  currentlyInRoom.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 animate-in slide-in-from-right-2 duration-300" style={{animationDelay: `${i * 100}ms`}}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${p.role === 'doctor' ? 'bg-blue-500' : p.role === 'nurse' ? 'bg-teal-500' : 'bg-indigo-500'}`}>
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-900">{p.name}</p>
                        <p className="text-[10px] font-bold uppercase tracking-tighter text-slate-400">{p.role}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 opacity-40">
                    <User className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-xs font-semibold">No identified persons</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500">Recognition Analytics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <span className="text-slate-500 font-medium">Matching Confidence</span>
                  <span className={`font-bold ${confidenceScore > 0.8 ? 'text-green-600' : 'text-amber-600'}`}>
                    {(confidenceScore * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <span className="text-slate-500 font-medium">Last Neural Sync</span>
                  <span className="font-bold text-slate-900">
                    {lastDetectionTime ? lastDetectionTime.toLocaleTimeString() : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <span className="text-slate-500 font-medium">Known Dataset Size</span>
                  <span className="font-bold text-indigo-600">{knownPeople.length} Identities</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
