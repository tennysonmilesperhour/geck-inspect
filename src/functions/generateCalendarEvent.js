import { base44 } from '@/api/base44Client';
export const generateCalendarEvent = (...args) => base44.functions.invoke('generateCalendarEvent', ...args);
