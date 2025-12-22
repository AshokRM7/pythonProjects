import { useMemo, useState } from "react";
import { TrendAreaChart } from "./charts/TrendAreaChart";
import { TrendBarChart } from "./charts/TrendBarChart";
import { TrendLineChart } from "./charts/TrendLineChart";
import { Ticket } from "../../data/mockData";
import ChartContainer from "./reusable/ChartContainer";

interface TicketsTrendOverviewProps {
  minDays: number;
  maxDays: number;
  tickets: Ticket[];
}

export const TicketsTrendOverview = ({ minDays, maxDays, tickets }: TicketsTrendOverviewProps) => {
  const [chartType, setChartType] = useState<"area" | "line" | "bar">("area");

  const filteredTrendData = useMemo(() => {
    const data: any[] = [];
    const now = new Date();

    // Iterate from maxDays (oldest) to minDays (newest)
    for (let i = maxDays; i >= minDays; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateString = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });

      const dayTickets = tickets.filter(t => {
        const ticketDate = new Date(t.date);
        return ticketDate.getDate() === date.getDate() &&
          ticketDate.getMonth() === date.getMonth() &&
          ticketDate.getFullYear() === date.getFullYear();
      });

      const opened = dayTickets.length;
      const closed = dayTickets.filter(t => t.status === 'Closed').length;

      // Adjust backlog to be slightly equal to opened/closed
      // We use a base backlog around 80% of daily volume plus some random variance
      const backlogBase = Math.floor(opened * 0.9 + (Math.random() * 10 - 5));
      const backlog = Math.max(0, backlogBase + (opened - closed));

      data.push({
        date: dateString,
        opened,
        closed,
        backlog
      });
    }

    return data;
  }, [minDays, maxDays, tickets]);

  return (
    <div className="mt-3">
      <ChartContainer
        title="Tickets Trend Overview"
        subtitle={`Showing data for last ${maxDays} days`}
        actions={
          <div className="flex gap-3">
            {/* Chart Type Selection */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button
                className={`p-2 rounded-md transition-all duration-200 cursor-pointer ${chartType === "area"
                  ? "bg-white text-[#1e40af] shadow-sm"
                  : "text-gray-600 hover:text-[#1e40af]"
                  }`}
                onClick={() => setChartType("area")}
                title="Area Chart"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 12l3-3 3 3 4-4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16l3-3 3 3 4-4 6 2v2H4v-2z"
                    fill="currentColor"
                    fillOpacity="0.3"
                  />
                </svg>
              </button>
              <button
                className={`p-2 rounded-md transition-all duration-200 cursor-pointer ${chartType === "line"
                  ? "bg-white text-[#1e40af] shadow-sm"
                  : "text-gray-600 hover:text-[#1e40af]"
                  }`}
                onClick={() => setChartType("line")}
                title="Line Chart"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                  />
                </svg>
              </button>
              <button
                className={`p-2 rounded-md transition-all duration-200 cursor-pointer ${chartType === "bar"
                  ? "bg-white text-[#1e40af] shadow-sm"
                  : "text-gray-600 hover:text-[#1e40af]"
                  }`}
                onClick={() => setChartType("bar")}
                title="Bar Chart"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </button>
            </div>


            {/* Time Range Selection */}
            {/* <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                  selectedTrend === 7
                    ? "bg-white text-[#1e40af] shadow-sm"
                    : "text-gray-600 hover:text-[#1e40af]"
                }`}
                onClick={() => setSelectedTrend(7)}
              >
                7D
              </button>
              <button
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                  selectedTrend === 30
                    ? "bg-white text-[#1e40af] shadow-sm"
                    : "text-gray-600 hover:text-[#1e40af]"
                }`}
                onClick={() => setSelectedTrend(30)}
              >
                30D
              </button>
            </div> */}
          </div>
        }
      >
        {chartType === "area" && (
          <TrendAreaChart
            ticketData={filteredTrendData}
          />
        )}
        {chartType === "line" && (
          <TrendLineChart
            ticketData={filteredTrendData}
          />
        )}
        {chartType === "bar" && (
          <TrendBarChart
            ticketData={filteredTrendData}
          />
        )}

        {/* Trend Indicators */}
        {/* */}
      </ChartContainer>
    </div>
  );
};
