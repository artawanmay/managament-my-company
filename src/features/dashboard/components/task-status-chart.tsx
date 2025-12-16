/**
 * TaskStatusChart Component
 * A pie chart showing task distribution by status
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import type { TaskCounts } from '../types';

interface TaskStatusChartProps {
  data: TaskCounts | undefined;
  isLoading?: boolean;
}

const COLORS = {
  backlog: '#94a3b8', // slate-400
  todo: '#60a5fa', // blue-400
  inProgress: '#fbbf24', // amber-400
  inReview: '#a78bfa', // violet-400
  changesRequested: '#f97316', // orange-500
  done: '#22c55e', // green-500
};

const STATUS_LABELS = {
  backlog: 'Backlog',
  todo: 'To Do',
  inProgress: 'In Progress',
  inReview: 'In Review',
  changesRequested: 'Changes Requested',
  done: 'Done',
};

export function TaskStatusChart({ data, isLoading }: TaskStatusChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Task Distribution</CardTitle>
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
          <CardTitle>Task Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No tasks to display
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    { name: STATUS_LABELS.backlog, value: data.backlog, color: COLORS.backlog },
    { name: STATUS_LABELS.todo, value: data.todo, color: COLORS.todo },
    { name: STATUS_LABELS.inProgress, value: data.inProgress, color: COLORS.inProgress },
    { name: STATUS_LABELS.inReview, value: data.inReview, color: COLORS.inReview },
    { name: STATUS_LABELS.changesRequested, value: data.changesRequested, color: COLORS.changesRequested },
    { name: STATUS_LABELS.done, value: data.done, color: COLORS.done },
  ].filter((item) => item.value > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Task Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }) =>
                `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
              }
              labelLine={false}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [value as number, 'Tasks']}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
