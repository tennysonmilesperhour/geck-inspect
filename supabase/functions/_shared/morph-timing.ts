// Where the time goes in one Morph ID request. Until October 2026 only the
// Claude call was timed (model_invocations.duration_ms), so a 101 s canary
// run with a 32 s Claude call could not say where the other 70 s went.
//
// Each request now reports its steps twice: a Server-Timing response header
// (the browser's network panel and the daily canary read it) and one JSON
// line in the function log. Neither holds a photo URL or anything about the
// member. Steps that overlap (the embedding runs while the database steps
// do) are reported as they ran, so they can add up to more than "total".
//
//   auth       the sign-in check (auth.getUser)
//   db         profile and plan, the per-network cap, the request key, the credit
//   embed      the photo embedding at Replicate (a cold model shows here)
//   neighbors  the reference-photo query (morph_visual_neighbors)
//   wait       time the request waited for the embedding after the db steps
//   claude     the analyzer call, retries included
//   writes     refund, scans-left read and request-key settle after the answer
//   total      arrival to response

export const TIMING_STEPS = ["auth", "db", "embed", "neighbors", "wait", "claude", "writes", "total"] as const;
export type TimingStep = typeof TIMING_STEPS[number];

export class MorphTiming {
  private readonly durations = new Map<TimingStep, number>();
  private readonly now: () => number;
  readonly startedAt: number;

  constructor(startedAt: number, now: () => number = () => Date.now()) {
    this.startedAt = startedAt;
    this.now = now;
  }

  /** Adds ms to a step (a step can run more than once, like db). */
  add(step: TimingStep, ms: number): void {
    if (!Number.isFinite(ms)) return;
    this.durations.set(step, (this.durations.get(step) ?? 0) + Math.max(0, ms));
  }

  /** Times a promise (or a query builder) under a step, whether it resolves or rejects. */
  async measure<T>(step: TimingStep, work: PromiseLike<T>): Promise<T> {
    const started = this.now();
    try {
      return await work;
    } finally {
      this.add(step, this.now() - started);
    }
  }

  /** Marks "total" as arrival to now. */
  finish(): this {
    this.durations.set("total", Math.max(0, this.now() - this.startedAt));
    return this;
  }

  get(step: TimingStep): number | undefined {
    return this.durations.get(step);
  }

  snapshot(): Partial<Record<TimingStep, number>> {
    const out: Partial<Record<TimingStep, number>> = {};
    for (const step of TIMING_STEPS) {
      const ms = this.durations.get(step);
      if (ms != null) out[step] = Math.round(ms);
    }
    return out;
  }
}

/** "auth;dur=120, embed;dur=1500": whole ms, in step order, steps that ran only. */
export function serverTimingHeader(durations: Partial<Record<string, number | undefined>>): string {
  return TIMING_STEPS
    .filter((step) => typeof durations[step] === "number" && Number.isFinite(durations[step]))
    .map((step) => `${step};dur=${Math.round(durations[step] as number)}`)
    .join(", ");
}

/**
 * The one log line per request. Only the outcome, the photo count and the
 * step times: never a URL, a user id, an email or an IP.
 */
export function timingLogLine(input: {
  outcome: string;
  status: number;
  photoCount?: number;
  durations: Partial<Record<string, number | undefined>>;
}): string {
  const steps: Record<string, number> = {};
  for (const step of TIMING_STEPS) {
    const ms = input.durations[step];
    if (typeof ms === "number" && Number.isFinite(ms)) steps[step] = Math.round(ms);
  }
  return JSON.stringify({
    event: "morph_id_timing",
    outcome: String(input.outcome).slice(0, 60),
    status: input.status,
    photos: Number.isFinite(input.photoCount) ? input.photoCount : null,
    ms: steps,
  });
}
