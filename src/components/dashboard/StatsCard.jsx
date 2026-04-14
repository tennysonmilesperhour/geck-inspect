import { Card, CardContent } from "@/components/ui/card";

export default function StatsCard({ title, value, icon: Icon, gradient, description }) {
  return (
    <Card className="bg-slate-900/80 border-slate-700/60 hover:border-emerald-500/30 transition-all duration-300">
      <CardContent className="p-5">
        <div className="flex justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-400 leading-tight min-h-[2.5rem] flex items-start">{title}</p>
            <p className="text-4xl font-bold text-white leading-none">{value}</p>
            {description && (
              <p className="text-xs text-slate-500 mt-2 leading-snug min-h-[2rem]">{description}</p>
            )}
          </div>
          <div className={`flex-shrink-0 self-start p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}