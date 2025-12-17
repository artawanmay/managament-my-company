/**
 * Dashboard Page
 * Displays summary statistics and charts for the application
 *
 * Requirements:
 * - 15.1: Display summary cards for active clients, projects by status, tasks by status, and overdue tasks
 * - 15.2: Show tasks by status distribution and overdue tasks per project
 */
import { createFileRoute } from "@tanstack/react-router";
import { Users, FolderKanban, CheckSquare, AlertTriangle } from "lucide-react";
import {
  useDashboard,
  StatCard,
  TaskStatusChart,
  OverdueChart,
  ProjectStatusChart,
} from "@/features/dashboard";

export const Route = createFileRoute("/app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isLoading, error } = useDashboard();

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome to MMC - Management My Company
          </p>
        </div>
        <div className="rounded-lg border bg-destructive/10 p-6 text-destructive">
          Failed to load dashboard data. Please try again later.
        </div>
      </div>
    );
  }

  // Calculate open tasks (not done)
  const openTasks = data ? data.tasks.total - data.tasks.done : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to MMC - Management My Company
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Clients"
          value={data?.clients.active ?? 0}
          description={`${data?.clients.total ?? 0} total clients`}
          icon={Users}
          isLoading={isLoading}
        />
        <StatCard
          title="Active Projects"
          value={data?.projects.active ?? 0}
          description={`${data?.projects.total ?? 0} total projects`}
          icon={FolderKanban}
          isLoading={isLoading}
        />
        <StatCard
          title="Open Tasks"
          value={openTasks}
          description={`${data?.tasks.total ?? 0} total tasks`}
          icon={CheckSquare}
          isLoading={isLoading}
        />
        <StatCard
          title="Overdue Tasks"
          value={data?.overdue.total ?? 0}
          description={
            data?.overdue.total ? "Requires attention" : "All on track"
          }
          icon={AlertTriangle}
          isLoading={isLoading}
          className={data?.overdue.total ? "border-destructive/50" : ""}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <TaskStatusChart data={data?.tasks} isLoading={isLoading} />
        <ProjectStatusChart data={data?.projects} isLoading={isLoading} />
      </div>

      {/* Overdue Tasks Chart */}
      <div className="grid gap-4">
        <OverdueChart data={data?.overdue} isLoading={isLoading} />
      </div>
    </div>
  );
}
