/**
 * Shared integrations used by legacy page imports. Both implementations are
 * live: AI requests use a metered edge function and uploads use Supabase Storage.
 * Email and push are dispatched by the notifications database trigger.
 */
import { InvokeLLM as invokeLlmViaEdgeFn } from '@/lib/invokeLlm';
import { uploadFile as supabaseUploadFile } from '@/lib/uploadFile';

export const InvokeLLM = invokeLlmViaEdgeFn;
export const UploadFile = supabaseUploadFile;
