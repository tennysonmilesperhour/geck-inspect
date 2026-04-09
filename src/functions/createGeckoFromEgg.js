import { base44 } from '@/api/base44Client';
export const createGeckoFromEgg = (...args) => base44.functions.invoke('createGeckoFromEgg', ...args);
