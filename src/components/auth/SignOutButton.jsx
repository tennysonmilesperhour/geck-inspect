import { useState } from 'react';
import { Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';

export default function SignOutButton({ className, disabled = false }) {
  const { isAuthenticated, logout } = useAuth();
  const { toast } = useToast();
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (!isAuthenticated) return null;

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await logout();
    } catch {
      setIsSigningOut(false);
      toast({
        title: 'Could not sign out',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      onClick={handleSignOut}
      disabled={disabled || isSigningOut}
      aria-busy={isSigningOut}
    >
      {isSigningOut ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
      {isSigningOut ? 'Signing out' : 'Sign out'}
    </Button>
  );
}
