import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { useRevenueCat } from '@/lib/RevenueCatContext';
import { getPurchases } from '@/lib/revenuecat';
import { Loader2, Sparkles } from 'lucide-react';

/**
 * Open the RevenueCat-hosted paywall as a full-screen overlay. Resolves
 * the current offering on demand so the paywall always reflects the
 * latest dashboard configuration (targeting, A/B tests, etc).
 *
 * onSuccess fires once a purchase completes and the customer info has
 * been refreshed locally; onCancel fires when the user closes the
 * paywall without buying.
 */
export function RevenueCatPaywallButton({
  className,
  variant = 'default',
  size = 'default',
  children,
  onSuccess,
  onCancel,
  onCustomerCenter,
}) {
  const { user } = useAuth();
  const { isReady, isProMember, refresh, offerings } = useRevenueCat();
  const { toast } = useToast();
  const [isLaunching, setIsLaunching] = useState(false);

  const handleClick = useCallback(async () => {
    const rc = getPurchases();
    if (!rc) {
      toast({
        title: 'Subscriptions unavailable',
        description: 'RevenueCat is still initializing. Try again in a moment.',
        variant: 'destructive',
      });
      return;
    }

    setIsLaunching(true);
    try {
      const currentOffering = offerings?.current ?? null;
      if (!currentOffering) {
        const fresh = await rc.getOfferings();
        if (!fresh?.current) {
          toast({
            title: 'No offering configured',
            description:
              'Add a current offering with packages in the RevenueCat dashboard, then reload.',
            variant: 'destructive',
          });
          setIsLaunching(false);
          return;
        }
      }

      const result = await rc.presentPaywall({
        offering: currentOffering ?? (await rc.getOfferings()).current,
        customerEmail: user?.email,
        onVisitCustomerCenter: onCustomerCenter,
        listener: {
          onPurchaseCancelled: () => {
            onCancel?.();
          },
          onPurchaseError: (err) => {
            console.warn('[revenuecat] paywall purchase error:', err);
          },
        },
      });

      // Pull a fresh CustomerInfo so the rest of the app sees the new
      // entitlement immediately (without waiting for the next visit).
      await refresh();

      toast({
        title: 'Welcome to Geck Inspect Pro',
        description: 'Your subscription is active. Enjoy the upgrade.',
      });
      onSuccess?.(result);
    } catch (err) {
      // UserCancelledError is the normal "closed the modal" path.
      if (err?.errorCode === 1 || err?.name === 'UserCancelledError') {
        onCancel?.();
      } else {
        console.error('[revenuecat] paywall failed:', err);
        toast({
          title: 'Checkout error',
          description: err?.message || 'Something went wrong opening the paywall.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLaunching(false);
    }
  }, [offerings, user?.email, refresh, toast, onSuccess, onCancel, onCustomerCenter]);

  const disabled = isLaunching || !isReady;
  const label =
    children ??
    (isProMember ? 'Manage Pro' : isLaunching ? 'Opening...' : 'Upgrade to Pro');

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      variant={variant}
      size={size}
      className={className}
    >
      {isLaunching ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Sparkles className="w-4 h-4 mr-2" />
      )}
      {label}
    </Button>
  );
}

/**
 * Sends the user to RevenueCat's customer-managed subscription page for
 * Web Billing (Stripe Customer Portal under the hood). When no active
 * subscription exists, customerInfo.managementURL is null, in which
 * case we surface a toast rather than open a blank window.
 *
 * The Customer Center product (https://www.revenuecat.com/docs/tools/customer-center)
 * is currently mobile-only; on Web the managementURL is the equivalent
 * "self-serve" entry point and is what the paywall's
 * onVisitCustomerCenter callback should route to.
 */
export function CustomerCenterButton({
  className,
  variant = 'outline',
  size = 'default',
  children,
}) {
  const { customerInfo, isReady } = useRevenueCat();
  const { toast } = useToast();

  const onClick = useCallback(() => {
    const url = customerInfo?.managementURL;
    if (!url) {
      toast({
        title: 'No active subscription',
        description: 'You don’t have an active subscription to manage yet.',
      });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [customerInfo?.managementURL, toast]);

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={!isReady}
      variant={variant}
      size={size}
      className={className}
    >
      {children ?? 'Manage Subscription'}
    </Button>
  );
}

export default RevenueCatPaywallButton;
