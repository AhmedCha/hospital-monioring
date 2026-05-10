import { trpc } from "@/lib/trpc";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup, signOut as firebaseSignOut, signInWithEmailAndPassword } from "firebase/auth";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

export function useAuth() {
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      if (data.success && data.user) {
        utils.auth.me.setData(undefined, data.user);
      } else {
        utils.auth.me.invalidate();
      }
    },
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const login = useCallback(async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      await loginMutation.mutateAsync({ idToken });
      toast.success("Signed in successfully");
    } catch (error) {
      console.error("[Auth] Google login failed:", error);
      toast.error("Failed to sign in with Google");
    }
  }, [loginMutation]);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await result.user.getIdToken();
      await loginMutation.mutateAsync({ idToken });
      toast.success("Signed in successfully");
    } catch (error) {
      console.error("[Auth] Email login failed:", error);
      toast.error("Invalid email or password");
    }
  }, [loginMutation]);

  const logout = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
      await logoutMutation.mutateAsync();
      utils.auth.me.setData(undefined, null);
      toast.success("Signed out");
    } catch (error) {
      console.error("[Auth] Logout failed:", error);
    }
  }, [logoutMutation, utils]);

  return {
    user: meQuery.data ?? null,
    loading: meQuery.isLoading || loginMutation.isPending || logoutMutation.isPending,
    isAuthenticated: Boolean(meQuery.data),
    login,
    loginWithEmail,
    logout,
  };
}
