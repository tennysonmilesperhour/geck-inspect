import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { buildInfo as readBuildInfo, fetchHealthStatus, jobNeedsAttention } from '@/lib/adminData';

/**
 * System health checks, quick overview of integrations the app depends on.
 *
 * Each check returns { ok, label, detail } and is rendered as a row.
 * Reuses the same supabase client the rest of the app uses, so a green
 * checkmark here means "the live app is talking to Supabase right now".
 */

const REQUIRED_ENV_KEYS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
// PostHog is opt-in, the client no-ops when these are unset (see src/lib/posthog.js).
const OPTIONAL_ENV_KEYS = ['VITE_POSTHOG_KEY', 'VITE_POSTHOG_HOST'];

function getEnv(key) {
  try {
    return import.meta.env[key];
  } catch {
    return undefined;
  }
}

async function pingSupabase() {
  const start = performance.now();
  try {
    // Lightweight HEAD-style query, count only, single row at most.
    const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
    if (error) throw error;
    const ms = Math.round(performance.now() - start);
    return { ok: true, label: 'Supabase reachable', detail: `${ms}ms round-trip` };
  } catch (err) {
    return { ok: false, label: 'Supabase failed', detail: err.message || 'unknown error' };
  }
}

async function pingAuth() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return {
      ok: true,
      label: 'Auth session',
      detail: data?.session ? `signed in as ${data.session.user.email}` : 'no active session',
    };
  } catch (err) {
    return { ok: false, label: 'Auth check failed', detail: err.message || 'unknown' };
  }
}

function checkEnv() {
  const missingRequired = REQUIRED_ENV_KEYS.filter((k) => !getEnv(k));
  if (missingRequired.length > 0) {
    return {
      ok: false,
      label: 'Environment variables',
      detail: `missing required: ${missingRequired.join(', ')}`,
    };
  }
  const missingOptional = OPTIONAL_ENV_KEYS.filter((k) => !getEnv(k));
  if (missingOptional.length > 0) {
    return {
      ok: true,
      label: 'Environment variables',
      detail: `${REQUIRED_ENV_KEYS.length} required set; optional unset: ${missingOptional.join(', ')}`,
    };
  }
  const total = REQUIRED_ENV_KEYS.length + OPTIONAL_ENV_KEYS.length;
  return { ok: true, label: 'Environment variables', detail: `all ${total} keys set` };
}

function HealthRow({ result }) {
  if (!result) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/40 px-4 py-3">
        <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" />
        <span className="text-sm text-slate-400">Checking...</span>
      </div>
    );
  }
  const Icon = result.ok ? CheckCircle2 : XCircle;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/40 px-4 py-3">
      <Icon
        className={`w-5 h-5 shrink-0 ${result.ok ? 'text-emerald-400' : 'text-rose-400'}`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-100">{result.label}</p>
        <p className="text-xs text-slate-500 truncate">{result.detail}</p>
      </div>
      <Badge
        variant="outline"
        className={
          result.ok
            ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
            : 'border-rose-500/40 text-rose-300 bg-rose-500/10'
        }
      >
        {result.ok ? 'OK' : 'FAIL'}
      </Badge>
    </div>
  );
}

function ago(ts) {
  if (!ts) return 'never';
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  } catch {
    return String(ts);
  }
}

function summarizeServer(server) {
  if (!server) return [null, null, null];
  if (server.error) {
    const fail = { ok: false, label: 'Server checks', detail: server.error };
    return [fail, fail, fail];
  }
  const jobs = (server.jobs || []).filter((j) => !j.error);
  const jobsUnavailable = (server.jobs || []).some((j) => j.error);
  const failing = (server.jobs || []).filter(jobNeedsAttention);
  const active = jobs.filter((j) => j.active).length;
  const http = server.http_errors || [];
  const clientErrors = Number(server.client_errors_24h || 0);
  return [
    jobsUnavailable
      ? { ok: false, label: 'Scheduled jobs', detail: 'could not read the job list' }
      : {
          ok: failing.length === 0,
          label: 'Scheduled jobs',
          detail: failing.length === 0
            ? `${active} on, ${jobs.length - active} off, none failing`
            : `failing: ${failing.map((j) => j.name).join(', ')}`,
        },
    {
      ok: http.length === 0,
      label: 'Edge function calls from the database',
      detail: http.length === 0
        ? 'no failed calls kept (pg_net keeps about six hours)'
        : `${http.length} failed, latest ${ago(http[0].at)} (HTTP ${http[0].status_code ?? 'none'})`,
    },
    {
      ok: clientErrors === 0,
      label: 'App errors in the last 24 hours',
      detail: clientErrors === 0 ? 'none unresolved' : `${clientErrors} unresolved (see Error Logs)`,
    },
  ];
}

export default function SystemHealth() {
  const [results, setResults] = useState([null, null, null]);
  const [server, setServer] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const runChecks = async () => {
    setIsRefreshing(true);
    setResults([null, null, null]);
    setServer(null);
    const serverPromise = fetchHealthStatus().catch((err) => ({ error: err?.message || 'admin_health_status failed' }));
    const env = checkEnv();
    setResults([env, null, null]);
    const sb = await pingSupabase();
    setResults([env, sb, null]);
    const auth = await pingAuth();
    setResults([env, sb, auth]);
    setServer(await serverPromise);
    setIsRefreshing(false);
  };

  const deploy = readBuildInfo();
  const serverRows = summarizeServer(server);

  useEffect(() => {
    runChecks();
  }, []);

  const buildInfo = {
    'Deploy version': deploy.commit === 'dev' ? 'dev (not a deployed build)' : deploy.shortCommit,
    'Built': deploy.builtAt ? `${new Date(deploy.builtAt).toLocaleString()} (${ago(deploy.builtAt)})` : 'unknown',
    'Branch': deploy.branch || 'unknown',
    'Vercel environment': deploy.deployEnv || 'unknown',
    'App URL': window.location.origin,
    'Supabase URL': getEnv('VITE_SUPABASE_URL') || '(unset)',
    'PostHog enabled': getEnv('VITE_POSTHOG_KEY') ? 'yes' : 'no',
    'Build mode': import.meta.env.MODE,
    'User agent': navigator.userAgent.split(' ').slice(-2).join(' '),
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-slate-100">System Health</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={runChecks}
              disabled={isRefreshing}
              className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              {isRefreshing ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              )}
              Re-run
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {results.map((r, i) => (
            <HealthRow key={i} result={r} />
          ))}
          {serverRows.map((r, i) => (
            <HealthRow key={`server-${i}`} result={r} />
          ))}
        </CardContent>
      </Card>

      {server && !server.error && (
        <Card>
          <CardHeader>
            <CardTitle className="text-slate-100 text-base">Scheduled jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-800">
              {(server.jobs || []).filter((j) => !j.error).map((job) => {
                const bad = jobNeedsAttention(job);
                return (
                  <div key={job.name} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className={`font-mono text-xs ${job.active ? 'text-slate-200' : 'text-slate-500'}`}>{job.name}</p>
                      <p className="text-xs text-slate-500">
                        {job.schedule} · {job.active ? 'on' : 'off'} · last run {ago(job.last_start)}
                        {job.failures_7d > 0 && ` · ${job.failures_7d} failed this week`}
                      </p>
                      {job.last_message && (
                        <p className="text-xs text-rose-300 break-words">{job.last_message}</p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        !job.active
                          ? 'border-slate-600 text-slate-400'
                          : bad
                            ? 'border-rose-500/40 text-rose-300 bg-rose-500/10'
                            : 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                      }
                    >
                      {!job.active ? 'OFF' : job.last_status ? job.last_status.toUpperCase() : 'NOT RUN YET'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {server && !server.error && (server.http_errors || []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-slate-100 text-base">Recent failed edge function calls</CardTitle>
            <p className="text-xs text-slate-500">
              Calls the database made (cron jobs and triggers). Calls from the app itself are in the
              Supabase dashboard under Edge Functions, Logs.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {server.http_errors.map((e) => (
              <div key={e.id} className="rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2 text-xs">
                <p className="text-slate-200">
                  HTTP {e.status_code ?? 'none'}{e.timed_out ? ', timed out' : ''} · {ago(e.at)}
                </p>
                {e.error && <p className="text-slate-500 break-words mt-0.5">{e.error}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-slate-100 text-base">Build & environment</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-slate-800">
            {Object.entries(buildInfo).map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between gap-4 py-2.5 text-sm"
              >
                <dt className="text-slate-400">{k}</dt>
                <dd className="text-slate-200 font-mono text-xs truncate max-w-md text-right">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-slate-100 text-base">External dashboards</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { label: 'Supabase project', url: 'https://supabase.com/dashboard' },
            { label: 'Vercel deployments', url: 'https://vercel.com/dashboard' },
            { label: 'PostHog product analytics', url: 'https://app.posthog.com' },
          ].map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="touch:min-h-11 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/40 hover:bg-slate-800 hover:border-slate-700 px-4 py-3 text-sm transition-colors"
            >
              <span className="text-slate-200">{link.label}</span>
              <ExternalLink className="w-4 h-4 text-slate-500" />
            </a>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
