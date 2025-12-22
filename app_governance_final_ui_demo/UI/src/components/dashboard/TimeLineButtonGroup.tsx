
interface TimelineButtonGroupProps {
    value: string;
    onChange: (value: string) => void;
    timeLineOptions: { value: string; label: string; icon: any }[];
}

export function TimelineButtonGroup({ value, onChange, timeLineOptions }: TimelineButtonGroupProps) {


    return (
        <div className="min-w-fit">
            <label className="block text-gray-700 mb-2 text-sm">
                Timeline
            </label>

            <div className="flex gap-2">
                {timeLineOptions.map((option) => {
                    const isSelected = value === option.value;
                    const Icon = option.icon;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => onChange(option.value)}
                            className={`flex items-center gap-2 px-2 py-2.5 rounded-lg border-2 transition-all duration-200 cursor-pointer ${isSelected
                                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30'
                                : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:shadow-md'
                                }`}
                        >
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-gray-500'}`} />
                            <span className={isSelected ? 'font-medium' : ''}>{option.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}