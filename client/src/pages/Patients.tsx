import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { database } from "@/lib/firebase";
import { ref, get } from "firebase/database";
import { PeoplePhotoUpload } from "@/components/PeoplePhotoUpload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, User, Camera, RefreshCw } from "lucide-react";

export default function Patients() {
  const { data: people, isLoading, refetch } = trpc.people.list.useQuery();
  const createMutation = trpc.people.create.useMutation();
  const deleteMutation = trpc.people.delete.useMutation();
  const uploadPhotoMutation = trpc.people.uploadPhoto.useMutation();
  const syncMutation = trpc.people.syncFirebasePatients.useMutation();

  const [isSyncing, setIsSyncing] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", roomId: "" });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [photoUploadPersonId, setPhotoUploadPersonId] = useState<string | null>(null);
  const [photoUploadPersonName, setPhotoUploadPersonName] = useState<string>("");

  const patients = people?.filter(p => p.role === "patient") || [];

  const handleCreate = async () => {
    if (!formData.name || !formData.roomId) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: formData.name,
        roomId: formData.roomId,
        role: "patient",
      });
      setFormData({ name: "", roomId: "" });
      setIsDialogOpen(false);
      refetch();
      toast.success("Patient created successfully");
    } catch (error) {
      toast.error("Failed to create patient");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync({ id });
      setDeleteConfirmId(null);
      refetch();
      toast.success("Patient deleted successfully");
    } catch (error) {
      toast.error("Failed to delete patient");
    }
  };

  const handlePhotoEnrolled = async (photoUrl: string, faceDescriptor: Float32Array) => {
    if (!photoUploadPersonId) return;

    const toastId = toast.loading("Enrolling patient photo...");

    try {
      const descriptorArray = Array.from(faceDescriptor);

      await uploadPhotoMutation.mutateAsync({
        personId: photoUploadPersonId,
        photoBase64: photoUrl,
        faceDescriptor: descriptorArray,
      });

      setPhotoUploadPersonId(null);
      setPhotoUploadPersonName("");
      refetch();
      toast.success("Patient photo enrolled successfully", { id: toastId });
    } catch (error) {
      console.error("Enrollment error:", error);
      const errorMsg = error instanceof Error ? error.message : "Failed to enroll photo";
      toast.error(errorMsg, { id: toastId });
    }
  };

  const handleSyncFirebase = async () => {
    try {
      setIsSyncing(true);
      const result = await syncMutation.mutateAsync({});
      toast.success(`Successfully synced ${result.added} new patients from Firebase`);
      refetch();
    } catch (error) {
      console.error("Firebase sync error:", error);
      toast.error("Failed to sync patients from Firebase");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Patient Management</h1>
          <p className="text-muted-foreground mt-2">Enroll and manage patients for real-time monitoring</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="gap-2" 
            onClick={handleSyncFirebase}
            disabled={isSyncing}
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
            Sync from Firebase
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Patient
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enroll New Patient</DialogTitle>
              <DialogDescription>
                Create a new patient profile for monitoring. You'll upload their photo in the next step.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Patient Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="roomId">Room ID</Label>
                <Input
                  id="roomId"
                  placeholder="e.g., 101"
                  value={formData.roomId}
                  onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                />
              </div>
              <Button onClick={handleCreate} className="w-full">
                Create Patient
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-4 bg-muted rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : patients.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {patients.map((patient) => (
            <Card key={patient.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center overflow-hidden">
                    {patient.photoUrl ? (
                      <img 
                        src={patient.photoUrl} 
                        alt={patient.name} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          // Could trigger a state update here if we wanted to show a specific icon
                        }}
                      />
                    ) : (
                      <User className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{patient.name}</CardTitle>
                    <CardDescription>Room {patient.roomId}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${patient.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                      {patient.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {patient.enrolledFaceDescriptor !== null && patient.enrolledFaceDescriptor !== undefined ? (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Face Enrolled</span>
                      <span className="text-green-600 font-medium">✓</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Face Enrolled</span>
                      <span className="text-orange-600 font-medium">Pending</span>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1"
                      onClick={() => {
                        setPhotoUploadPersonId(patient.id);
                        setPhotoUploadPersonName(patient.name);
                      }}
                    >
                      <Camera className="w-3 h-3" />
                      Enroll Photo
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1 text-red-600 hover:text-red-700"
                      onClick={() => setDeleteConfirmId(patient.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No patients yet</h3>
            <p className="text-muted-foreground mb-4">Start by enrolling your first patient</p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Patient
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Patient</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this patient? This action cannot be undone. All associated detection events and alerts will remain in the log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {photoUploadPersonId && (
        <PeoplePhotoUpload
          personId={photoUploadPersonId}
          personName={photoUploadPersonName}
          onPhotoEnrolled={handlePhotoEnrolled}
          isOpen={photoUploadPersonId !== null}
          onOpenChange={(open) => {
            if (!open) {
              setPhotoUploadPersonId(null);
              setPhotoUploadPersonName("");
            }
          }}
        />
      )}
    </div>
  );
}
