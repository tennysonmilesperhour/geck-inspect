import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { sectionId } from './recordModel';

/**
 * One section of the gecko record: a card with a heading, an id the jump
 * links scroll to, and room above it so the sticky bar does not cover the
 * heading after the jump. `headingAs` keeps the heading levels in order
 * (h2 under the page's h1, h3 under the window's h2). A section whose
 * content brings its own heading passes no title.
 */
export default function RecordCard({ id, icon: Icon, title = null, headingAs: Heading = 'h3', action = null, className = '', contentClassName = '', children }) {
  return (
    <Card id={id ? sectionId(id) : undefined} tabIndex={id ? -1 : undefined} className={cn('scroll-mt-28', className)} data-record-section={id || undefined}>
      {title && (
        <CardHeader className="pb-2 pt-4 px-4 flex-row items-center gap-2 space-y-0">
          <Heading className="text-base font-semibold flex items-center gap-2 text-slate-100">
            {Icon && <Icon className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />}
            {title}
          </Heading>
          {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
        </CardHeader>
      )}
      <CardContent className={cn('px-4 pb-4', !title && 'pt-4', contentClassName)}>{children}</CardContent>
    </Card>
  );
}
