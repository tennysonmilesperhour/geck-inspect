/**
 * Saved AI Consultant chats (table public.consultant_conversations, one
 * row per chat, each member sees only their own rows).
 *
 * A chat is saved after each answer. Action cards (log a weight, log a
 * shed) are stored as plain text with their outcome, because their
 * Confirm and Undo buttons only make sense in the moment.
 */
import { supabase } from '@/lib/supabaseClient';

export const MAX_SAVED_MESSAGES = 100;
const TITLE_MAX = 80;

const ACTION_STATUS_TEXT = {
  pending: 'not confirmed',
  working: 'not confirmed',
  done: 'saved',
  cancelled: 'cancelled',
  undone: 'undone',
  error: 'did not save',
};

/** Messages as stored: { role: 'user' | 'assistant', content }. */
export function serializeMessages(messages) {
  const out = [];
  for (const m of messages || []) {
    if (m.role === 'user' || m.role === 'assistant') {
      if (typeof m.content === 'string' && m.content.trim()) out.push({ role: m.role, content: m.content });
    } else if (m.role === 'action') {
      const status = ACTION_STATUS_TEXT[m.status] || m.status || '';
      const lines = [m.say, `_${m.describe}${status ? ` (${status})` : ''}_`].filter(Boolean);
      out.push({ role: 'assistant', content: lines.join('\n\n') });
    }
  }
  return out.slice(-MAX_SAVED_MESSAGES);
}

/** First thing the member asked, trimmed to a short title. */
export function conversationTitle(messages) {
  const first = (messages || []).find((m) => m.role === 'user' && m.content?.trim());
  if (!first) return 'New chat';
  const oneLine = first.content.replace(/\s+/g, ' ').trim();
  return oneLine.length > TITLE_MAX ? `${oneLine.slice(0, TITLE_MAX - 1).trimEnd()}…` : oneLine;
}

export async function listConversations(limit = 20) {
  const { data, error } = await supabase
    .from('consultant_conversations')
    .select('id, title, updated_date')
    .order('updated_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function loadConversation(id) {
  const { data, error } = await supabase
    .from('consultant_conversations')
    .select('id, title, messages, updated_date')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Insert or update a chat. Resolves to its id. */
export async function saveConversation({ id, messages }) {
  const stored = serializeMessages(messages);
  const row = {
    title: conversationTitle(stored),
    messages: stored,
    updated_date: new Date().toISOString(),
  };
  if (id) {
    const { error } = await supabase.from('consultant_conversations').update(row).eq('id', id);
    if (error) throw error;
    return id;
  }
  const { data, error } = await supabase
    .from('consultant_conversations')
    .insert(row)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteConversation(id) {
  const { error } = await supabase.from('consultant_conversations').delete().eq('id', id);
  if (error) throw error;
}
