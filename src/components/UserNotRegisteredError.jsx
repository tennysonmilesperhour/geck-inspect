import React from 'react';
import LoginPortal from '@/components/auth/LoginPortal';

// Previously showed an "Access Restricted" error for Base44's user-registration
// concept. With direct Supabase auth there is no separate registration gate —
// unauthenticated visitors simply see the sign-in / sign-up form.
const UserNotRegisteredError = () => <LoginPortal />;

export default UserNotRegisteredError;
