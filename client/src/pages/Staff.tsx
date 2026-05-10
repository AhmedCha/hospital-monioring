import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PeoplePhotoUpload } from "@/components/PeoplePhotoUpload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, UserRound, Camera, UserPlus, RefreshCw, MoreHorizontal, Edit, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Staff() {
  const { user } = useAuth();
  const { data: people, isLoading, refetch } = trpc.people.list.useQuery();
  const createMutation = trpc.people.create.useMutation();
  const deleteMutation = trpc.people.delete.useMutation();
  const updateMutation = trpc.people.update.useMutation();
  const uploadPhotoMutation = trpc.people.uploadPhoto.useMutation();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", role: "nurse" as any, email: "" });
  const [editFormData, setEditFormData] = useState({ id: "", name: "", role: "nurse" as any, email: "" });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [photoUploadPersonId, setPhotoUploadPersonId] = useState<string | null>(null);
  const [photoUploadPersonName, setPhotoUploadPersonName] = useState<string>("");

  const staffMembers = people?.filter(p => p.role === "doctor" || p.role === "nurse") || [];
  
  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="w-12 h-12 text-amber-500" />
        <h2 className="text-2xl font-black text-slate-900">Access Restricted</h2>
        <p className="text-slate-500 font-medium">Only administrators can manage medical staff members.</p>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!formData.name) {
      toast.error("Please enter a name");
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: formData.name,
        role: formData.role,
        email: formData.email || null,
      });
      setFormData({ name: "", role: "nurse", email: "" });
      setIsDialogOpen(false);
      refetch();
      toast.success("Staff member created successfully");
    } catch (error) {
      toast.error("Failed to create staff member");
    }
  };

  const handleDelete = async (id: string) => {
    const toastId = toast.loading("Deleting staff member...");
    try {
      await deleteMutation.mutateAsync({ id });
      setDeleteConfirmId(null);
      refetch();
      toast.success("Staff member deleted successfully", { id: toastId });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to delete staff member";
      toast.error(msg, { id: toastId });
    }
  };

  const handleUpdate = async () => {
    if (!editFormData.name) {
      toast.error("Please enter a name");
      return;
    }

    const toastId = toast.loading("Updating staff details...");
    try {
      await updateMutation.mutateAsync({
        id: editFormData.id,
        name: editFormData.name,
        role: editFormData.role,
        email: editFormData.email || null,
      });
      setIsEditDialogOpen(false);
      refetch();
      toast.success("Staff details updated successfully", { id: toastId });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to update staff member";
      toast.error(msg, { id: toastId });
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
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="doctor@hospital.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
            <Card key={person.id} className="hover:shadow-lg transition-shadow border-slate-100 overflow-hidden rounded-3xl">
              <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden shadow-sm ${
                    person.role === 'doctor' ? 'bg-blue-600' : 'bg-teal-600'
                  }`}>
                    {person.photoUrl ? (
                      <img src={person.photoUrl} alt={person.name} className="w-full h-full object-cover" />
                    ) : (
                      <UserRound className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg font-bold text-slate-900">{person.name}</CardTitle>
                    <CardDescription className="capitalize font-bold text-indigo-600 text-xs tracking-wide">
                      {person.role}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl">
                      <DropdownMenuItem onClick={() => {
                        setEditFormData({ 
                          id: person.id, 
                          name: person.name, 
                          role: person.role as any, 
                          email: person.email || "" 
                        });
                        setIsEditDialogOpen(true);
                      }}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-red-600 focus:text-red-600" 
                        onClick={() => setDeleteConfirmId(person.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove Staff
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="pt-5">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Contact Information</p>
                    <p className="text-sm font-semibold text-slate-700">{person.email || "No email provided"}</p>
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-y border-slate-50">
                    <span className="text-xs font-bold text-slate-500">Biometric Status</span>
                    <Badge variant={person.enrolledFaceDescriptor ? "default" : "outline"} className={
                      person.enrolledFaceDescriptor ? "bg-emerald-500" : "text-amber-600 border-amber-200"
                    }>
                      {person.enrolledFaceDescriptor ? "ID Enrolled" : "Pending ID"}
                    </Badge>
                  </div>

                  <div className="flex gap-2">
                    {person.photoUrl ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="flex-1 gap-2 border-slate-200 rounded-xl font-bold text-xs h-9">
                            <Camera className="w-3 h-3" />
                            Manage Face ID
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem onClick={() => {
                            setPhotoUploadPersonId(person.id);
                            setPhotoUploadPersonName(person.name);
                          }}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Re-enroll Face
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600 focus:text-red-600" 
                            onClick={async () => {
                              const toastId = toast.loading("Removing biometric data...");
                              try {
                                await updateMutation.mutateAsync({
                                  id: person.id,
                                  photoUrl: null,
                                  photoStorageKey: null,
                                  enrolledFaceDescriptor: null,
                                });
                                refetch();
                                toast.success("Biometric data removed", { id: toastId });
                              } catch (e) {
                                const msg = e instanceof Error ? e.message : "Failed to remove data";
                                toast.error(msg, { id: toastId });
                              }
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Photo ID
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-xl font-bold text-xs h-9"
                        onClick={() => {
                          setPhotoUploadPersonId(person.id);
                          setPhotoUploadPersonName(person.name);
                        }}
                      >
                        <Camera className="w-3 h-3" />
                        Enroll Face ID
                      </Button>
                    )}
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
        <AlertDialogContent className="rounded-3xl border-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">Remove Staff Member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove them from the system and biometric dataset. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end pt-4">
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)} className="bg-red-600 hover:bg-red-700 rounded-xl">
              Remove Forever
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="rounded-3xl border-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Edit Staff Profile</DialogTitle>
            <DialogDescription>
              Update the personal and contact information for this staff member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-xs font-bold uppercase text-slate-500">Full Name</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                className="h-11 rounded-xl border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email" className="text-xs font-bold uppercase text-slate-500">Email Address</Label>
              <Input
                id="edit-email"
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                className="h-11 rounded-xl border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role" className="text-xs font-bold uppercase text-slate-500">Professional Role</Label>
              <Select
                value={editFormData.role}
                onValueChange={(val) => setEditFormData({ ...editFormData, role: val as any })}
              >
                <SelectTrigger className="h-11 rounded-xl border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="nurse">Nurse</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleUpdate} className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-100 font-bold mt-2">
              Save Profile Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
