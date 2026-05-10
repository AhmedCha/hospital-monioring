import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PeoplePhotoUpload } from "@/components/PeoplePhotoUpload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, UserRound, Camera, UserPlus } from "lucide-react";

export default function Staff() {
  const { data: people, isLoading, refetch } = trpc.people.list.useQuery();
  const createMutation = trpc.people.create.useMutation();
  const deleteMutation = trpc.people.delete.useMutation();
  const uploadPhotoMutation = trpc.people.uploadPhoto.useMutation();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", role: "nurse" as any });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [photoUploadPersonId, setPhotoUploadPersonId] = useState<string | null>(null);
  const [photoUploadPersonName, setPhotoUploadPersonName] = useState<string>("");

  const staffMembers = people?.filter(p => p.role === "doctor" || p.role === "nurse") || [];

  const handleCreate = async () => {
    if (!formData.name) {
      toast.error("Please enter a name");
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: formData.name,
        role: formData.role,
      });
      setFormData({ name: "", role: "nurse" });
      setIsDialogOpen(false);
      refetch();
      toast.success("Staff member created successfully");
    } catch (error) {
      toast.error("Failed to create staff member");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync({ id });
      setDeleteConfirmId(null);
      refetch();
      toast.success("Staff member deleted successfully");
    } catch (error) {
      toast.error("Failed to delete staff member");
    }
  };

  const handlePhotoEnrolled = async (photoUrl: string, faceDescriptor: Float32Array) => {
    if (!photoUploadPersonId) return;

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
      toast.success("Face enrolled successfully");
    } catch (error) {
      toast.error("Failed to enroll face");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
          <p className="text-muted-foreground mt-2">Register Doctors and Nurses for the monitoring system</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700">
              <UserPlus className="w-4 h-4" />
              Add Staff
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register New Staff</DialogTitle>
              <DialogDescription>
                Add a doctor or nurse to the system. You'll enroll their face next.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Dr. Smith"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(val) => setFormData({ ...formData, role: val as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="nurse">Nurse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} className="w-full bg-indigo-600 hover:bg-indigo-700">
                Register Member
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : staffMembers.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {staffMembers.map((person) => (
            <Card key={person.id} className="overflow-hidden border-indigo-100">
              <CardHeader className="pb-3 bg-indigo-50/50">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${person.role === 'doctor' ? 'bg-blue-600' : 'bg-teal-600'}`}>
                    <UserRound className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{person.name}</CardTitle>
                    <CardDescription className="capitalize font-medium text-indigo-600">{person.role}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Biometric Status</span>
                    <span className={person.enrolledFaceDescriptor ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                      {person.enrolledFaceDescriptor ? "Enrolled" : "Not Enrolled"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                      onClick={() => {
                        setPhotoUploadPersonId(person.id);
                        setPhotoUploadPersonName(person.name);
                      }}
                    >
                      <Camera className="w-3 h-3" />
                      Face ID
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => setDeleteConfirmId(person.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12 border-dashed">
          <CardContent>
            <UserRound className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-semibold">No staff registered</h3>
            <p className="text-muted-foreground mb-4">Register doctors and nurses to track them in room activity.</p>
            <Button onClick={() => setIsDialogOpen(true)} variant="outline">
              Add Staff Member
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Staff Member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove them from the face recognition dataset.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)} className="bg-red-600">
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
          onOpenChange={(open) => !open && setPhotoUploadPersonId(null)}
        />
      )}
    </div>
  );
}
