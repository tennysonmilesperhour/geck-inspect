import { base44 } from '@/api/base44Client';
export const recognizeGeckoMorph = (...args) => base44.functions.invoke('recognizeGeckoMorph', ...args);
