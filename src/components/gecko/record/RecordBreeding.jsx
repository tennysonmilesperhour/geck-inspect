import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Baby, Calendar, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import BreedingHistory from '@/components/my-geckos/BreedingHistory';
import { parseLocalDate } from '@/lib/dateUtils';
import { createPageUrl } from '@/utils';
import RecordCard from './RecordCard';

const day = (iso, pattern = 'MMM d, yyyy') => {
  const d = iso ? parseLocalDate(iso) : null;
  return d ? format(d, pattern) : '';
};

const SUB_HEADING = 'text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2';

/**
 * Pairings this gecko is in, and for a female her seasons and eggs, then
 * every recorded offspring (each opens its own record).
 *
 *   partnerFor(plan)  the other gecko in a pairing, or null
 *   onTogglePlanPublic(plan, checked)  shows or hides a pairing publicly
 */
export default function RecordBreeding({ gecko, plans, eggs, offspring, weights, canEdit, partnerFor, onTogglePlanPublic, headingAs }) {
  const female = gecko.sex === 'Female';
  const SubHeading = headingAs === 'h2' ? 'h3' : 'h4';
  return (
    <RecordCard id="breeding" icon={Users} title={female ? 'Breeding and eggs' : 'Breeding'} headingAs={headingAs} contentClassName="space-y-5">
      <div>
        <SubHeading className={SUB_HEADING}>Pairings</SubHeading>
        {plans.length > 0 ? (
          <ul className="space-y-2">
            {plans.map((plan) => {
              const partner = partnerFor(plan);
              return (
                <li key={plan.id} className="bg-slate-800 p-3 rounded-lg space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-200 font-medium">
                      Paired with{' '}
                      {partner?.id ? (
                        <Link to={`${createPageUrl('GeckoDetail')}?id=${partner.id}`} className="text-emerald-300 underline underline-offset-2">{partner.name || 'Unnamed'}</Link>
                      ) : 'an unknown gecko'}
                    </span>
                    {plan.status && <Badge variant={plan.status === 'Successful' ? 'default' : 'secondary'}>{plan.status}</Badge>}
                  </div>
                  {plan.pairing_date && <p className="text-slate-400 text-xs">Paired {day(plan.pairing_date)}</p>}
                  {canEdit ? (
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`plan-public-${plan.id}`} className="text-xs text-slate-400">Show this pairing publicly</Label>
                      <Switch id={`plan-public-${plan.id}`} checked={Boolean(plan.is_public)} onCheckedChange={(checked) => onTogglePlanPublic(plan, checked)} />
                    </div>
                  ) : plan.is_public ? (
                    <Badge variant="outline" className="text-emerald-400 border-emerald-500">Public</Badge>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-slate-400 text-sm">No pairings recorded yet.</p>
        )}
      </div>

      {female && (
        <BreedingHistory
          eggs={eggs}
          breedingPlans={plans}
          weightRecords={weights}
          hatchDate={gecko.hatch_date}
          headingAs={SubHeading}
          headingClassName={SUB_HEADING}
        />
      )}

      {female && (
        <div>
          <SubHeading className={SUB_HEADING}><Calendar className="w-4 h-4 text-emerald-400" aria-hidden="true" /> Eggs</SubHeading>
          {eggs.length > 0 ? (
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {eggs.map((egg) => (
                <li key={egg.id} className="bg-slate-800 p-3 rounded-lg">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-300 text-sm">Laid {day(egg.lay_date) || 'on an unknown date'}</span>
                    {egg.status && <Badge variant={egg.status === 'Hatched' ? 'default' : 'secondary'} className="text-xs">{egg.status}</Badge>}
                  </div>
                  {egg.hatch_date_actual && <p className="text-slate-400 text-xs mt-1">Hatched {day(egg.hatch_date_actual)}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-400 text-sm">No eggs recorded.</p>
          )}
        </div>
      )}

      {offspring.length > 0 && (
        <div>
          <SubHeading className={SUB_HEADING}><Baby className="w-4 h-4 text-emerald-400" aria-hidden="true" /> Offspring ({offspring.length})</SubHeading>
          <ul className="space-y-1.5 max-h-48 overflow-y-auto">
            {offspring.map((child) => (
              <li key={child.id}>
                <Link
                  to={`${createPageUrl('GeckoDetail')}?id=${child.id}`}
                  className="bg-slate-800 hover:bg-slate-700 px-3 py-2 touch:min-h-11 rounded flex items-center justify-between gap-2"
                >
                  <span className="min-w-0">
                    <span className="block text-slate-200 font-medium text-sm truncate">{child.name || 'Unnamed'}</span>
                    {child.sex && <span className="block text-slate-400 text-xs">{child.sex}</span>}
                  </span>
                  {child.hatch_date && <span className="text-slate-400 text-xs shrink-0">{day(child.hatch_date, 'MMM yyyy')}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </RecordCard>
  );
}
