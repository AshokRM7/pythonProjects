import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartVisible } from "../hooks/useChartVisible";

interface StatusItem {
  name: string;
  value: number;
  fill: string;
}

interface StatusBarChartProps {
  data: StatusItem[];
}

const StatusBarChart: React.FC<StatusBarChartProps> = ({ data }) => {
  const { ref, visible, count } = useChartVisible(0.4);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="backdrop-blur-md bg-white/90 text-gray-800 px-3 py-2 rounded-xl shadow-lg border border-white/40">
        <div className="flex items-center">
          <p className="text-lg font-semibold">{payload[0].value + "%"}</p>
          <p className="text-sm font-medium ml-2">{label}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="h-60 relative" ref={ref}>
      <ResponsiveContainer key={count}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 15, right: 45, left: 10, bottom: 20 }}
        >
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" hide />

          <Tooltip cursor={{ fill: "#f1f5f9" }} content={<CustomTooltip />} />

          <Bar
            dataKey="value"
            barSize={30}
            radius={[0, 10, 10, 0]}
            isAnimationActive={true}
            animationDuration={5000}
          >
            {data.map((item, index) => (
              <Cell key={index} fill={item.fill} />
            ))}
            {/* <LabelList position="center" fill="#fff" fontSize={12} /> */}
            {/* Name inside bar (left) with improved truncation */}
            <LabelList
              dataKey="name"
              content={(props) => {
                const { x = 0, y = 0, width = 0, height = 0, value } = props as any;

                // Use less padding to maximize space for text
                const availableWidth = width - 10;
                const charWidth = 8.5; // Refined estimate
                const maxChars = Math.floor(availableWidth / charWidth);

                let displayName = value;
                if (value.length > maxChars) {
                  if (maxChars >= 4) {
                    displayName = value.substring(0, maxChars - 3) + "...";
                  } else if (maxChars >= 2) {
                    displayName = value.substring(0, 1) + "..";
                  } else {
                    // Still too small to show anything meaningful
                    return null;
                  }
                }

                return (
                  <text
                    x={x + 8}
                    y={y + height / 2}
                    fill="#ffffff"
                    fontSize={14}
                    fontWeight={500}
                    dominantBaseline="middle"
                  >
                    {displayName}
                  </text>
                );
              }}
            />

            {/* Value + % outside at end of bar */}
            <LabelList
              dataKey="value"
              content={(props) => {
                const {
                  x = 0,
                  y = 0,
                  width = 0,
                  height = 0,
                  value,
                } = props as any;
                return (
                  <text
                    x={x + width + 8}
                    y={y + height / 2}
                    fill="#4b5563"
                    fontSize={15}
                    fontWeight={600}
                    textAnchor="start"
                    dominantBaseline="middle"
                  >
                    {value}%
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export { StatusBarChart };

