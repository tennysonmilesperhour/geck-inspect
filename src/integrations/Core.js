/**
 * Core integrations shim.
 *
 * Base44's hosted integrations (InvokeLLM, SendEmail, etc.) are no longer
 * live, so we route them to our own replacements where we have one and
 * leave the rest as a stub that throws a clear error.
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
      `${name} is not wired up. The Base44 integration shut down; add a replacement before calling this.`
    );
  };
}

export const SendEmail = notImplemented('SendEmail');
export const SendSMS = notImplemented('SendSMS');
export const GenerateImage = notImplemented('GenerateImage');
export const ExtractDataFromUploadedFile = notImplemented('ExtractDataFromUploadedFile');
