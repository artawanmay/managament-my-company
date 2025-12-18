/**
 * ProjectDetail component with tabs
 * Requirements: 4.3, 10.2
 */
import { Calendar, Building2, User, Clock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectMembers } from "./project-members";
import { ActivityFeed, useProjectActivity } from "@/features/activity";
import type {
  ProjectWithDetails,
  ProjectMemberRole,
  ProjectStatus,
  Priority,
} from "../types";

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface ProjectDetailProps {
  project: ProjectWithDetails | null;
  availableUsers: UserOption[];
  onAddMember: (userId: string, role: ProjectMemberRole) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  isLoading?: boolean;
}

const statusColors: Record<ProjectStatus, string> = {
  PLANNING: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  ON_HOLD:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  COMPLETED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  ARCHIVED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const priorityColors: Record<Priority, string> = {
  LOW: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  MEDIUM: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  URGENT: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

function formatDate(timestamp: number | null): string {
  if (!timestamp) return "Not set";
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ProjectDetail({
  project,
  availableUsers,
  onAddMember,
  onRemoveMember,
  isLoading,
}: ProjectDetailProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.description && (
            <p className="mt-1 text-muted-foreground">{project.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Badge className={statusColors[project.status]} variant="outline">
            {project.status.replace("_", " ")}
          </Badge>
          <Badge className={priorityColors[project.priority]} variant="outline">
            {project.priority}
          </Badge>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Client</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {project.clientName || "N/A"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Manager</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {project.managerName || "N/A"}
            </div>
            {project.managerEmail && (
              <p className="text-xs text-muted-foreground">
                {project.managerEmail}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Start Date</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {formatDate(project.startDate)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">End Date</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {formatDate(project.endDate)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Navigation */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link
            to="/app/projects/$projectId/board"
            params={{ projectId: project.id }}
          >
            Kanban Board
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link
            to="/app/projects/$projectId/tasks"
            params={{ projectId: project.id }}
          >
            Tasks
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link
            to="/app/projects/$projectId/files"
            params={{ projectId: project.id }}
          >
            Files
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link
            to="/app/projects/$projectId/notes"
            params={{ projectId: project.id }}
          >
            Notes
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">
            Members ({project.members.length})
          </TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
              <CardDescription>
                Overview of the project information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Status
                  </h4>
                  <p className="mt-1">{project.status.replace("_", " ")}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Priority
                  </h4>
                  <p className="mt-1">{project.priority}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Created
                  </h4>
                  <p className="mt-1">{formatDate(project.createdAt)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Last Updated
                  </h4>
                  <p className="mt-1">{formatDate(project.updatedAt)}</p>
                </div>
              </div>
              {project.description && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Description
                  </h4>
                  <p className="mt-1 whitespace-pre-wrap">
                    {project.description}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardContent className="pt-6">
              <ProjectMembers
                members={project.members}
                availableUsers={availableUsers}
                canManage={project.canManage}
                onAddMember={onAddMember}
                onRemoveMember={onRemoveMember}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <ProjectActivityTab projectId={project.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Project Activity Tab component
 * Requirement 10.2: Display chronological activity for a project
 */
function ProjectActivityTab({ projectId }: { projectId: string }) {
  const { data, isLoading } = useProjectActivity(projectId, { limit: 50 });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Log</CardTitle>
        <CardDescription>Recent activity in this project</CardDescription>
      </CardHeader>
      <CardContent>
        <ActivityFeed
          activities={data?.data || []}
          isLoading={isLoading}
          hasMore={data?.pagination.hasMore}
          emptyMessage="No activity recorded for this project yet"
          maxHeight="500px"
        />
      </CardContent>
    </Card>
  );
}
