import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartVisible } from "../hooks/useChartVisible";

export const TrendAreaChart = ({ ticketData }: any) => {
  const { ref, count } = useChartVisible(0.4);

  return (
    <div className="h-50 w-full" ref={ref}>
      <ResponsiveContainer key={count}>
        <AreaChart
          data={ticketData}
          margin={{ top: 16, right: 16, bottom: 8, left: 16 }}
        >
          <defs>
            <linearGradient id="colorOpened" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e40af" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#1e40af" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorClosed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#059669" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorBacklog" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d97706" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
            </linearGradient>
          </defs>
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

          <Area
            type="monotone"
            dataKey="opened"
            stroke="#1e40af"
            fill="url(#colorOpened)"
            strokeWidth={2}
            isAnimationActive={true}
            animationDuration={5000}
          />
          <Area
            type="monotone"
            dataKey="closed"
            stroke="#059669"
            fill="url(#colorClosed)"
            strokeWidth={2}
            isAnimationActive={true}
            animationDuration={5000}
            animationBegin={500}
          />
          <Area
            type="monotone"
            dataKey="backlog"
            stroke="#d97706"
            fill="url(#colorBacklog)"
            strokeWidth={2}
            isAnimationActive={true}
            animationDuration={5000}
            animationBegin={1000}
          />
          <Tooltip
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
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
