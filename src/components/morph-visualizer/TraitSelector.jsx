import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

export default function TraitSelector({ 
  title, 
  options, 
  selected, 
  type, 
  onSelect, 
  compact = false 
}) {
  const isSelected = (option) => {
    if (type === 'multiple') {
      return Array.isArray(selected) && selected.includes(option);
    }
    return selected === option;
  };

  const handleSelect = (option) => {
    onSelect(option);
  };

  return (
    <div className="space-y-3">
      <h4 className={`font-semibold text-slate-300 ${compact ? 'text-sm' : 'text-base'}`}>
        {title}
      </h4>
      <div className="flex flex-wrap gap-2">
        {options.map(option => (
          <Button
            key={option}
            variant={isSelected(option) ? 'default' : 'outline'}
            size={compact ? 'sm' : 'sm'}
            onClick={() => handleSelect(option)}
            className={`
              transition-all duration-200 relative
              ${isSelected(option) 
                ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white' 
                : 'bg-slate-800 border-slate-600 hover:bg-slate-700 text-slate-300 hover:border-emerald-500'
              }
              ${compact ? 'text-xs px-2 py-1' : 'text-sm'}
            `}
          >
            {isSelected(option) && (
              <Check className="w-3 h-3 mr-1" />
            )}
            {option}
          </Button>
        ))}
      </div>
    </div>
  );
}