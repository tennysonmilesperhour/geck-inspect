import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Package, MapPin, Clock, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { trackShipment } from '@/integrations/ShipZeros';

const STATUS_STYLES = {
  label_created: { label: 'Label Created', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  picked_up: { label: 'Picked Up', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  in_transit: { label: 'In Transit', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  out_for_delivery: { label: 'Out for Delivery', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  delivered: { label: 'Delivered', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  arrival_confirmed: { label: 'Live Arrival Confirmed', color: 'bg-emerald-600/20 text-emerald-200 border-emerald-600/30' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

function OrderRow({ order }) {
  const [expanded, setExpanded] = useState(false);
  const [tracking, setTracking] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  const status = STATUS_STYLES[order.status] || STATUS_STYLES.label_created;

  const handleTrack = async () => {
    if (expanded && tracking) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (!tracking && order.tracking_number) {
      setTrackingLoading(true);
      try {
        const data = await trackShipment(order.tracking_number);
        setTracking(data);
      } catch {
        setTracking(null);
      }
      setTrackingLoading(false);
    }
  };

  return (
    <Card className="border-slate-800 bg-slate-900/60">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${status.color}`}>
                {status.label}
              </span>
              {order.service && (
                <span className="text-[10px] text-slate-500">{order.service}</span>
              )}
            </div>
            <div className="mt-2 space-y-1">
              <p className="text-sm text-slate-200 font-medium">
                To: {order.recipient_name || 'Unknown'}
              </p>
              {order.recipient_city && order.recipient_state && (
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {order.recipient_city}, {order.recipient_state} {order.recipient_zip}
                </p>
              )}
              {order.tracking_number && (
                <p className="text-xs text-slate-400 font-mono">
                  Tracking: {order.tracking_number}
                </p>
              )}
            </div>
          </div>
          <div className="text-right shrink-0 space-y-1">
            {order.price != null && (
              <p className="text-sm font-semibold text-white">${Number(order.price).toFixed(2)}</p>
            )}
            {order.estimated_delivery && (
              <p className="text-[10px] text-slate-500 flex items-center gap-1 justify-end">
                <Clock className="w-3 h-3" /> {order.estimated_delivery}
              </p>
            )}
          </div>
        </div>

        {order.tracking_number && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTrack}
            className="mt-3 text-xs text-slate-400 hover:text-slate-200 p-0 h-auto"
          >
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5 mr-1" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 mr-1" />
            )}
            {expanded ? 'Hide tracking' : 'View tracking'}
          </Button>
        )}

        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-800">
            {trackingLoading && (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading tracking...
              </div>
            )}
            {tracking && (
              <div className="space-y-3">
                <p className="text-sm text-slate-300">{tracking.statusDetail}</p>
                <div className="relative pl-4 space-y-3">
                  {tracking.events.map((evt, i) => (
                    <div key={i} className="relative">
                      <div className="absolute -left-4 top-1.5 w-2 h-2 rounded-full bg-emerald-500" />
                      {i < tracking.events.length - 1 && (
                        <div className="absolute -left-[11px] top-3 bottom-0 w-px bg-slate-700" />
                      )}
                      <p className="text-xs text-slate-200">{evt.description}</p>
                      <p className="text-[10px] text-slate-500">
                        {evt.location} &middot;{' '}
                        {new Date(evt.timestamp).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!trackingLoading && !tracking && (
              <p className="text-xs text-slate-500">
                Tracking information is not yet available.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ShippingOrderList({ orders }) {
  if (!orders || orders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center">
        <Package className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-300 font-semibold">No shipments yet</p>
        <p className="text-sm text-slate-500 mt-1">
          Get a quote above to create your first shipment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <OrderRow key={order.id} order={order} />
      ))}
    </div>
  );
}
