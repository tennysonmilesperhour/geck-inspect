import { base44 } from '@/api/base44Client';
export const generateLineageCertificate = (...args) => base44.functions.invoke('generateLineageCertificate', ...args);
