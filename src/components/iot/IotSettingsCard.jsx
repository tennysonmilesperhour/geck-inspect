import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Thermometer, Loader2, KeyRound, Save, RadioTower, Crown } from 'lucide-react';
import { getConnection, saveConnection, saveMappings, pollSensors } from '@/lib/iotClient';
import { getFeatureUsage } from '@/lib/usageMeter';
import { getTierLimits } from '@/lib/tierLimits';

const GOVEE_KEY_DOCS_URL = 'https://developer.govee.com/reference/apply-you-govee-api-key';

/**
 * Settings card for the Govee enclosure-sensor integration (Keeper and
 * up). Saves the API key (displayed as a masked tail afterwards, never
 * round-tripped in full), tests the connection by polling the iot-poll
 * edge function, and lets the user label each supported sensor (for
 * example "Rack 2, Luna's bin"). Labels persist to
 * iot_connections.device_mappings as [{ device, model, label }].
 */
export default function IotSettingsCard({ user }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState(null);

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [keyError, setKeyError] = useState(null);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { devices, polledAt, creditsRemaining }
  const [exhausted, setExhausted] = useState(false);

  const [labelDraft, setLabelDraft] = useState({}); // { [deviceId]: label }
  const [savingMappings, setSavingMappings] = useState(false);

  const [usage, setUsage] = useState(null);

  const includedPolls = getTierLimits(user).monthlyIotPolls;
  const isPaid = includedPolls !== 0; // null = unlimited, still paid

  useEffect(() => {
    if (!user || !isPaid) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [conn, used] = await Promise.all([
          getConnection(),
          getFeatureUsage('iot_poll'),
        ]);
        if (cancelled) return;
        setConnection(conn);
        setUsage(used);
        if (conn?.deviceMappings?.length) {
          const draft = {};
          for (const m of conn.deviceMappings) draft[m.device] = m.label;
          setLabelDraft(draft);
        }
      } catch (err) {
        console.error('Failed to load IoT connection:', err);
        if (!cancelled) {
          toast({
            title: 'Could not load sensor settings',
            description: err?.message || 'Please try again later.',
            variant: 'destructive',
          });
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, isPaid, toast]);

  // Devices to show in the mapping editor: the freshest list we have,
  // either this session's test poll or the readings cached on the row.
  const knownDevices = useMemo(() => {
    if (testResult?.devices?.length) return testResult.devices;
    return connection?.lastReadings || [];
  }, [testResult, connection]);
  const supportedDevices = knownDevices.filter((d) => d.supported);

  const handleSaveKey = async () => {
    setSavingKey(true);
    setKeyError(null);
    try {
      const conn = await saveConnection({ apiKey: apiKeyInput });
      setConnection(conn);
      setApiKeyInput('');
      setTestResult(null);
      setExhausted(false);
      toast({
        title: 'API key saved',
        description: 'Hit "Test connection" to discover your sensors.',
      });
    } catch (err) {
      console.error('Failed to save Govee key:', err);
      setKeyError(err?.message || 'Could not save the API key. Please try again.');
    }
    setSavingKey(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setKeyError(null);
    const { data, error } = await pollSensors();
    if (error) {
      if (error.code === 'iot_polls_credits_exhausted') {
        setExhausted(true);
      } else if (error.code === 'bad_provider_key') {
        setKeyError('Govee rejected this API key. Double-check it in the Govee Home app and save it again.');
      } else if (error.code === 'no_connection') {
        setKeyError('Save your Govee API key first, then test the connection.');
      } else {
        toast({
          title: 'Sensor test failed',
          description: error.message || 'Could not reach your sensors. Please try again.',
          variant: 'destructive',
        });
      }
    } else {
      setExhausted(false);
      setTestResult(data);
      setConnection((prev) => (prev
        ? { ...prev, lastReadings: data.devices, lastPolledAt: data.polledAt }
        : prev));
      if (data.creditsRemaining != null) {
        setUsage((prev) => ({ ...(prev || {}), remaining: data.creditsRemaining }));
      }
      const supported = data.devices.filter((d) => d.supported).length;
      toast({
        title: 'Connection works',
        description: `Found ${data.devices.length} device${data.devices.length === 1 ? '' : 's'}, ${supported} with temperature or humidity readings.`,
      });
    }
    setTesting(false);
  };

  const handleSaveMappings = async () => {
    setSavingMappings(true);
    try {
      const mappings = supportedDevices.map((d) => ({
        device: d.device,
        model: d.model,
        label: (labelDraft[d.device] || '').trim(),
      }));
      const conn = await saveMappings(mappings);
      setConnection(conn);
      toast({
        title: 'Enclosure labels saved',
        description: `${conn.deviceMappings.length} sensor${conn.deviceMappings.length === 1 ? '' : 's'} mapped.`,
      });
    } catch (err) {
      console.error('Failed to save device mappings:', err);
      toast({
        title: 'Could not save labels',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    }
    setSavingMappings(false);
  };

  const upgradeCta = (text) => (
    <div className="flex items-start justify-between gap-4 p-4 border border-slate-700 rounded-lg bg-slate-800/50">
      <div>
        <Label className="font-medium text-slate-200 flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-400" />
          Enclosure sensors
        </Label>
        <p className="text-sm text-slate-400 mt-1">{text}</p>
      </div>
      <Button
        size="sm"
        className="bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
        onClick={() => { window.location.href = '/Membership'; }}
      >
        See plans
      </Button>
    </div>
  );

  return (
    <Card className="bg-slate-900/50 border-slate-700 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <Thermometer className="w-5 h-5" />
          Enclosure sensors (Govee)
        </CardTitle>
        <CardDescription className="text-slate-400">
          Connect your Govee thermo-hygrometers and read temperature and
          humidity for each enclosure right inside Geck Inspect. Available
          on Keeper and up.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isPaid ? (
          upgradeCta('Upgrade to Keeper to connect your Govee devices and pull live enclosure readings into your dashboard.')
        ) : loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading your connection...
          </div>
        ) : (
          <>
            {/* Connection status */}
            <div className="flex items-center gap-2 flex-wrap">
              {connection?.keyTail ? (
                <>
                  <Badge className="bg-emerald-900/50 text-emerald-200 border-emerald-600">
                    Connected
                  </Badge>
                  <span className="text-sm text-slate-400">
                    API key {connection.keyTail}
                    {connection.isActive ? '' : ' (inactive)'}
                  </span>
                </>
              ) : (
                <Badge variant="secondary" className="bg-slate-700 text-slate-300 border-slate-600">
                  Not connected
                </Badge>
              )}
              {usage?.remaining != null && (
                <span className="text-xs text-slate-500">
                  {usage.remaining} sensor read{usage.remaining === 1 ? '' : 's'} left this month
                </span>
              )}
            </div>

            {/* API key input */}
            <div className="space-y-2">
              <Label htmlFor="govee-api-key" className="text-slate-300 flex items-center gap-2">
                <KeyRound className="w-4 h-4" />
                Govee API key
              </Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  id="govee-api-key"
                  type="password"
                  autoComplete="off"
                  value={apiKeyInput}
                  onChange={(e) => { setApiKeyInput(e.target.value); setKeyError(null); }}
                  placeholder={connection?.keyTail ? `Saved (${connection.keyTail}). Paste a new key to replace it.` : 'Paste your Govee API key'}
                  className="bg-slate-800 border-slate-600 text-slate-100"
                />
                <Button
                  onClick={handleSaveKey}
                  disabled={savingKey || !apiKeyInput.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
                >
                  {savingKey ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save key
                </Button>
              </div>
              {keyError && (
                <p className="text-sm text-red-400">{keyError}</p>
              )}
              <p className="text-xs text-slate-500">
                Get a free key in the Govee Home app: About Us, then Apply for API key.
                Govee emails it within minutes.{' '}
                <a
                  href={GOVEE_KEY_DOCS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-300 hover:text-emerald-200 underline-offset-2 hover:underline"
                >
                  Step-by-step instructions
                </a>
              </p>
            </div>

            {/* Free tier hit the cap or monthly limit reached */}
            {exhausted && upgradeCta('You have used all of your sensor reads for this month. Upgrade for a bigger monthly allotment.')}

            {/* Test connection */}
            {connection?.keyTail && (
              <div className="space-y-3">
                <Button
                  variant="outline"
                  onClick={handleTest}
                  disabled={testing}
                  className="bg-slate-800 border-slate-600 text-slate-100 hover:bg-slate-700 hover:text-white"
                >
                  {testing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RadioTower className="w-4 h-4 mr-2" />
                  )}
                  Test connection
                </Button>
                <p className="text-xs text-slate-500">
                  Each test uses one sensor read from your monthly allotment.
                </p>

                {knownDevices.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-300 font-medium">Discovered devices</p>
                    {knownDevices.map((d) => (
                      <div
                        key={d.device}
                        className="flex items-center justify-between gap-3 p-3 border border-slate-700 rounded-lg bg-slate-800/50"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-slate-200 truncate">{d.name}</p>
                          <p className="text-xs text-slate-500">{d.model}</p>
                        </div>
                        {d.supported ? (
                          <Badge className="bg-emerald-900/50 text-emerald-200 border-emerald-600 shrink-0">
                            Supported
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-slate-700 text-slate-400 border-slate-600 shrink-0">
                            No climate readings
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Device mapping editor */}
            {supportedDevices.length > 0 && (
              <div className="space-y-3 border-t border-slate-700 pt-4">
                <div>
                  <p className="text-sm text-slate-300 font-medium">Label your enclosures</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Give each sensor a name you recognize, like &quot;Rack 2, Luna&apos;s bin&quot;.
                    Only labeled sensors show up in the climate widget.
                  </p>
                </div>
                {supportedDevices.map((d) => (
                  <div key={d.device} className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-200 truncate">{d.name}</p>
                      <p className="text-xs text-slate-500">{d.model}</p>
                    </div>
                    <Input
                      value={labelDraft[d.device] || ''}
                      onChange={(e) => setLabelDraft((prev) => ({ ...prev, [d.device]: e.target.value }))}
                      placeholder="Enclosure label"
                      className="bg-slate-800 border-slate-600 text-slate-100"
                    />
                  </div>
                ))}
                <Button
                  onClick={handleSaveMappings}
                  disabled={savingMappings}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {savingMappings ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save labels
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
