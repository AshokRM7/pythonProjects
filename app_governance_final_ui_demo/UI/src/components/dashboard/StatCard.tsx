interface StatCardProps {
  title: string;
  count: string | number;
  gradient: string;
  icon: React.ReactNode;
  isIncrease?: boolean;
  percentageChange?: string | number;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  count,
  gradient,
  icon,
  isIncrease = true,
  percentageChange,
}) => {
  return (
    <div
      className={`
              ${gradient.includes('bg-linear') || gradient.includes('bg-blue-600') ? `bg-linear-to-br ${gradient} text-white` : `${gradient} text-gray-800`}
              rounded-xl p-4 shadow-lg
              hover:shadow-xl transition-shadow
              flex flex-col h-full`}
    >
      {/* Top section */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-medium leading-snug">{title}</h3>
        <div className="text-2xl bg-white/20 p-1 rounded-md shrink-0">
          {icon}
        </div>
      </div>

      {/* Bottom section pinned to bottom */}
      <div className="mt-auto flex items-end justify-between pt-4">
        <p className="text-3xl xl:text-4xl font-semibold">{count}</p>

        {percentageChange !== undefined && (
          <div
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-xl text-xs font-semibold
          bg-white backdrop-blur
          ${isIncrease ? "text-green-600" : "text-red-600"}`}
          >
            <span>{isIncrease ? "▲" : "▼"}</span>
            <span>{percentageChange}%</span>
          </div>
        )}
      </div>
    </div>
  );
};

export { StatCard };

