import { base44 } from '@/api/base44Client';
export const syncWithPalmStreet = (...args) => base44.functions.invoke('syncWithPalmStreet', ...args);
