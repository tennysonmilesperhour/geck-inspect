import { base44 } from '@/api/base44Client';
export const sendPushNotification = (...args) => base44.functions.invoke('sendPushNotification', ...args);
