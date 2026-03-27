type LoadingSpinnerProps = {
  message?: string;
  submessage?: string;
  size?: "sm" | "md" | "lg";
  fullScreen?: boolean;
};

export function LoadingSpinner({ 
  message = "Loading...", 
  submessage,
  size = "md",
  fullScreen = false 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-6 w-6 border-2",
    md: "h-10 w-10 border-4",
    lg: "h-16 w-16 border-4"
  };

  const textSizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl"
  };

  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className={`${sizeClasses[size]} animate-spin rounded-full border-solid border-indigo-500 border-r-transparent`}></div>
      <div className="text-center space-y-2">
        <div className={`${textSizeClasses[size]} font-medium text-white/90`}>{message}</div>
        {submessage && (
          <div className="text-sm text-white/60 animate-pulse">{submessage}</div>
        )}
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-[#0a0e1a] flex items-center justify-center z-50">
        {content}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">
      {content}
    </div>
  );
}
