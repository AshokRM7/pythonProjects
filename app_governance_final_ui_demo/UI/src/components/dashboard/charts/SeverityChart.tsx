import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useChartVisible } from "../hooks/useChartVisible";

export const SeverityChart = ({ severityData }: any) => {
  const { ref, visible, count } = useChartVisible(0.4);

  return (
    <div className="h-60 relative mt-2" ref={ref}>
      <ResponsiveContainer key={count} width="100%" height={240}>
        <PieChart>
          <Pie
            data={severityData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={3}
            isAnimationActive={true}
            animationDuration={5000}
          >
            {severityData.map((entry: any, index: number) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>

          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              borderRadius: "8px",
              border: "none",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
          />

          <Legend
            verticalAlign="bottom"
            align="center"
            iconType="circle"
            wrapperStyle={{ paddingTop: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
