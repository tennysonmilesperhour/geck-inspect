import React from "react";
import { Loader2 } from "lucide-react";

const sizeClasses = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-12 h-12",
};

export default function LoadingSpinner({ size = "lg", message }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <Loader2 className={`${sizeClasses[size]} text-emerald-500 animate-spin`} />
      {message && <p className="text-slate-400 text-sm">{message}</p>}
    </div>
  );
}