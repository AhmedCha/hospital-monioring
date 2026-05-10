import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { format } from "date-fns";
import { Search, Download, AlertCircle, CheckCircle, Clock, UserCheck } from "lucide-react";

type EventType = "patient present" | "patient absent" | "unknown person detected" | "person recognized";
type Severity = "info" | "warning" | "alert";

export default function Events() {
  const { data: events, isLoading } = trpc.events.list.useQuery();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEventType, setFilterEventType] = useState<EventType | "all">("all");
  const [filterSeverity, setFilterSeverity] = useState<Severity | "all">("all");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const filteredEvents = events?.filter((event) => {
    const matchesSearch = searchTerm === "" || 
      event.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.roomId?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesEventType = filterEventType === "all" || event.eventType === filterEventType;
    const matchesSeverity = filterSeverity === "all" || event.severity === filterSeverity;

    const eventDate = new Date(event.timestamp);
    const matchesDateRange =
      (!startDate || eventDate >= startDate) &&
      (!endDate || eventDate <= endDate);

    return matchesSearch && matchesEventType && matchesSeverity && matchesDateRange;
  });

  const handleExportCSV = () => {
    if (!filteredEvents || filteredEvents.length === 0) return;
    
    const headers = ["Timestamp", "Event Type", "Severity", "Room", "Person ID", "Description"];
    const rows = filteredEvents.map((event) => [
      format(new Date(event.timestamp), "yyyy-MM-dd HH:mm:ss"),
      event.eventType,
      event.severity,
      event.roomId || "-",
      event.personId || "-",
      event.description || "-",
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `detection-events-${format(new Date(), "yyyy-MM-dd-HHmmss")}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const getSeverityColor = (severity: Severity) => {
    switch (severity) {
      case "info":
        return "bg-blue-100 text-blue-800";
      case "warning":
        return "bg-yellow-100 text-yellow-800";
      case "alert":
        return "bg-red-100 text-red-800";
    }
  };

  const getEventTypeIcon = (eventType: EventType) => {
    switch (eventType) {
      case "patient present":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "patient absent":
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case "unknown person detected":
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case "person recognized":
        return <UserCheck className="w-5 h-5 text-indigo-600" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activity Audit Log</h1>
          <p className="text-muted-foreground mt-1">
            Historical record of all recognition and presence events
          </p>
        </div>
        <Button
          onClick={handleExportCSV}
          disabled={!filteredEvents || filteredEvents.length === 0}
          className="gap-2 shadow-md"
        >
          <Download className="w-4 h-4" />
          Export Data
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Intelligent Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-2 lg:col-span-1">
              <Label className="text-xs uppercase font-bold text-slate-400">Search</Label>
              <Input
                placeholder="Room, Name, etc..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="space-y-2 lg:col-span-1">
              <Label className="text-xs uppercase font-bold text-slate-400">Event Type</Label>
              <Select value={filterEventType} onValueChange={(value: any) => setFilterEventType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="patient present">Patient Present</SelectItem>
                  <SelectItem value="patient absent">Patient Absent</SelectItem>
                  <SelectItem value="person recognized">Person Identified</SelectItem>
                  <SelectItem value="unknown person detected">Security Alert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 lg:col-span-1">
              <Label className="text-xs uppercase font-bold text-slate-400">Severity</Label>
              <Select value={filterSeverity} onValueChange={(value: any) => setFilterSeverity(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Severities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="alert">Alert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 lg:col-span-1">
              <Label className="text-xs uppercase font-bold text-slate-400">Date Range</Label>
              <DateRangeFilter
                onDateRangeChange={(start, end) => {
                  setStartDate(start);
                  setEndDate(end);
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg border-none">
        <CardHeader className="border-b bg-slate-50/50">
          <CardTitle className="text-lg flex items-center justify-between">
            Recent Activity
            {filteredEvents && (
              <Badge variant="outline" className="font-mono">
                {filteredEvents.length} RECORDS
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse"></div>
              ))}
            </div>
          ) : filteredEvents && filteredEvents.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {filteredEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                    {getEventTypeIcon(event.eventType as EventType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-bold text-slate-900 capitalize">{event.eventType}</p>
                      <Badge className={`${getSeverityColor(event.severity as Severity)} text-[10px] uppercase font-black tracking-widest`} variant="secondary">
                        {event.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500 font-medium">
                      {event.roomId ? `Room ${event.roomId}` : "General Area"}
                      {event.personId && ` • ID: ${event.personId}`}
                      {event.description && ` • ${event.description}`}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right pr-2">
                    <p className="text-sm font-bold text-slate-900">
                      {format(new Date(event.timestamp), "HH:mm:ss")}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                      {format(new Date(event.timestamp), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-slate-50/20">
              <Search className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-400">No activity records found</h3>
              <p className="text-slate-400 max-w-xs mx-auto mt-2">
                Adjust your filters or ensure the monitoring system is active.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
