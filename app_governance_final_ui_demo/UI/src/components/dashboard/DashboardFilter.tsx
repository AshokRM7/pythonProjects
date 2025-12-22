import { Calendar, Clock, TrendingUp } from 'lucide-react';
import { CustomSelect } from './reusable/CustomSelect';
import { MultiSelectDropdown } from './reusable/MultiSelectDropdown';
import { TimelineSlider } from './TimelineSlider';

interface FilterOption {
    value: string;
    label: string;
}

interface DashboardFiltersProps {
    category: string[];
    setCategory: (value: string[]) => void;
    owner: string[]; // Changed to array
    setOwner: (value: string[]) => void; // Changed to array
    timeline: string;
    setTimeline: (value: string) => void;
    categoryOptions?: FilterOption[];
    ownerOptions?: FilterOption[];
}

export function DashboardFilters({
    category,
    setCategory,
    owner,
    setOwner,
    timeline,
    setTimeline,
    categoryOptions = [],
    ownerOptions = [],
}: DashboardFiltersProps) {

    return (
        <div className="flex gap-4 flex-wrap lg:items-end flex-grow lg:justify-end">
            <MultiSelectDropdown
                label="Category"
                options={categoryOptions}
                selectedValues={category}
                onChange={setCategory}
            />

            <MultiSelectDropdown
                label="Application Owner"
                options={ownerOptions}
                selectedValues={owner}
                onChange={setOwner}
            />

            <TimelineSlider value={timeline} onChange={setTimeline} />
        </div>
    );
}