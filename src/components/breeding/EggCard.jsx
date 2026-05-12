import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, Baby, CheckCircle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';
import { createGeckoFromEgg } from '@/functions/createGeckoFromEgg';
import { Egg as EggEntity } from '@/entities/all';
import { toast } from '@/components/ui/use-toast';

const GRADE_COLORS = {
  'A+': 'bg-emerald-500 text-white',
  'A': 'bg-green-500 text-white',
  'B': 'bg-blue-500 text-white',
  'C': 'bg-yellow-500 text-black',
  'D': 'bg-red-500 text-white',
};

export default function EggCard({ egg, breedingPlan: _breedingPlan, onUpdate }) {
  const getStatusColor = (status) => {
    const colors = {
      'Incubating': 'bg-blue-500',
      'Hatched': 'bg-green-500',
      'Slug': 'bg-gray-500',
      'Infertile': 'bg-red-500',
      'Stillbirth': 'bg-red-700'
    };
    return colors[status] || 'bg-gray-500';
  };

  const calculateDaysRemaining = () => {
    if (!egg.hatch_date_expected) return null;
    const today = new Date();
    const expectedDate = parseLocalDate(egg.hatch_date_expected);
    return differenceInDays(expectedDate, today);
  };

  const handleHatch = async () => {
    try {
      const { data } = await createGeckoFromEgg({ eggId: egg.id });
      
      toast({
        title: "Gecko Created!",
        description: data.message,
      });

      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to create gecko from egg:', error);
      toast({
        title: "Error",
        description: "Failed to create gecko from hatched egg",
        variant: "destructive",
      });
    }
  };

  const daysRemaining = calculateDaysRemaining();

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardContent className="p-3 sm:p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-slate-300 font-medium">
              Egg #{egg.id.slice(-6)}
            </p>
            <p className="text-slate-400 text-sm">
              Laid: {format(parseLocalDate(egg.lay_date), 'MMM d, yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {egg.grade && (
              <Badge className={`${GRADE_COLORS[egg.grade] || 'bg-slate-600 text-white'} text-xs font-bold px-1.5`}>
                {egg.grade}
              </Badge>
            )}
            <Badge className={`${getStatusColor(egg.status)} text-white`}>
              {egg.status}
            </Badge>
          </div>
        </div>

        {/* Egg Grade */}
        <div className="mb-3">
          <Select
            value={egg.grade || ''}
            onValueChange={async (v) => {
              try {
                await EggEntity.update(egg.id, { grade: v });
                if (onUpdate) onUpdate();
              } catch (e) {
                toast({ title: 'Error', description: 'Failed to update grade', variant: 'destructive' });
              }
            }}
          >
            <SelectTrigger className="h-7 text-xs bg-slate-700 border-slate-600 w-28">
              <SelectValue placeholder="Rate egg" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A+">A+ ,  Excellent</SelectItem>
              <SelectItem value="A">A ,  Great</SelectItem>
              <SelectItem value="B">B ,  Good</SelectItem>
              <SelectItem value="C">C ,  Fair</SelectItem>
              <SelectItem value="D">D ,  Poor</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {egg.hatch_date_expected && egg.status === 'Incubating' && (
          <div className="mb-3">
            <p className="text-slate-400 text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Expected: {format(parseLocalDate(egg.hatch_date_expected), 'MMM d, yyyy')}
            </p>
            {daysRemaining !== null && (
              <p className="text-slate-300 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {daysRemaining > 0 ? `${daysRemaining} days remaining` : 
                 daysRemaining === 0 ? 'Due today!' : 
                 `${Math.abs(daysRemaining)} days overdue`}
              </p>
            )}
          </div>
        )}

        {egg.hatch_date_actual && (
          <div className="mb-3">
            <p className="text-slate-300 text-sm flex items-center gap-2">
              <Baby className="w-4 h-4" />
              Hatched: {format(parseLocalDate(egg.hatch_date_actual), 'MMM d, yyyy')}
            </p>
          </div>
        )}

        {egg.status === 'Incubating' && (
          <div className="flex gap-2 mt-4">
            <Button
              size="sm"
              onClick={handleHatch}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark as Hatched
            </Button>
          </div>
        )}

        {egg.gecko_id && (
          <div className="mt-3 p-2 bg-slate-700 rounded">
            <p className="text-slate-300 text-sm">
              Created gecko successfully!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}