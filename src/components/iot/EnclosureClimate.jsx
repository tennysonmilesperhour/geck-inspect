import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Thermometer, Droplets, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { getConnection, pollSensors } from '@/lib/iotClient';

// Crested gecko climate bands. Cresties stress above 78F and overheat
// fast above 82F, so the temperature scale leans cautious on purpose.
function tempBand(tempF) {
  if (tempF == null) return null;
  if (tempF > 82) {
    return {
      tone: 'text-red-300 border-red-500/50 bg-red-500/10',
      alert: 'Above 82F is dangerous for crested geckos. Cool this enclosure now.',
      danger: true,
    };
  }
  if (tempF >= 78) {
    return {
      tone: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
      alert: 'Running warm. Cresties do best below 78F.',
    };
  }
  if (tempF >= 65) {
    return { tone: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' };
  }
  return { tone: 'text-slate-300 border-slate-600 bg-slate-800/60' };
}

function humidityBand(humidity) {
  if (humidity == null) return null;
  if (humidity < 40) {
    return {
      tone: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
      alert: 'Humidity is low. Mist soon.',
    };
  }
  if (humidity >= 50 && humidity <= 80) {
    return { tone: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' };
  }
  return { tone: 'text-slate-300 border-slate-600 bg-slate-800/60' };
}

/**
 * Compact enclosure-climate widget. Shows the readings cached on the
 * user's iot_connections row (no poll on mount, reads cost credits) for
 * each device the user labeled in Settings, with a relative "as of"
 * stamp and a Refresh button that triggers a metered poll via the
 * iot-poll edge function.
 *
 * Props: { user }. Renders nothing when there is no active connection
 * or no mapped devices.
 */
export default function EnclosureClimate({ user }) {
  const { toast } = useToast();
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const conn = await getConnection();
        if (!cancelled) setConnection(conn);
      } catch {
        // Quiet failure: this is an optional dashboard widget, a load
        // error should never block the page it's mounted on.
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const { data, error } = await pollSensors();
    if (error) {
      if (error.code === 'iot_polls_credits_exhausted') {
        toast({
          title: 'No sensor reads left',
          description: error.included === 0
            ? 'Enclosure sensors are part of Keeper and up. Upgrade to refresh readings.'
            : 'You have used this month\'s sensor reads. Upgrade for a bigger allotment.',
          variant: 'destructive',
        });
      } else if (error.code === 'bad_provider_key') {
        toast({
          title: 'Govee rejected the API key',
          description: 'Re-check your key in Settings under Enclosure sensors.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Refresh failed',
          description: error.message || 'Could not read your sensors. Please try again.',
          variant: 'destructive',
        });
      }
    } else {
      setConnection((prev) => (prev
        ? { ...prev, lastReadings: data.devices, lastPolledAt: data.polledAt }
        : prev));
      if (data.creditsRemaining != null) setRemaining(data.creditsRemaining);
    }
    setRefreshing(false);
  };

  if (loading || !connection || !connection.isActive) return null;
  const mappings = connection.deviceMappings || [];
  if (mappings.length === 0) return null;

  const readingsByDevice = new Map(
    (connection.lastReadings || []).map((d) => [d.device, d])
  );

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/50 backdrop-blur-sm p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Thermometer className="w-4 h-4 text-emerald-400 shrink-0" />
          <h3 className="text-sm font-semibold text-slate-100 truncate">Enclosure climate</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {connection.lastPolledAt && (
            <span className="text-xs text-slate-500">
              as of {formatDistanceToNow(new Date(connection.lastPolledAt), { addSuffix: true })}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-7 px-2.5 text-xs bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white"
          >
            {refreshing ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {mappings.map((m) => {
          const reading = readingsByDevice.get(m.device);
          const tempF = reading?.readings?.temp_f ?? null;
          const humidity = reading?.readings?.humidity ?? null;
          const temp = tempBand(tempF);
          const humid = humidityBand(humidity);
          const alerts = [temp?.alert, humid?.alert].filter(Boolean);
          return (
            <div key={m.device} className="rounded-lg border border-slate-700/70 bg-slate-800/40 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-200 truncate">{m.label}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${temp ? temp.tone : 'text-slate-500 border-slate-700 bg-slate-800/60'}`}>
                    <Thermometer className="w-3 h-3" />
                    {tempF != null ? `${tempF}°F` : 'no data'}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${humid ? humid.tone : 'text-slate-500 border-slate-700 bg-slate-800/60'}`}>
                    <Droplets className="w-3 h-3" />
                    {humidity != null ? `${humidity}%` : 'no data'}
                  </span>
                </div>
              </div>
              {alerts.length > 0 && (
                <div className="mt-1.5 space-y-0.5">
                  {alerts.map((a) => (
                    <p
                      key={a}
                      className={`flex items-center gap-1.5 text-xs ${temp?.danger && a === temp.alert ? 'text-red-300' : 'text-amber-300'}`}
                    >
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      {a}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!connection.lastPolledAt && (
        <p className="text-xs text-slate-500">
          No readings yet. Hit Refresh to pull the first reading from your sensors.
        </p>
      )}
      {remaining != null && (
        <p className="text-xs text-slate-500">
          {remaining} sensor read{remaining === 1 ? '' : 's'} left this month
        </p>
      )}
    </div>
  );
}
