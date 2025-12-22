interface ProgressBarProps {
  progress: number;
}

export function ProgressBar({ progress }: ProgressBarProps) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center z-9999 text-white px-6">
      {/* Text + Progress % */}
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold mb-2">Analyzing Contract</h2>
        <p className="mt-2 text-xl">
          Processing obligations and extracting intelligence...
        </p>

        <div className="mt-4 text-2xl font-semibold text-slate-50">
          {progress}%
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-[50%] bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
        <div
          className="h-full transition-all duration-300 ease-out rounded-full bg-title-primary"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
}
