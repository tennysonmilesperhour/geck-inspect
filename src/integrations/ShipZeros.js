/**
 * ShipZeros integration module.
 *
 * Wraps the Zero's Geckos Shipping Project API for use within
 * Geck Inspect. All calls route through a Supabase edge function
 * (`shipzeros-proxy`) that holds the API key and forwards requests.
 *
 * Until the partnership is finalized and API credentials are issued,
 * every public method operates in **demo mode** ,  returning realistic
 * mock data so the full UI can be exercised end-to-end. Once live
 * credentials exist, flip `DEMO_MODE` to false (or set the
 * VITE_SHIPZEROS_LIVE env var) and the real proxy calls take over.
 *
 * Demo mode lets us show Zero's Geckos exactly what the integration
 * looks like before they grant API access.
 */
import { supabase } from '@/lib/supabaseClient';

const DEMO_MODE =
  import.meta.env.VITE_SHIPZEROS_LIVE !== 'true';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function callProxy(action, payload) {
  const { data, error } = await supabase.functions.invoke('shipzeros-proxy', {
    body: { action, ...payload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

function demoDelay(ms = 600) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get a shipping quote for a live reptile shipment.
 *
 * @param {{ originZip: string, destZip: string, weight: number, animalCount: number, service: 'overnight'|'express' }} params
 * @returns {Promise<{ quoteId: string, service: string, carrier: string, price: number, estimatedDelivery: string, transitDays: number, includesInsurance: boolean, includesHeatPack: boolean, includesColdPack: boolean }>}
 */
export async function getShippingQuote({
  originZip,
  destZip,
  weight = 1,
  animalCount = 1,
  service = 'overnight',
}) {
  if (DEMO_MODE) {
    await demoDelay();
    const isOvernight = service === 'overnight';
    const basePrice = isOvernight ? 49.99 : 39.99;
    const perAnimal = animalCount > 1 ? (animalCount - 1) * 5 : 0;
    const price = +(basePrice + perAnimal).toFixed(2);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + (isOvernight ? 1 : 2));
    return {
      quoteId: `demo_q_${Date.now()}`,
      service: isOvernight ? 'FedEx Priority Overnight' : 'FedEx 2Day',
      carrier: 'FedEx',
      price,
      estimatedDelivery: tomorrow.toISOString().split('T')[0],
      transitDays: isOvernight ? 1 : 2,
      includesInsurance: true,
      includesHeatPack: true,
      includesColdPack: false,
    };
  }
  return callProxy('get_quote', { originZip, destZip, weight, animalCount, service });
}

/**
 * Book a shipment and receive a printable label URL.
 *
 * @param {{ quoteId: string, sender: { name: string, address: string, city: string, state: string, zip: string, phone: string }, recipient: { name: string, address: string, city: string, state: string, zip: string, phone: string }, geckoIds: string[], notes: string }} params
 * @returns {Promise<{ shipmentId: string, trackingNumber: string, labelUrl: string, carrier: string, service: string, estimatedDelivery: string, status: string }>}
 */
export async function bookShipment({
  quoteId,
  sender,
  recipient,
  geckoIds = [],
  notes = '',
}) {
  if (DEMO_MODE) {
    await demoDelay(900);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return {
      shipmentId: `demo_s_${Date.now()}`,
      trackingNumber: `7489${Math.random().toString().slice(2, 14)}`,
      labelUrl: '#demo-label',
      carrier: 'FedEx',
      service: 'FedEx Priority Overnight',
      estimatedDelivery: tomorrow.toISOString().split('T')[0],
      status: 'label_created',
    };
  }
  return callProxy('book_shipment', { quoteId, sender, recipient, geckoIds, notes });
}

/**
 * Get real-time tracking for a shipment.
 *
 * @param {string} trackingNumber
 * @returns {Promise<{ trackingNumber: string, status: string, statusDetail: string, carrier: string, estimatedDelivery: string, events: Array<{ timestamp: string, location: string, description: string }> }>}
 */
export async function trackShipment(trackingNumber) {
  if (DEMO_MODE) {
    await demoDelay(400);
    const now = new Date();
    return {
      trackingNumber,
      status: 'in_transit',
      statusDetail: 'Package in transit ,  on schedule',
      carrier: 'FedEx',
      estimatedDelivery: new Date(now.getTime() + 86400000).toISOString().split('T')[0],
      events: [
        {
          timestamp: new Date(now.getTime() - 3600000 * 4).toISOString(),
          location: 'Memphis, TN',
          description: 'Arrived at FedEx hub',
        },
        {
          timestamp: new Date(now.getTime() - 3600000 * 8).toISOString(),
          location: 'Origin facility',
          description: 'Picked up',
        },
        {
          timestamp: new Date(now.getTime() - 3600000 * 10).toISOString(),
          location: 'Origin facility',
          description: 'Shipment information sent to FedEx',
        },
      ],
    };
  }
  return callProxy('track_shipment', { trackingNumber });
}

/**
 * Cancel a shipment that hasn't been picked up yet.
 *
 * @param {string} shipmentId
 * @returns {Promise<{ success: boolean, refundAmount: number }>}
 */
export async function cancelShipment(shipmentId) {
  if (DEMO_MODE) {
    await demoDelay(500);
    return { success: true, refundAmount: 49.99 };
  }
  return callProxy('cancel_shipment', { shipmentId });
}

/**
 * Confirm live arrival ,  buyer calls this after delivery.
 *
 * @param {string} shipmentId
 * @param {{ arrived: boolean, condition: 'healthy'|'stressed'|'doa', notes: string }} confirmation
 * @returns {Promise<{ success: boolean }>}
 */
export async function confirmArrival(shipmentId, confirmation) {
  if (DEMO_MODE) {
    await demoDelay(300);
    return { success: true };
  }
  return callProxy('confirm_arrival', { shipmentId, ...confirmation });
}

/**
 * Fetch available drop-off hubs near a ZIP code.
 *
 * @param {string} zip
 * @returns {Promise<Array<{ id: string, name: string, address: string, city: string, state: string, zip: string, hours: string, distance: number }>>}
 */
export async function getNearbyHubs(zip) {
  if (DEMO_MODE) {
    await demoDelay(400);
    return [
      {
        id: 'hub_1',
        name: 'FedEx Ship Center',
        address: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zip,
        hours: 'Mon–Fri 8am–8pm, Sat 9am–5pm',
        distance: 2.3,
      },
      {
        id: 'hub_2',
        name: 'FedEx Office',
        address: '456 Oak Ave',
        city: 'Anytown',
        state: 'CA',
        zip,
        hours: 'Mon–Fri 7am–9pm, Sat–Sun 9am–6pm',
        distance: 4.1,
      },
    ];
  }
  return callProxy('get_nearby_hubs', { zip });
}

export const SHIPZEROS_URL = 'https://www.zerosgeckos.com/shippingproject';
export const IS_DEMO = DEMO_MODE;
