/**
 * ProjectStatusChart Component
 * A bar chart showing project distribution by status
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { ProjectCounts } from "../types";

interface ProjectStatusChartProps {
  data: ProjectCounts | undefined;
  isLoading?: boolean;
}

const COLORS = {
  planning: "#94a3b8", // slate-400
  active: "#22c55e", // green-500
  onHold: "#fbbf24", // amber-400
  completed: "#3b82f6", // blue-500
  archived: "#6b7280", // gray-500
};

const STATUS_LABELS = {
  planning: "Planning",
  active: "Active",
  onHold: "On Hold",
  completed: "Completed",
  archived: "Archived",
};

export function ProjectStatusChart({
  data,
  isLoading,
}: ProjectStatusChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Projects by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Projects by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No projects to display
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    {
      name: STATUS_LABELS.planning,
      value: data.planning,
      color: COLORS.planning,
    },
    { name: STATUS_LABELS.active, value: data.active, color: COLORS.active },
    { name: STATUS_LABELS.onHold, value: data.onHold, color: COLORS.onHold },
    {
      name: STATUS_LABELS.completed,
      value: data.completed,
      color: COLORS.completed,
    },
    {
      name: STATUS_LABELS.archived,
      value: data.archived,
      color: COLORS.archived,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Projects by Status</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis allowDecimals={false} />
            <Tooltip
              formatter={(value) => [value as number, "Projects"]}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={50}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
