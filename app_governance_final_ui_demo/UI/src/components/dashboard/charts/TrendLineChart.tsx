import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartVisible } from "../hooks/useChartVisible";

export const TrendLineChart = ({ ticketData }: any) => {
  const { ref, count } = useChartVisible(0.4);

  return (
    <div className="h-50 w-full" ref={ref}>
      <ResponsiveContainer key={count}>
        <LineChart
          data={ticketData}
          margin={{ top: 16, right: 16, bottom: 8, left: 16 }}
        >
          <CartesianGrid
            vertical={false}
            horizontal={true}
            strokeDasharray="3 3" // optional dashed lines
          />
          <XAxis
            dataKey="date"
            padding={{ left: 20, right: 10 }}
            tick={{ fill: "#6b7280", fontSize: 14 }}
            axisLine={{ stroke: "#d1d5db", strokeWidth: 1 }}
          />

          <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />

          <Line
            type="linear"
            dataKey="opened"
            stroke="#1e40af" // Navy blue
            strokeWidth={2}
            activeDot={{ r: 4 }}
            isAnimationActive={true}
            animationDuration={5000}
          />
          <Line
            type="linear"
            dataKey="closed"
            stroke="#059669" // Emerald green
            strokeWidth={2}
            isAnimationActive={true}
            animationDuration={5000}
            animationBegin={500}
          />
          <Line
            type="linear"
            dataKey="backlog"
            stroke="#d97706" // Amber
            strokeWidth={2}
            isAnimationActive={true}
            animationDuration={5000}
            animationBegin={1000}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff", // white background
              borderRadius: "8px",
              border: "none",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)", // proper shadow
              padding: "8px 12px",
            }}
            labelStyle={{ color: "#6b7280", fontWeight: 500 }} // label color
            itemStyle={{ color: "#111827" }} // value color
          />

          <Legend />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
