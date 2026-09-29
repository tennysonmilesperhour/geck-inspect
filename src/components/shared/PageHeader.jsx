import { Children } from 'react';
import { cn } from '@/lib/utils';

/**
 * The one page header for app pages.
 *
 * Pages used to hand-roll their headers, so titles ran from text-lg to
 * text-6xl, some were centered and some left-aligned, the settings gear
 * sometimes sat alone on its own row on phones, and action rows wrapped
 * at different breakpoints (or not at all). This renders the same
 * structure everywhere:
 *
 *   [eyebrow]
 *   [icon] Title                          [settings] [actions...]
 *   Description
 *
 * On phones the title and the settings gear share the first row and the
 * actions wrap onto their own full-width row below. From `md` up
 * everything sits on one line and the actions wrap only when they run
 * out of room.
 *
 * Props:
 *   icon         lucide icon component, shown before the title
 *   title        page title (string or node)
 *   description  one-line muted subtitle (string or node)
 *   eyebrow      small line above the title (breadcrumbs, a badge)
 *   settings     the page's <PageSettingsPanel>, kept on the title row
 *   children     action buttons; primary action last
 */
export default function PageHeader({
  icon: Icon,
  title,
  description,
  eyebrow,
  settings,
  children,
  className,
}) {
  // Actions are often conditional ({isOwner && <Button/>}); only draw
  // the actions row when something in it actually renders, or an empty
  // row would add a gap under the title on phones.
  const hasActions = Children.toArray(children).length > 0;

  return (
    <header
      className={cn(
        'mb-6 md:mb-8 flex flex-wrap items-start md:items-center gap-x-2 gap-y-4',
        className,
      )}
    >
      <div className="flex-1 min-w-0 md:min-w-[18rem]">
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <div className="flex items-start gap-3">
          {Icon && (
            <Icon
              className="w-7 h-7 md:w-8 md:h-8 mt-0.5 shrink-0 text-emerald-400"
              aria-hidden="true"
            />
          )}
          <h1 className="min-w-0 text-2xl md:text-3xl font-bold tracking-tight text-slate-100 break-words">
            {title}
          </h1>
        </div>
        {description && (
          <p className="mt-1.5 text-sm md:text-base text-slate-400 max-w-3xl">
            {description}
          </p>
        )}
      </div>
      {settings && <div className="shrink-0">{settings}</div>}
      {hasActions && (
        <div className="w-full md:w-auto flex flex-wrap items-center gap-2">
          {children}
        </div>
      )}
    </header>
  );
}
