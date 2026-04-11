/**
 * Legacy integrations shim. Re-exports from @/integrations/Core so older
 * code paths that imported `@/api/integrations` keep working after the
 * Base44 shutdown.
 */
export {
  InvokeLLM,
  SendEmail,
  SendSMS,
  UploadFile,
  GenerateImage,
  ExtractDataFromUploadedFile,
} from '@/integrations/Core';

// Preserve the old `Core` namespace for callers that did `import { Core }`.
import * as CoreModule from '@/integrations/Core';
export const Core = CoreModule;
