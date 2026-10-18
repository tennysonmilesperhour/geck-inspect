import { Card, CardContent } from "@/components/ui/card";

export default function StatsCard({ title, value, icon: Icon, description }) {
  return (
    <Card className="gecko-card hover:border-emerald-500/30 transition-all duration-300">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 truncate">
              {title}
            </p>
            <p className="mt-2 text-3xl sm:text-4xl font-bold text-slate-100 leading-none tabular-nums tracking-tight">
              {value}
            </p>
            {description && (
              <p className="text-xs text-slate-400 mt-2 leading-snug">
                {description}
              </p>
            )}
          </div>
          <div className="flex-shrink-0 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}