/**
 * Core integrations shim.
 *
 * A previous host provided these integrations (InvokeLLM, SendEmail, and
 * friends). They now route to our own implementations where we have one,
 * and the rest are stubs that throw a clear error.
 *
 * - InvokeLLM  -> Supabase edge function `invoke-llm` (Anthropic proxy)
 * - UploadFile -> Supabase Storage (geck-inspect-media bucket)
 * - Everything else -> throws with a descriptive message so callers can
 *   surface it in a toast instead of silently hanging.
 */
import { InvokeLLM as invokeLlmViaEdgeFn } from '@/lib/invokeLlm';
import { uploadFile as supabaseUploadFile } from '@/lib/uploadFile';

export const InvokeLLM = invokeLlmViaEdgeFn;
export const UploadFile = supabaseUploadFile;

function notImplemented(name) {
  return async () => {
    throw new Error(
      `${name} is not wired up. Add an implementation before calling this.`
    );
  };
}

export const SendEmail = notImplemented('SendEmail');
export const SendSMS = notImplemented('SendSMS');
export const GenerateImage = notImplemented('GenerateImage');
export const ExtractDataFromUploadedFile = notImplemented('ExtractDataFromUploadedFile');
