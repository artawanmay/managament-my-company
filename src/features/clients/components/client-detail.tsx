/**
 * ClientDetail component
 * Requirements: 3.4
 */
import { Link } from "@tanstack/react-router";
import {
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Calendar,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ClientWithProjects, ClientStatus } from "../types";

interface ClientDetailProps {
  client: ClientWithProjects | null;
  isLoading?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

const statusColors: Record<ClientStatus, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  INACTIVE: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  PROSPECT: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
};

const projectStatusColors: Record<string, string> = {
  PLANNING:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  ON_HOLD:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  COMPLETED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  ARCHIVED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

export function ClientDetail({
  client,
  isLoading,
  onEdit,
  onDelete,
}: ClientDetailProps) {
  if (isLoading) {
    return <ClientDetailSkeleton />;
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">Client not found</p>
        <Button asChild variant="link" className="mt-4">
          <Link to="/app/clients">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Clients
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link to="/app/clients">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{client.name}</h1>
            <Badge
              className={statusColors[client.status as ClientStatus]}
              variant="outline"
            >
              {client.status}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {onEdit && (
            <Button variant="outline" onClick={onEdit}>
              Edit
            </Button>
          )}
          {onDelete && (
            <Button variant="destructive" onClick={onDelete}>
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Client Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Client Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {client.picName && (
              <div>
                <p className="text-sm text-muted-foreground">
                  Person in Charge
                </p>
                <p className="font-medium">{client.picName}</p>
              </div>
            )}

            {client.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a
                  href={`mailto:${client.email}`}
                  className="text-primary hover:underline"
                >
                  {client.email}
                </a>
              </div>
            )}

            {client.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${client.phone}`} className="hover:underline">
                  {client.phone}
                </a>
              </div>
            )}

            {client.website && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <a
                  href={client.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {client.website}
                </a>
              </div>
            )}

            {client.address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <p>{client.address}</p>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                Created{" "}
                {new Date(client.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        {client.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{client.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Projects */}
      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <CardDescription>
            {client.projects.length} project
            {client.projects.length !== 1 ? "s" : ""} associated with this
            client
          </CardDescription>
        </CardHeader>
        <CardContent>
          {client.projects.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No projects yet
            </p>
          ) : (
            <div className="space-y-3">
              {client.projects.map((project) => (
                <Link
                  key={project.id}
                  to={"/app/projects/$projectId" as const}
                  params={{ projectId: project.id }}
                  className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{project.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        className={
                          projectStatusColors[project.status] || "bg-gray-100"
                        }
                        variant="outline"
                      >
                        {project.status}
                      </Badge>
                      <Badge variant="outline">{project.priority}</Badge>
                    </div>
                  </div>
                  {project.endDate && (
                    <p className="text-sm text-muted-foreground">
                      Due: {new Date(project.endDate).toLocaleDateString()}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ClientDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-5 w-20 mt-2" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-20" />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
