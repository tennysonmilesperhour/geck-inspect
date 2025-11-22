import React from 'react';

const Progress = React.forwardRef(({ className = '', value = 0, colorClassName = '', ...props }, ref) => {
  const clampedValue = Math.max(0, Math.min(100, value || 0));
  
  return (
    <div
      ref={ref}
      className={`relative h-4 w-full overflow-hidden rounded-full bg-gray-200 ${className}`}
      {...props}
    >
      <div
        className={`h-full transition-all duration-300 ease-in-out ${
          colorClassName || 'bg-gradient-to-r from-blue-500 to-cyan-400'
        }`}
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  );
});

Progress.displayName = 'Progress';

export { Progress };