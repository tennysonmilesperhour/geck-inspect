import { base44 } from '@/api/base44Client';
export const syncWithMorphMarket = (...args) => base44.functions.invoke('syncWithMorphMarket', ...args);
