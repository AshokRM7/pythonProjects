import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartVisible } from "../hooks/useChartVisible";

export const TrendBarChart = ({ ticketData }: any) => {
  const { ref, count } = useChartVisible(0.4);

  return (
    <div className="h-50 w-full" ref={ref}>
      <ResponsiveContainer key={count}>
        <BarChart
          data={ticketData}
          margin={{ top: 16, right: 16, bottom: 8, left: 16 }}
        >
          <CartesianGrid
            vertical={false}
            horizontal={true}
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="date"
            padding={{ left: 20, right: 10 }}
            tick={{ fill: "#6b7280", fontSize: 14 }}
            axisLine={{ stroke: "#d1d5db", strokeWidth: 1 }}
          />

          <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />

          <Bar
            dataKey="opened"
            fill="#1e40af"
            radius={[4, 4, 0, 0]}
            isAnimationActive={true}
            animationDuration={5000}
          />
          <Bar
            dataKey="closed"
            fill="#059669"
            radius={[4, 4, 0, 0]}
            isAnimationActive={true}
            animationDuration={5000}
            animationBegin={500}
          />
          <Bar
            dataKey="backlog"
            fill="#d97706"
            radius={[4, 4, 0, 0]}
            isAnimationActive={true}
            animationDuration={5000}
            animationBegin={1000}
          />
          <Tooltip
            cursor={false}
            contentStyle={{
              backgroundColor: "#fff",
              borderRadius: "8px",
              border: "none",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
              padding: "8px 12px",
            }}
            labelStyle={{ color: "#6b7280", fontWeight: 500 }}
            itemStyle={{ color: "#111827" }}
          />

          <Legend />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
