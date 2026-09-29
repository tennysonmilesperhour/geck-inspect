import { useMemo } from 'react';
import { format } from 'date-fns';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { parseLocalDate } from '@/lib/dateUtils';
import { growthVerdict, hasGrowthBand, withGrowthBand } from '@/lib/growthBand';

// One weight chart for the gecko page, the detail view and the passport.
// Behind the line it shades the typical weight for the gecko's age from the
// care guide (src/lib/growthBand.js), and under it says where the latest
// weigh-in sits, so "is 18 g normal at 8 months?" answers itself.

const THEMES = {
  dark: {
    grid: 'rgba(134, 239, 172, 0.15)', axis: '#a7f3d0', line: '#86efac', band: '#34d399',
    tipBg: '#022c22', tipBorder: 'rgba(134, 239, 172, 0.2)', tipLabel: '#d1fae5',
    caption: 'text-slate-400', within: 'text-emerald-300', below: 'text-amber-300', above: 'text-sky-300',
  },
  light: {
    grid: 'rgba(78, 124, 78, 0.12)', axis: '#6b7c6b', line: '#4e7c4e', band: '#4e7c4e',
    tipBg: '#fbfaf6', tipBorder: '#dfe8d8', tipLabel: '#2c3e2c',
    caption: 'text-stone-500', within: 'text-emerald-800', below: 'text-amber-800', above: 'text-sky-800',
  },
};

export function weightChartPoints(records = []) {
  return [...records]
    .filter((r) => r?.record_date && Number.isFinite(Number(r.weight_grams)))
    .sort((a, b) => String(a.record_date).localeCompare(String(b.record_date)))
    .map((r) => {
      const day = parseLocalDate(r.record_date);
      return {
        record_date: r.record_date,
        date: format(day, 'MMM d'),
        fullDate: format(day, 'PPP'),
        weight: Number(r.weight_grams),
      };
    });
}

export default function WeightChart({ records, gecko, height = 200, theme = 'dark' }) {
  const colors = THEMES[theme] || THEMES.dark;
  const points = useMemo(() => withGrowthBand(weightChartPoints(records), gecko), [records, gecko]);
  const showBand = hasGrowthBand(gecko) && points.some((p) => p.band);
  const latest = points[points.length - 1];
  const verdict = latest ? growthVerdict(gecko, latest.weight, parseLocalDate(latest.record_date)) : null;

  const domain = useMemo(() => {
    const values = points.flatMap((p) => (p.band ? [p.weight, ...p.band] : [p.weight]));
    if (!values.length) return [0, 10];
    const min = Math.min(...values);
    const max = Math.max(...values);
    return [Math.max(0, Math.floor(min - 2)), Math.ceil(max + 2)];
  }, [points]);

  if (!points.length) return null;

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={points}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis dataKey="date" stroke={colors.axis} tick={{ fontSize: 11, fill: colors.axis }} />
          <YAxis stroke={colors.axis} unit="g" tick={{ fontSize: 11, fill: colors.axis }} domain={domain} allowDecimals={false} />
          <Tooltip
            contentStyle={{ backgroundColor: colors.tipBg, border: `1px solid ${colors.tipBorder}`, borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: colors.tipLabel }}
            itemStyle={{ color: colors.line }}
            labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
            formatter={(value, name) => (Array.isArray(value)
              ? [`${value[0]} to ${value[1]} g`, 'Typical for age']
              : [`${value} g`, name === 'weight' ? 'Weight' : name])}
          />
          {showBand && (
            <Area
              dataKey="band"
              name="Typical for age"
              stroke="none"
              fill={colors.band}
              fillOpacity={0.14}
              isAnimationActive={false}
              activeDot={false}
            />
          )}
          <Line type="monotone" dataKey="weight" name="weight" stroke={colors.line} strokeWidth={2} dot={{ r: 3, fill: colors.line }} activeDot={{ r: 6 }} />
        </ComposedChart>
      </ResponsiveContainer>
      {showBand && (
        <p className={`text-xs mt-2 ${colors.caption}`}>
          Shaded: the typical weight for this age, from the care guide.
          {verdict && <span className={`block mt-0.5 ${colors[verdict.level]}`}>{verdict.text}</span>}
        </p>
      )}
    </div>
  );
}
