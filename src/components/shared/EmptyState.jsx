import { Button } from "@/components/ui/button";

// Empty states teach the next step: one primary action, an optional
// secondary one (for example "Import a spreadsheet" next to "Add your
// first gecko") and an optional hint line under the buttons.
export default function EmptyState({ icon: Icon, title, message, action, secondaryAction, hint }) {
  return (
    <div className="text-center px-4 py-12 md:py-20 bg-slate-900 border border-slate-700 rounded-xl">
      {Icon && <Icon className="w-12 h-12 md:w-16 md:h-16 mx-auto text-slate-500 mb-4" aria-hidden="true" />}
      <h3 className="text-lg md:text-xl font-semibold text-slate-200">{title}</h3>
      {message && <p className="text-sm md:text-base text-slate-400 mt-2 max-w-md mx-auto">{message}</p>}
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2">
          {action && (
            <Button onClick={action.onClick} className="min-h-11">
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="outline"
              onClick={secondaryAction.onClick}
              className="min-h-11 border-slate-600 bg-slate-900/60 text-slate-100 hover:bg-slate-800"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
      {hint && <p className="text-xs text-slate-400 mt-4 max-w-md mx-auto">{hint}</p>}
    </div>
  );
}
