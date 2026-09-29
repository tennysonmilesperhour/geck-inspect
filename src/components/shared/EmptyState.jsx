import { Button } from "@/components/ui/button";

export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="text-center px-4 py-12 md:py-20 bg-slate-900 border border-slate-700 rounded-xl">
      {Icon && <Icon className="w-12 h-12 md:w-16 md:h-16 mx-auto text-slate-500 mb-4" />}
      <h3 className="text-lg md:text-xl font-semibold text-slate-300">{title}</h3>
      {message && <p className="text-sm md:text-base text-slate-400 mt-2 max-w-md mx-auto">{message}</p>}
      {action && (
        <Button
          onClick={action.onClick}
          className="mt-6"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
