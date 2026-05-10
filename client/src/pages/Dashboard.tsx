import { useState, useRef, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useFaceDetection } from "@/hooks/useFaceDetection";
import { database } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Camera, AlertCircle, CheckCircle, Clock, Loader2, User, UserCheck, Shield, Users, HeartPulse, Activity, Thermometer, Droplets, Settings2, BellRing, TrendingUp } from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/_core/hooks/useAuth";

type DetectionStatus = "idle" | "present" | "absent" | "unknown" | "unauthorized";

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
  const { user } = useAuth();
  const { data: people } = trpc.people.list.useQuery();
  const logEventMutation = trpc.events.log.useMutation();
  const sendEmailMutation = trpc.people.sendAlertEmail.useMutation();
  
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState<DetectionStatus>("idle");
  const [lastDetectionTime, setLastDetectionTime] = useState<Date | null>(null);
  const [confidenceScore, setConfidenceScore] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentlyInRoom, setCurrentlyInRoom] = useState<{name: string, role: string, isAuthorized: boolean}[]>([]);
  
  // Real-time Firebase data states
  const [currentVitals, setCurrentVitals] = useState<VitalsData | null>(null);
  const [currentRoomData, setCurrentRoomData] = useState<RoomData | null>(null);
  const [vitalsHistory, setVitalsHistory] = useState<VitalsData[]>([]);
  const [roomHistory, setRoomHistory] = useState<RoomData[]>([]);

  // Threshold States
  const [thresholds, setThresholds] = useState({
    hrMax: 100,
    hrMin: 50,
    spo2Min: 94,
    tempMax: 30,
    tempMin: 18,
    humidityMax: 70,
    humidityMin: 20
  });

  const sendEmailAlert = async (subject: string, message: string) => {
    if (!selectedPatient || !people) return;
    
    const doctor = people.find(p => p.id === selectedPatient.assignedDoctorId);
    const nurse = people.find(p => p.id === selectedPatient.assignedNurseId);
    
    const recipients = [doctor?.email, nurse?.email].filter(Boolean) as string[];
    
    if (recipients.length === 0) {
      console.warn("[Dashboard] No assigned staff with email found for patient:", selectedPatient.name);
      return;
    }

    for (const email of recipients) {
      try {
        await sendEmailMutation.mutateAsync({
          recipientEmail: email,
          subject: `[CLINICAL ALERT] ${subject} - ${selectedPatient.name}`,
          message: `
Patient: ${selectedPatient.name}
Room: ${selectedPatient.roomId}
Time: ${new Date().toLocaleString()}

Alert Details:
${message}

Please check the monitoring dashboard immediately.
          `.trim()
        });
      } catch (e) {
        console.error("Failed to send email alert:", e);
      }
    }
  };

  const checkThresholds = (vitals: VitalsData | null, room: RoomData | null) => {
    if (!vitals && !room) return;
    
    const now = Date.now();
    const alertThrottle = 10000; // 10 seconds between same alert type

    if (vitals) {
      if (vitals.heartRate > thresholds.hrMax && (now - (lastEventTimeRef.current['hr-high'] || 0) > alertThrottle)) {
        toast.error(`Critical Heart Rate: ${vitals.heartRate} BPM (High)`, { duration: 5000 });
        if (now - (lastEmailTimeRef.current['hr-high'] || 0) > EMAIL_COOLDOWN) {
          sendEmailAlert("Critical Heart Rate", `Heart rate reached ${vitals.heartRate} BPM, exceeding the safe limit of ${thresholds.hrMax} BPM.`);
          lastEmailTimeRef.current['hr-high'] = now;
        }
        lastEventTimeRef.current['hr-high'] = now;
      }
      if (vitals.heartRate < thresholds.hrMin && (now - (lastEventTimeRef.current['hr-low'] || 0) > alertThrottle)) {
        toast.error(`Critical Heart Rate: ${vitals.heartRate} BPM (Low)`, { duration: 5000 });
        if (now - (lastEmailTimeRef.current['hr-low'] || 0) > EMAIL_COOLDOWN) {
          sendEmailAlert("Critical Heart Rate", `Heart rate dropped to ${vitals.heartRate} BPM, below the safe limit of ${thresholds.hrMin} BPM.`);
          lastEmailTimeRef.current['hr-low'] = now;
        }
        lastEventTimeRef.current['hr-low'] = now;
      }
      if (vitals.spO2 < thresholds.spo2Min && (now - (lastEventTimeRef.current['spo2-low'] || 0) > alertThrottle)) {
        toast.error(`Low Oxygen Saturation: ${vitals.spO2}%`, { duration: 5000 });
        if (now - (lastEmailTimeRef.current['spo2-low'] || 0) > EMAIL_COOLDOWN) {
          sendEmailAlert("Critical SpO2 Level", `Oxygen saturation dropped to ${vitals.spO2}%, which is below the safe threshold of ${thresholds.spo2Min}%.`);
          lastEmailTimeRef.current['spo2-low'] = now;
        }
        lastEventTimeRef.current['spo2-low'] = now;
      }
    }

    if (room) {
      if (room.temperature > thresholds.tempMax && (now - (lastEventTimeRef.current['temp-high'] || 0) > alertThrottle)) {
        toast.warning(`High Room Temperature: ${room.temperature}°C`, { duration: 5000 });
        lastEventTimeRef.current['temp-high'] = now;
      }
      if (room.temperature < thresholds.tempMin && (now - (lastEventTimeRef.current['temp-low'] || 0) > alertThrottle)) {
        toast.warning(`Low Room Temperature: ${room.temperature}°C`, { duration: 5000 });
        lastEventTimeRef.current['temp-low'] = now;
      }
    }
  };
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastEventTimeRef = useRef<{ [key: string]: number }>({});
  const lastEmailTimeRef = useRef<{ [key: string]: number }>({});
  const lastFaceSeenTimeRef = useRef<number>(0);

  // Alert Stabilization Counters
  const absenceCounterRef = useRef<number>(0);
  const unknownCounterRef = useRef<{ [key: string]: number }>({});
  const unauthCounterRef = useRef<{ [key: string]: number }>({});

  const EMAIL_COOLDOWN = 15 * 60 * 1000; // 15 minutes
  const STABILITY_THRESHOLD = 5; // Must be consistent for 5 frames (~3 seconds)

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
        const data = snapshot.val();
        const entries = Object.values(data) as VitalsData[];
        if (entries.length > 0) {
          entries.sort((a, b) => b.timestamp - a.timestamp);
          const latest = entries[0];
          setCurrentVitals(latest);
          
          // Update history (keep last 20 readings)
          setVitalsHistory(prev => {
            const updated = [...prev, latest].sort((a, b) => a.timestamp - b.timestamp);
            return updated.slice(-20);
          });

          checkThresholds(latest, null);
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
          const latest = entries[0];
          setCurrentRoomData(latest);

          // Update history (keep last 20 readings)
          setRoomHistory(prev => {
            const updated = [...prev, latest].sort((a, b) => a.timestamp - b.timestamp);
            return updated.slice(-20);
          });

          checkThresholds(null, latest);
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
        const recognizedInFrame: {name: string, role: string, isAuthorized: boolean}[] = [];

        if (faces.length === 0) {
          setDetectionStatus("absent");
          setConfidenceScore(0);
          setLastDetectionTime(new Date());
          setCurrentlyInRoom([]);
        } else {
          lastFaceSeenTimeRef.current = now;
          let isPatientInFrame = false;
          let patientConfidence = 0;
          let unknownCount = 0;
          const seenIds = new Set<string>();
          const seenUnknown = { global: false };

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
            let isAuthorized = false;
            let color = "#ef4444";

            if (match) {
              const person = knownPeople[match.index];
              personName = person.name;
              personRole = person.role;
              
              if (person.id === selectedPatient.id) {
                isPatientInFrame = true;
                patientConfidence = match.confidence;
                color = "#10b981";
              } else {
                seenIds.add(person.id);
                const authorizedIds = [
                  selectedPatient.assignedDoctorId,
                  selectedPatient.assignedNurseId
                ].filter(Boolean);
                const isAuthorized = authorizedIds.includes(person.id);

                if (!isAuthorized) {
                  // Unauthorized Recognition Stabilization
                  unauthCounterRef.current[person.id] = (unauthCounterRef.current[person.id] || 0) + 1;

                  if (unauthCounterRef.current[person.id] >= STABILITY_THRESHOLD) {
                    const lastUnauthTime = lastEventTimeRef.current[`unauth-${person.id}`] || 0;
                    if (now - lastUnauthTime > 120000) {
                      await logEventMutation.mutateAsync({
                        personId: person.id,
                        eventType: "person recognized",
                        severity: "alert",
                        roomId: selectedPatient.roomId || "unknown",
                        description: `Unauthorized person ${person.name} (${person.role}) entered the room.`,
                        isAuthorized: 0
                      });

                      if (now - (lastEmailTimeRef.current[`unauth-${person.id}`] || 0) > EMAIL_COOLDOWN) {
                        sendEmailAlert("Unauthorized Entry", `${person.name} (${person.role}) has entered ${selectedPatient.name}'s room but is not assigned to this patient.`);
                        lastEmailTimeRef.current[`unauth-${person.id}`] = now;
                      }
                      lastEventTimeRef.current[`unauth-${person.id}`] = now;
                    }
                  }
                }
              }
              
              recognizedInFrame.push({ name: person.name, role: person.role, isAuthorized: person.id === selectedPatient.id || isAuthorized });

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
              unknownCount++;
              seenUnknown.global = true;
              
              // Unknown Stabilization
              unknownCounterRef.current["global"] = (unknownCounterRef.current["global"] || 0) + 1;

              if (unknownCounterRef.current["global"] >= STABILITY_THRESHOLD) {
                const lastUnknownTime = lastEventTimeRef.current["unknown"] || 0;
                if (now - lastUnknownTime > 30000) {
                  await logEventMutation.mutateAsync({
                    eventType: "unknown person detected",
                    severity: "alert",
                    roomId: selectedPatient.roomId || "unknown",
                    description: "Unauthorized person detected in room.",
                    isAuthorized: 0
                  });

                  if (now - (lastEmailTimeRef.current['unknown'] || 0) > EMAIL_COOLDOWN) {
                    sendEmailAlert("Unknown Person Detected", `An unidentified individual has been detected in ${selectedPatient.name}'s room.`);
                    lastEmailTimeRef.current['unknown'] = now;
                  }
                  lastEventTimeRef.current["unknown"] = now;
                }
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

          // Add unknown persons to the room list
          for (let i = 0; i < unknownCount; i++) {
            recognizedInFrame.push({ name: "Unknown Person", role: "unknown", isAuthorized: false });
          }

          // Reset counters for those not seen
          for (const id in unauthCounterRef.current) {
            if (!seenIds.has(id)) unauthCounterRef.current[id] = 0;
          }
          if (!seenUnknown.global) unknownCounterRef.current["global"] = 0;

          setCurrentlyInRoom(recognizedInFrame);
          
          if (isPatientInFrame) {
            setDetectionStatus("present");
            setConfidenceScore(patientConfidence);
            absenceCounterRef.current = 0;
          } else {
            setDetectionStatus("absent");
            setConfidenceScore(0);
            
            // Patient Absence Stabilization
            absenceCounterRef.current++;
            if (absenceCounterRef.current >= STABILITY_THRESHOLD) {
              const lastAbsenceTime = lastEventTimeRef.current["absence"] || 0;
              if (now - lastAbsenceTime > 60000) {
                await logEventMutation.mutateAsync({
                  personId: selectedPatient.id,
                  eventType: "patient absent",
                  severity: "warning",
                  roomId: selectedPatient.roomId || "unknown",
                  description: "Patient not detected in camera frame",
                });
                
                if (now - (lastEmailTimeRef.current['absence'] || 0) > EMAIL_COOLDOWN) {
                  sendEmailAlert("Patient Missing", `The patient is no longer detected by the room camera. Immediate room check required.`);
                  lastEmailTimeRef.current['absence'] = now;
                }
                lastEventTimeRef.current["absence"] = now;
              }
            }
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

        <div className="flex items-center gap-3">
          {(user?.role === "admin" || user?.role === "doctor") && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-12 gap-2 border-slate-200 hover:bg-slate-50 shadow-sm transition-all active:scale-95">
                  <Settings2 className="w-4 h-4 text-slate-500" />
                  <span className="font-semibold text-slate-700">Thresholds</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[450px] rounded-3xl border-none shadow-2xl">
                <DialogHeader>
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
                    <BellRing className="w-6 h-6 text-indigo-600" />
                  </div>
                  <DialogTitle className="text-2xl font-black text-slate-900">Monitor Thresholds</DialogTitle>
                  <DialogDescription className="text-slate-500 font-medium">
                    Define safety boundaries for automated alerting.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6 py-6">
                  <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-2 mb-2">
                      <HeartPulse className="w-4 h-4 text-rose-500" />
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Vital Signs</h4>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-end">
                        <Label className="text-slate-600 font-bold">Heart Rate Range</Label>
                        <Badge variant="outline" className="bg-white font-mono text-indigo-600 border-indigo-100">
                          {thresholds.hrMin} - {thresholds.hrMax} BPM
                        </Badge>
                      </div>
                      <Slider 
                        defaultValue={[thresholds.hrMin, thresholds.hrMax]} 
                        max={180} min={40} step={1}
                        onValueChange={([min, max]) => setThresholds(t => ({ ...t, hrMin: min, hrMax: max }))}
                      />
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="flex justify-between items-end">
                        <Label className="text-slate-600 font-bold">Min SpO2 Level</Label>
                        <Badge variant="outline" className="bg-white font-mono text-emerald-600 border-emerald-100">
                          {thresholds.spo2Min}%
                        </Badge>
                      </div>
                      <Slider 
                        defaultValue={[thresholds.spo2Min]} 
                        max={100} min={85} step={1}
                        onValueChange={([val]) => setThresholds(t => ({ ...t, spo2Min: val }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Thermometer className="w-4 h-4 text-amber-500" />
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Environment</h4>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-end">
                        <Label className="text-slate-600 font-bold">Temperature Range</Label>
                        <Badge variant="outline" className="bg-white font-mono text-amber-600 border-amber-100">
                          {thresholds.tempMin}° - {thresholds.tempMax}°C
                        </Badge>
                      </div>
                      <Slider 
                        defaultValue={[thresholds.tempMin, thresholds.tempMax]} 
                        max={45} min={15} step={0.5}
                        onValueChange={([min, max]) => setThresholds(t => ({ ...t, tempMin: min, tempMax: max }))}
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button 
                    className="w-full h-12 bg-slate-900 hover:bg-black rounded-xl font-bold" 
                    onClick={() => toast.success("Thresholds synchronized successfully")}
                  >
                    Save Monitoring Protocol
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
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

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Live Monitoring & Analytics */}
        <div className="lg:col-span-8 space-y-6">
          {/* Camera Feed Card */}
          <Card className="border-none shadow-xl overflow-hidden bg-slate-900 ring-1 ring-slate-800 rounded-3xl">
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
                    <SelectTrigger className="h-12 border-slate-200 focus:ring-indigo-500 rounded-xl">
                      <SelectValue placeholder="Select a patient to begin monitoring..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
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
                    className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95 rounded-xl"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Initialize
                  </Button>
                  <Button
                    onClick={stopCamera}
                    disabled={!isStreaming}
                    variant="outline"
                    className="h-12 px-6 border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl"
                  >
                    Stop
                  </Button>
                </div>
              </div>
              {!selectedPatient?.enrolledFaceDescriptor && selectedPatientId && (
                <p className="mt-3 text-sm text-red-500 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-4 h-4" />
                  Biometric data missing.
                </p>
              )}
            </div>
          </Card>

          {/* Analytics Card */}
          <Tabs defaultValue="vitals" className="w-full">
            <Card className="border-none shadow-xl bg-white overflow-hidden rounded-3xl">
              <CardHeader className="border-b border-slate-50 bg-slate-50/30 pb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-indigo-500" />
                      Live Analytics
                    </CardTitle>
                  </div>
                  <TabsList className="grid w-full md:w-[300px] grid-cols-2 bg-slate-100/50 p-1 rounded-xl">
                    <TabsTrigger value="vitals" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">Vitals</TabsTrigger>
                    <TabsTrigger value="environment" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">Room</TabsTrigger>
                  </TabsList>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <TabsContent value="vitals" className="m-0 p-6 focus-visible:ring-0">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={vitalsHistory}>
                          <defs>
                            <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorSpo2" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="timestamp" hide />
                          <YAxis yAxisId="left" domain={[40, 160]} stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                          <YAxis yAxisId="right" orientation="right" domain={[85, 100]} stroke="#10b981" fontSize={10} axisLine={false} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            labelFormatter={(t) => new Date(t).toLocaleTimeString()}
                          />
                          <Area yAxisId="left" type="monotone" dataKey="heartRate" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorHr)" name="HR (BPM)" animationDuration={500} />
                          <Area yAxisId="right" type="monotone" dataKey="spO2" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSpo2)" name="SpO2 (%)" animationDuration={500} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-3">
                      <div className="p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100">
                        <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-0.5">Avg HR</p>
                        <p className="text-xl font-black text-slate-900">
                          {vitalsHistory.length > 0 ? (vitalsHistory.reduce((acc, v) => acc + v.heartRate, 0) / vitalsHistory.length).toFixed(0) : "--"} 
                          <span className="text-xs font-medium text-slate-500 ml-1">BPM</span>
                        </p>
                      </div>
                      <div className="p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5">Avg SpO2</p>
                        <p className="text-xl font-black text-slate-900">
                          {vitalsHistory.length > 0 ? (vitalsHistory.reduce((acc, v) => acc + v.spO2, 0) / vitalsHistory.length).toFixed(1) : "--"} 
                          <span className="text-xs font-medium text-slate-500 ml-1">%</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="environment" className="m-0 p-6 focus-visible:ring-0">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={roomHistory}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="timestamp" hide />
                          <YAxis domain={['auto', 'auto']} stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            labelFormatter={(t) => new Date(t).toLocaleTimeString()}
                          />
                          <Line type="monotone" dataKey="temperature" stroke="#f59e0b" strokeWidth={3} dot={false} name="Temp (°C)" />
                          <Line type="monotone" dataKey="humidity" stroke="#0ea5e9" strokeWidth={3} dot={false} name="Humidity (%)" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-3">
                      <div className="p-3 rounded-2xl bg-amber-50/50 border border-amber-100">
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-0.5">Max Temp</p>
                        <p className="text-xl font-black text-slate-900">
                          {roomHistory.length > 0 ? Math.max(...roomHistory.map(r => r.temperature)).toFixed(1) : "--"}
                          <span className="text-xs font-medium text-slate-500 ml-1">°C</span>
                        </p>
                      </div>
                      <div className="p-3 rounded-2xl bg-sky-50/50 border border-sky-100">
                        <p className="text-[10px] font-bold text-sky-600 uppercase tracking-widest mb-0.5">Humidity</p>
                        <p className="text-xl font-black text-slate-900">
                          {currentRoomData ? currentRoomData.humidity : "--"}
                          <span className="text-xs font-medium text-slate-500 ml-1">%</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </CardContent>
            </Card>
          </Tabs>
        </div>

        {/* Right Column: Status & Activity */}
        <div className="lg:col-span-4 space-y-6">
          <Card className={`border-none shadow-lg transition-all duration-500 rounded-3xl ${
            detectionStatus === 'present' ? 'bg-emerald-50 ring-1 ring-emerald-200' : 
            detectionStatus === 'absent' && isStreaming ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-white'
          }`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 py-2">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                  detectionStatus === 'present' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' :
                  detectionStatus === 'absent' && isStreaming ? 'bg-amber-500 text-white shadow-lg shadow-amber-200' :
                  'bg-slate-100 text-slate-400'
                }`}>
                  {detectionStatus === 'present' ? <CheckCircle className="w-7 h-7" /> :
                   detectionStatus === 'absent' && isStreaming ? <Clock className="w-7 h-7" /> :
                   <Camera className="w-7 h-7" />}
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-900 leading-tight">
                    {detectionStatus === 'present' ? "Present" :
                     detectionStatus === 'absent' && isStreaming ? "Absent" : "Standby"}
                  </h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                    {isStreaming ? `Room ${selectedPatient?.roomId || '...'}` : "Inactive"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg rounded-3xl">
            <CardHeader className="pb-2 border-b border-slate-50">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500 flex justify-between">
                Who's In Room
                <Users className="w-4 h-4" />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {currentlyInRoom.length > 0 ? (
                  currentlyInRoom.map((p, i) => (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all animate-in slide-in-from-right-2 duration-300 ${
                      p.isAuthorized ? 'bg-slate-50 border-slate-100' : 'bg-rose-50 border-rose-100'
                    }`} style={{animationDelay: `${i * 100}ms`}}>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white ${
                        !p.isAuthorized ? 'bg-rose-500' :
                        p.role === 'doctor' ? 'bg-blue-500' : 
                        p.role === 'nurse' ? 'bg-teal-500' : 
                        p.role === 'patient' ? 'bg-emerald-500' :
                        'bg-slate-500'
                      }`}>
                        {!p.isAuthorized ? <AlertCircle className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-bold ${p.isAuthorized ? 'text-slate-900' : 'text-rose-900'}`}>{p.name}</p>
                          {!p.isAuthorized && (
                            <Badge variant="destructive" className="text-[8px] h-4 px-1 rounded-sm uppercase tracking-tighter">Unauthorized</Badge>
                          )}
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-tighter text-slate-400">{p.role}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 opacity-20">
                    <User className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-xs font-semibold">Empty</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg rounded-3xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500">Analytics Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <span className="text-slate-500 font-bold text-xs uppercase tracking-tight">Confidence</span>
                  <span className={`font-black ${confidenceScore > 0.8 ? 'text-green-600' : 'text-amber-600'}`}>
                    {(confidenceScore * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <span className="text-slate-500 font-bold text-xs uppercase tracking-tight">Last Sync</span>
                  <span className="font-black text-slate-900">
                    {lastDetectionTime ? lastDetectionTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'}) : "--"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
