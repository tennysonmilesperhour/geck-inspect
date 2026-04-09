import { base44 } from '@/api/base44Client';
export const importGeckosFromCSV = (...args) => base44.functions.invoke('importGeckosFromCSV', ...args);
