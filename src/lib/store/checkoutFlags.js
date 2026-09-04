/**
 * Store checkout availability.
 *
 * Online checkout runs through the `store-checkout` and
 * `store-stripe-webhook` edge functions. Until both are deployed with
 * their Stripe secrets, the cart shows a disabled "Checkout opens soon"
 * button instead of calling a function that does not exist yet (which
 * surfaced as a raw error alert to guests).
 *
 * Flip this to true once both functions are live and a test order has
 * been paid end to end.
 */
export const STORE_CHECKOUT_ENABLED = false;
