/**
 * Client helpers for the Govee enclosure-sensor integration.
 *
 * The iot_connections table is owner-only RLS, so every query here is
 * automatically scoped to the signed-in user's own row. The Govee API
 * key is write-mostly from the client: we save it, but we only ever
 * surface a masked tail (****1234) back into React state. The full key
 * lives on the row and is read server-side by the iot-poll edge
 * function (see supabase/functions/iot-poll/index.ts), which calls
 * Govee, caches readings on the row, and meters usage against the
 * feature_usage ledger. The server is the only meter; this module
 * never consumes credits client-side.
 *
 * device_mappings shape (jsonb on the row):
 *   [{ device: string, model: string, label: string }]
 */
import { supabase } from '@/lib/supabaseClient';

const PROVIDER = 'govee';
const CONNECTION_COLUMNS =
  'id, provider, is_active, api_key, device_mappings, last_polled_at, last_readings';

/** "****1234" from a full key, or null. Never return the full key. */
export function maskKeyTail(key) {
  if (!key || typeof key !== 'string') return null;
  return `****${key.slice(-4)}`;
}

function normalizeConnection(row) {
  if (!row) return null;
  return {
    id: row.id,
    provider: row.provider,
    isActive: row.is_active !== false,
    // Masked tail only. The full api_key never leaves this function.
    keyTail: maskKeyTail(row.api_key),
    deviceMappings: Array.isArray(row.device_mappings) ? row.device_mappings : [],
    lastPolledAt: row.last_polled_at || null,
    lastReadings: Array.isArray(row.last_readings) ? row.last_readings : [],
  };
}

/**
 * Load the caller's Govee connection row (or null if none).
 * Returns the normalized shape: { id, provider, isActive, keyTail,
 * deviceMappings, lastPolledAt, lastReadings }.
 */
export async function getConnection() {
  const { data, error } = await supabase
    .from('iot_connections')
    .select(CONNECTION_COLUMNS)
    .eq('provider', PROVIDER)
    .maybeSingle();
  if (error) throw error;
  return normalizeConnection(data);
}

/**
 * Save (insert or update) the caller's Govee API key and mark the
 * connection active. Returns the normalized connection.
 */
export async function saveConnection({ apiKey } = {}) {
  const key = (apiKey || '').trim();
  if (!key) throw new Error('Enter your Govee API key first.');

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    throw new Error('Sign in to connect your sensors.');
  }

  const { data: existing, error: selectError } = await supabase
    .from('iot_connections')
    .select('id')
    .eq('provider', PROVIDER)
    .maybeSingle();
  if (selectError) throw selectError;

  const query = existing?.id
    ? supabase
        .from('iot_connections')
        .update({ api_key: key, is_active: true })
        .eq('id', existing.id)
    : supabase.from('iot_connections').insert({
        user_id: authData.user.id,
        provider: PROVIDER,
        api_key: key,
        is_active: true,
        device_mappings: [],
      });

  const { data, error } = await query.select(CONNECTION_COLUMNS).single();
  if (error) throw error;
  return normalizeConnection(data);
}

/**
 * Persist the device label mappings on the caller's connection row.
 * Accepts [{ device, model, label }]; entries without a device id or a
 * non-empty label are dropped. Returns the normalized connection.
 */
export async function saveMappings(mappings) {
  const clean = (Array.isArray(mappings) ? mappings : [])
    .filter((m) => m && m.device && (m.label || '').trim())
    .map((m) => ({
      device: m.device,
      model: m.model || '',
      label: m.label.trim(),
    }));

  const { data, error } = await supabase
    .from('iot_connections')
    .update({ device_mappings: clean })
    .eq('provider', PROVIDER)
    .select(CONNECTION_COLUMNS)
    .single();
  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('No Govee connection yet. Save your API key first.');
    }
    throw error;
  }
  return normalizeConnection(data);
}

// supabase.functions.invoke hides non-2xx response bodies behind
// error.context; pull the JSON out so callers get the real code
// (iot_polls_credits_exhausted, bad_provider_key, no_connection, ...).
async function readEdgeError(error) {
  let message = error?.message || 'Sensor read failed.';
  let parsed = null;
  const ctx = error?.context;
  if (ctx && typeof ctx.text === 'function') {
    try {
      const body = await ctx.text();
      if (body) {
        try {
          parsed = JSON.parse(body);
          message = parsed?.error || body;
        } catch {
          message = body;
        }
      }
    } catch {
      /* keep the generic message */
    }
  }
  return {
    code: parsed?.code || 'server_error',
    message,
    tier: parsed?.tier,
    included: parsed?.included,
    status: ctx?.status,
  };
}

/**
 * On-demand sensor read via the iot-poll edge function. The server
 * meters the read (1 credit per poll regardless of device count); do
 * not consume a credit client-side as well.
 *
 * Resolves to:
 *   { data: { devices, polledAt, creditsRemaining }, error: null }
 * or
 *   { data: null, error: { code, message, tier?, included?, status? } }
 *
 * devices: [{ device, model, name, readings: { temp_f?, temp_c?, humidity? }, supported }]
 */
export async function pollSensors() {
  const { data, error } = await supabase.functions.invoke('iot-poll', { body: {} });
  if (error) {
    return { data: null, error: await readEdgeError(error) };
  }
  if (data?.error) {
    return {
      data: null,
      error: {
        code: data.code || 'server_error',
        message: data.error,
        tier: data.tier,
        included: data.included,
      },
    };
  }
  return {
    data: {
      devices: Array.isArray(data?.devices) ? data.devices : [],
      polledAt: data?.polled_at || new Date().toISOString(),
      creditsRemaining: data?.credits_remaining ?? null,
    },
    error: null,
  };
}
