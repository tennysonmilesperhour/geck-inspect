/**
 * Food-runout estimate for the current user.
 *
 * Calls the SECURITY DEFINER `estimate_food_runout` RPC which joins
 * geckos, store_orders, store_order_items, and store_products to
 * compute "your CGD runs out around <date>" without exposing any
 * cross-user data.
 *
 * Returns either { hasHistory: false } or:
 *   {
 *     hasHistory: true,
 *     geckoCount,
 *     gramsRemaining,
 *     dailyConsumptionGrams,
 *     perGeckoPerWeekGrams,
 *     runsOutAt: Date,
 *     daysUntilRunout: number,
 *     lastFoodOrderAt: Date,
 *     lastFoodGramsTotal,
 *   }
 */

import { supabase } from '@/lib/supabaseClient';

export async function getFoodEstimate(userEmail = null) {
  try {
    const { data, error } = await supabase.rpc('estimate_food_runout', {
      p_user_email: userEmail,
    });
    if (error) {
      console.warn('[foodEstimate] rpc error', error);
      return { hasHistory: false };
    }
    if (!data || !data.has_food_history) {
      return { hasHistory: false, reason: data?.reason, geckoCount: data?.gecko_count };
    }
    return {
      hasHistory: true,
      geckoCount: Number(data.gecko_count) || 0,
      gramsRemaining: Number(data.grams_remaining) || 0,
      dailyConsumptionGrams: Number(data.daily_consumption_grams) || 0,
      perGeckoPerWeekGrams: Number(data.per_gecko_per_week_grams) || 0,
      runsOutAt: data.runs_out_at ? new Date(data.runs_out_at) : null,
      daysUntilRunout: Number(data.days_until_runout) || 0,
      lastFoodOrderAt: data.last_food_order_at ? new Date(data.last_food_order_at) : null,
      lastFoodGramsTotal: Number(data.last_food_grams_total) || 0,
    };
  } catch (e) {
    console.warn('[foodEstimate] failed', e);
    return { hasHistory: false };
  }
}

export function runoutTone(daysUntilRunout) {
  if (daysUntilRunout <= 7) return 'rose';
  if (daysUntilRunout <= 14) return 'amber';
  return 'emerald';
}
