import { base44 } from '@/api/base44Client';
export const generateCSVTemplate = (...args) => base44.functions.invoke('generateCSVTemplate', ...args);
