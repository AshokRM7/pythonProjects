interface ChartContainerProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  subtitle,
  children,
  actions,
}) => {
  return (
    <div className="bg-white border border-purple-200 rounded-xl p-4 shadow-md hover:shadow-xl transition-shadow h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-medium text-gray-800">{title}</h3>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        {/* Toggle buttons */}
        <div>{actions}</div>
      </div>
      <div className="w-full flex-1 mt-2 hover:bg-white/40 transition-all duration-300 relative flex flex-col">
        {children}
      </div>
    </div>
  );
};

export default ChartContainer;
