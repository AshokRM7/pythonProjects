import { MultiSelectDropdown, FilterOption } from './reusable/MultiSelectDropdown';
import { TimelineSlider } from './TimelineSlider';

interface DashboardFiltersProps {
    category: string[];
    setCategory: (value: string[]) => void;
    owner: string[]; // Changed to array
    setOwner: (value: string[]) => void; // Changed to array
    timeline: string;
    setTimeline: (value: string) => void;
    pastDueOptions: string[];
    setPastDueOptions: (value: string[]) => void;
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
    pastDueOptions,
    setPastDueOptions,
    categoryOptions = [],
    ownerOptions = [],
}: DashboardFiltersProps) {

    const pastDueFilterOptions = [
        { value: 'all', label: 'All Statuses' },
        { value: 'past_due', label: 'Past Due' },
        { value: 'past_due_10', label: 'Past Due > 10 Days' },
        { value: 'past_due_30', label: 'Past Due > 30 Days' },
    ];

    return (
        <div className="flex gap-4 flex-wrap flex-grow lg:justify-end">
            <TimelineSlider
                value={timeline}
                onChange={setTimeline}
            />

            <MultiSelectDropdown
                label="Status / Deadlines"
                options={pastDueFilterOptions}
                selectedValues={pastDueOptions}
                onChange={setPastDueOptions}
            />

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

        </div>
    );
}