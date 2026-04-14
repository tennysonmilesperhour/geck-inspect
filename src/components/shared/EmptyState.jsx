import { Button } from "@/components/ui/button";

export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="text-center py-20 bg-slate-900 rounded-lg">
      {Icon && <Icon className="w-16 h-16 mx-auto text-slate-500 mb-4" />}
      <h3 className="text-xl font-semibold text-slate-300">{title}</h3>
      {message && <p className="text-slate-400 mt-2">{message}</p>}
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