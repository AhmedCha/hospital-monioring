import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { AlertCircle, Bell, CheckCircle, Search } from "lucide-react";

export default function Alerts() {
  const { data: alerts, isLoading } = trpc.alerts.list.useQuery();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSeverity, setFilterSeverity] = useState<"all" | "info" | "warning" | "alert">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "resolved">("active");

  const filteredAlerts = alerts?.filter((alert) => {
    const matchesSearch = searchTerm === "" ||
      alert.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.roomId?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSeverity = filterSeverity === "all" || alert.severity === filterSeverity;

    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && !alert.isResolved) ||
      (filterStatus === "resolved" && alert.isResolved);

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const unreadCount = alerts?.filter((a) => !a.isResolved).length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Alerts & Notifications</h1>
        <p className="text-muted-foreground mt-2">Critical events and owner notifications</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{unreadCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Requiring attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unknown Persons</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {alerts?.filter((a) => a.alertType === "unknown person detected").length || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Detected</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Patients Missing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {alerts?.filter((a) => a.alertType === "patient missing").length || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Incidents</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter Alerts</CardTitle>
          <CardDescription>Search and filter alerts by severity and status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap items-center">
            <div className="flex-1 min-w-64">
              <Input
                placeholder="Search alerts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSeverity} onValueChange={(value: any) => setFilterSeverity(value)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="alert">Alert</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Alert History
            {filteredAlerts && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({filteredAlerts.length} alerts)
              </span>
            )}
          </CardTitle>
          <CardDescription>All critical alerts sent to owner</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-muted rounded animate-pulse"></div>
              ))}
            </div>
          ) : filteredAlerts && filteredAlerts.length > 0 ? (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border-l-4 transition-colors ${alert.isResolved
                    ? "bg-gray-50 border-l-gray-300"
                    : alert.severity === "alert"
                      ? "bg-red-50 border-l-red-500"
                      : alert.severity === "info"
                        ? "bg-blue-50 border-l-blue-500"
                        : "bg-yellow-50 border-l-yellow-500"
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {alert.isResolved ? (
                        <CheckCircle className="w-5 h-5 text-gray-500" />
                      ) : (
                        <AlertCircle className={`w-5 h-5 ${alert.severity === "alert" ? "text-red-600" : alert.severity === "info" ? "text-blue-600" : "text-yellow-600"}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">
                          {alert.title || (alert.alertType === "unknown person detected" ? "Unknown Person Detected" : alert.alertType === "person recognized" ? "Known Person Logs" : "Patient Missing")}
                        </h3>
                        <Badge
                          className={
                            alert.severity === "alert"
                              ? "bg-red-100 text-red-800"
                              : alert.severity === "info"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-yellow-100 text-yellow-800"
                          }
                          variant="secondary"
                        >
                          {alert.severity}
                        </Badge>
                        {alert.isResolved && (
                          <Badge variant="outline" className="bg-gray-100">
                            Resolved
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {alert.message || (alert.alertType === "unknown person detected"
                          ? "An unknown person was detected in a monitored room"
                          : alert.alertType === "person recognized"
                            ? "A known person has been detected in a monitored room"
                            : "A patient was not detected in their monitored room")}
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(alert.createdAt), "MMM d, yyyy HH:mm:ss")}
                        </p>
                        {alert.isResolved && alert.resolvedAt && (
                          <p className="text-xs text-muted-foreground">
                            Resolved: {format(new Date(alert.resolvedAt), "HH:mm:ss")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">No alerts found</p>
              <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or search criteria</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
