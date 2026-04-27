import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  Loader2, History, RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { BlogLog } from '@/entities/all';
import { BLOG_LOG_EVENT_LABELS } from '@/lib/blog-helpers';

const EVENT_FILTERS = [
  { value: 'all', label: 'All events' },
  ...Object.entries(BLOG_LOG_EVENT_LABELS).map(([value, label]) => ({ value, label })),
];

export default function BlogLogs() {
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const all = await BlogLog.list('-created_date');
      setLogs(Array.isArray(all) ? all.slice(0, 200) : []);
    } catch (err) {
      toast({ title: 'Could not load logs', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'all'
    ? logs
    : logs.filter((l) => l.event_type === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <p className="text-sm text-slate-400 flex items-center gap-2">
          <History className="w-4 h-4 text-emerald-400" />
          Append-only audit trail of every blog action.
        </p>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-56 bg-slate-800 border-slate-700 text-slate-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={load}
            disabled={loading}
            className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl text-slate-500">
          No log entries yet.
        </div>
      ) : (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-0 divide-y divide-slate-800">
            {filtered.map((log) => (
              <div key={log.id} className="p-4 flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-slate-700 text-slate-100 text-xs">
                      {BLOG_LOG_EVENT_LABELS[log.event_type] || log.event_type}
                    </Badge>
                    {log.status && log.status !== 'success' && (
                      <Badge className={`text-xs ${log.status === 'error' ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'}`}>
                        {log.status}
                      </Badge>
                    )}
                  </div>
                  {log.message && (
                    <p className="text-sm text-slate-300 mt-1">{log.message}</p>
                  )}
                  <p className="text-[11px] text-slate-500 mt-1">
                    {log.created_date ? format(new Date(log.created_date), 'PP p') : '—'}
                    {log.created_by && <> · by {log.created_by}</>}
                    {log.related_post_id && <> · post {String(log.related_post_id).slice(0, 8)}</>}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
