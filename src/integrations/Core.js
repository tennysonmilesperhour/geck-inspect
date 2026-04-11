/**
 * Core integrations shim.
 *
 * Base44's hosted integrations (InvokeLLM, SendEmail, etc.) are no longer
 * live, so we route them to our own replacements where we have one and
 * leave the rest as a stub that throws a clear error.
 *
 * - InvokeLLM  -> Supabase edge function `invoke-llm` (Anthropic proxy)
 * - Everything else -> throws with a descriptive message so callers can
 *   surface it in a toast instead of silently hanging.
 */
import { InvokeLLM as invokeLlmViaEdgeFn } from '@/lib/invokeLlm';

export const InvokeLLM = invokeLlmViaEdgeFn;

function notImplemented(name) {
  return async () => {
    throw new Error(
      `${name} is not wired up. The Base44 integration shut down; add a replacement before calling this.`
    );
  };
}

export const SendEmail = notImplemented('SendEmail');
export const SendSMS = notImplemented('SendSMS');
export const UploadFile = notImplemented('UploadFile');
export const GenerateImage = notImplemented('GenerateImage');
export const ExtractDataFromUploadedFile = notImplemented('ExtractDataFromUploadedFile');
