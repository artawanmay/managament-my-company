/**
 * OverdueChart Component
 * A bar chart showing overdue tasks per project
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { OverdueCounts } from '../types';

interface OverdueChartProps {
  data: OverdueCounts | undefined;
  isLoading?: boolean;
}

export function OverdueChart({ data, isLoading }: OverdueChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Overdue Tasks by Project</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.byProject.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Overdue Tasks by Project</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No overdue tasks
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.byProject.map((item) => ({
    name: item.projectName.length > 15 
      ? item.projectName.substring(0, 15) + '...' 
      : item.projectName,
    fullName: item.projectName,
    overdue: item.count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Overdue Tasks by Project</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis 
              type="category" 
              dataKey="name" 
              width={100}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              formatter={(value) => [value as number, 'Overdue Tasks']}
              labelFormatter={(label, payload) => {
                if (payload && payload[0]) {
                  return payload[0].payload.fullName;
                }
                return label;
              }}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Bar 
              dataKey="overdue" 
              fill="#ef4444" 
              radius={[0, 4, 4, 0]}
              maxBarSize={30}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
