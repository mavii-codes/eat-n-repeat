"use client";

import { useMemo, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminPanel,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/AdminForm";
import { AdminModal } from "@/components/admin/AdminModal";
import { useAdminData } from "@/context/AdminDataContext";
import type { AttendanceRecord, AttendanceStatus } from "@/lib/admin/types";

type PeriodSummary = {
  staffId: string;
  staffName: string;
  position: string;
  period: string; // e.g. "2026-07-13 to 2026-07-19" or "July 2026"
  presentCount: number;
  lateCount: number;
  excusedCount: number;
  absentCount: number;
  totalHours: number;
};

const emptyForm = {
  staffId: "",
  date: new Date().toLocaleDateString("en-CA"),
  timeIn: "08:00 AM",
  timeOut: "05:00 PM",
  status: "Present" as AttendanceStatus,
  reason: "",
};

function getWeekRange(dateStr: string): { start: string; end: string; label: string } {
  // Parse in local time format YYYY-MM-DD
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  const dayOfWeek = d.getDay(); // 0 Sunday, 1 Monday...
  const diffToMonday = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diffToMonday));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const pad = (n: number) => String(n).padStart(2, "0");
  const startStr = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
  const endStr = `${sunday.getFullYear()}-${pad(sunday.getMonth() + 1)}-${pad(sunday.getDate())}`;
  return {
    start: startStr,
    end: endStr,
    label: `${startStr} to ${endStr}`,
  };
}

function getMonthLabel(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function AdminAttendancePage() {
  const {
    attendanceRecords,
    staffAccounts,
    addAttendanceRecord,
    updateAttendanceRecord,
    deleteAttendanceRecord,
  } = useAdminData();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AttendanceRecord | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [searchStaff, setSearchStaff] = useState("");
  const [filterDate, setFilterDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [viewTab, setViewTab] = useState<"daily" | "weekly" | "monthly">("daily");

  const todayStr = useMemo(() => new Date().toLocaleDateString("en-CA"), []);

  // Exclude admin accounts from staff attendance logs
  const activeStaff = useMemo(() => {
    return staffAccounts.filter((acc) => !acc.archived && acc.role !== "admin");
  }, [staffAccounts]);

  const filteredRecords = useMemo(() => {
    return attendanceRecords
      .filter((r) => {
        const matchesSearch = r.staffName.toLowerCase().includes(searchStaff.toLowerCase());
        const matchesDate = filterDate ? r.date === filterDate : true;
        return matchesSearch && matchesDate;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || a.staffName.localeCompare(b.staffName));
  }, [attendanceRecords, searchStaff, filterDate]);

  // Weekly Aggregation summaries
  const weeklySummaries = useMemo(() => {
    const groups: { [key: string]: PeriodSummary } = {};

    attendanceRecords.forEach((record) => {
      const staffAccount = staffAccounts.find((s) => s.id === record.staffId);
      const position = staffAccount ? (staffAccount.role === "head_staff" ? "Head Staff" : "Staff") : "Staff";
      
      let weekLabel = "Unknown Period";
      try {
        weekLabel = getWeekRange(record.date).label;
      } catch (e) {
        console.error(e);
      }

      const key = `${record.staffId}_${weekLabel}`;

      if (!groups[key]) {
        groups[key] = {
          staffId: record.staffId,
          staffName: record.staffName,
          position,
          period: weekLabel,
          presentCount: 0,
          lateCount: 0,
          excusedCount: 0,
          absentCount: 0,
          totalHours: 0,
        };
      }

      if (record.status === "Present") groups[key].presentCount++;
      else if (record.status === "Late") groups[key].lateCount++;
      else if (record.status === "Excused") groups[key].excusedCount++;
      else if (record.status === "Absent") groups[key].absentCount++;

      if (record.totalHours) {
        groups[key].totalHours = Number((groups[key].totalHours + record.totalHours).toFixed(2));
      }
    });

    return Object.values(groups).sort((a, b) => b.period.localeCompare(a.period) || a.staffName.localeCompare(b.staffName));
  }, [attendanceRecords, staffAccounts]);

  const filteredWeeklySummaries = useMemo(() => {
    return weeklySummaries.filter((s) => s.staffName.toLowerCase().includes(searchStaff.toLowerCase()));
  }, [weeklySummaries, searchStaff]);

  // Monthly Aggregation summaries
  const monthlySummaries = useMemo(() => {
    const groups: { [key: string]: PeriodSummary } = {};

    attendanceRecords.forEach((record) => {
      const staffAccount = staffAccounts.find((s) => s.id === record.staffId);
      const position = staffAccount ? (staffAccount.role === "head_staff" ? "Head Staff" : "Staff") : "Staff";

      let monthLabel = "Unknown Month";
      try {
        monthLabel = getMonthLabel(record.date);
      } catch (e) {
        console.error(e);
      }

      const key = `${record.staffId}_${monthLabel}`;

      if (!groups[key]) {
        groups[key] = {
          staffId: record.staffId,
          staffName: record.staffName,
          position,
          period: monthLabel,
          presentCount: 0,
          lateCount: 0,
          excusedCount: 0,
          absentCount: 0,
          totalHours: 0,
        };
      }

      if (record.status === "Present") groups[key].presentCount++;
      else if (record.status === "Late") groups[key].lateCount++;
      else if (record.status === "Excused") groups[key].excusedCount++;
      else if (record.status === "Absent") groups[key].absentCount++;

      if (record.totalHours) {
        groups[key].totalHours = Number((groups[key].totalHours + record.totalHours).toFixed(2));
      }
    });

    return Object.values(groups).sort((a, b) => b.period.localeCompare(a.period) || a.staffName.localeCompare(b.staffName));
  }, [attendanceRecords, staffAccounts]);

  const filteredMonthlySummaries = useMemo(() => {
    return monthlySummaries.filter((s) => s.staffName.toLowerCase().includes(searchStaff.toLowerCase()));
  }, [monthlySummaries, searchStaff]);

  // Statistics calculations
  const stats = useMemo(() => {
    const todayLogs = attendanceRecords.filter((r) => r.date === todayStr);
    const present = todayLogs.filter((r) => r.status === "Present").length;
    const late = todayLogs.filter((r) => r.status === "Late").length;
    const excused = todayLogs.filter((r) => r.status === "Excused").length;
    const absent = activeStaff.filter(
      (s) => !attendanceRecords.some((r) => r.staffId === s.id && r.date === todayStr)
    ).length;

    return {
      present,
      late,
      excused,
      absent,
    };
  }, [attendanceRecords, activeStaff, todayStr]);

  function openCreate() {
    setEditing(null);
    setForm({
      staffId: activeStaff[0]?.id || "",
      date: new Date().toLocaleDateString("en-CA"),
      timeIn: "08:00 AM",
      timeOut: "05:00 PM",
      status: "Present",
      reason: "",
    });
    setOpen(true);
  }

  function openEdit(record: AttendanceRecord) {
    setEditing(record);
    setForm({
      staffId: record.staffId,
      date: record.date,
      timeIn: record.timeIn || "",
      timeOut: record.timeOut || "",
      status: record.status,
      reason: record.reason || "",
    });
    setOpen(true);
  }

  function handleSubmit() {
    if (!form.staffId || !form.date) {
      alert("Please select a staff member and date.");
      return;
    }

    const selectedStaff = staffAccounts.find((s) => s.id === form.staffId);
    if (!selectedStaff) return;

    let computedHours: number | undefined = undefined;
    if (form.timeIn && form.timeOut && (form.status === "Present" || form.status === "Late")) {
      try {
        const parseTime = (timeStr: string, dateStr: string) => {
          const [t, modifier] = timeStr.split(" ");
          let [hoursVal, minutesVal] = t.split(":").map(Number);
          if (modifier === "PM" && hoursVal < 12) hoursVal += 12;
          if (modifier === "AM" && hoursVal === 12) hoursVal = 0;
          return new Date(`${dateStr}T${String(hoursVal).padStart(2, "0")}:${String(minutesVal).padStart(2, "0")}:00`);
        };
        const inD = parseTime(form.timeIn, form.date);
        const outD = parseTime(form.timeOut, form.date);
        const diff = outD.getTime() - inD.getTime();
        if (diff > 0) {
          computedHours = Number((diff / (1000 * 60 * 60)).toFixed(2));
        }
      } catch (e) {
        console.error("Hours calculation error:", e);
      }
    }

    const payload = {
      staffId: form.staffId,
      staffName: selectedStaff.name,
      date: form.date,
      timeIn: (form.status === "Present" || form.status === "Late") ? form.timeIn : undefined,
      timeOut: (form.status === "Present" || form.status === "Late") ? form.timeOut : undefined,
      status: form.status,
      reason: form.status === "Excused" ? form.reason : undefined,
      totalHours: computedHours,
    };

    if (editing) {
      updateAttendanceRecord(editing.id, payload);
    } else {
      addAttendanceRecord(payload);
    }
    setOpen(false);
  }

  function handleDelete(record: AttendanceRecord) {
    if (confirm(`Are you sure you want to delete the attendance log for ${record.staffName} on ${record.date}?`)) {
      deleteAttendanceRecord(record.id);
    }
  }

  function handleExportCSV() {
    const headers = ["Staff Member", "Position", "Date", "Time In", "Time Out", "Total Hours", "Status", "Reason"];
    
    const rows = attendanceRecords.map((record) => {
      const staffAccount = staffAccounts.find((s) => s.id === record.staffId);
      const position = staffAccount ? (staffAccount.role === "head_staff" ? "Head Staff" : "Staff") : "Staff";
      return [
        `"${record.staffName}"`,
        `"${position}"`,
        `"${record.date}"`,
        `"${record.timeIn || ""}"`,
        `"${record.timeOut || ""}"`,
        `"${record.totalHours || ""}"`,
        `"${record.status}"`,
        `"${record.reason || ""}"`,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `staff_attendance_report_${new Date().toLocaleDateString("en-CA")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <>
      <AdminPageHeader
        badge="Monitoring"
        title="Staff Attendance"
        subtitle="Review time in, time out, and manage daily attendance sheets."
      />

      {/* Attendance Stats Overview */}
      <section className="mb-5 grid gap-5 sm:grid-cols-4">
        <div className="admin-stat-card rounded-2xl p-5 pl-6">
          <p className="text-sm font-medium text-muted">Present Today</p>
          <p className="mt-3 font-serif text-3xl font-semibold text-[#800000]">{stats.present}</p>
          <p className="text-xs text-muted mt-1">Clocked in on time</p>
        </div>
        <div className="admin-stat-card rounded-2xl p-5 pl-6">
          <p className="text-sm font-medium text-muted">Late Today</p>
          <p className="mt-3 font-serif text-3xl font-semibold text-amber-600">{stats.late}</p>
          <p className="text-xs text-muted mt-1">Clocked in past 08:30 AM</p>
        </div>
        <div className="admin-stat-card rounded-2xl p-5 pl-6">
          <p className="text-sm font-medium text-muted">Excused Today</p>
          <p className="mt-3 font-serif text-3xl font-semibold text-blue-600">{stats.excused}</p>
          <p className="text-xs text-muted mt-1">Approved absences with reasons</p>
        </div>
        <div className="admin-stat-card rounded-2xl p-5 pl-6">
          <p className="text-sm font-medium text-muted">Absent Today</p>
          <p className="mt-3 font-serif text-3xl font-semibold text-red-500">{stats.absent}</p>
          <p className="text-xs text-muted mt-1">Awaiting logs or absent</p>
        </div>
      </section>

      {/* Search and Filters */}
      <div className="bg-white rounded-2xl border border-accent/10 p-5 shadow-sm space-y-4 mb-6">
        <div className="flex flex-wrap items-end gap-4 justify-between">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="min-w-[220px]">
              <AdminField label="Search Staff Member">
                <AdminInput
                  type="text"
                  value={searchStaff}
                  onChange={(e) => setSearchStaff(e.target.value)}
                  placeholder="Search by name..."
                />
              </AdminField>
            </div>
            {viewTab === "daily" && (
              <div className="min-w-[150px]">
                <AdminField label="Filter Date">
                  <AdminInput
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                  />
                </AdminField>
              </div>
            )}
            {(searchStaff || (viewTab === "daily" && filterDate)) && (
              <button
                onClick={() => {
                  setSearchStaff("");
                  setFilterDate("");
                }}
                className="mt-6 text-xs text-accent font-semibold hover:underline cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 text-sm font-semibold border border-accent text-accent hover:bg-accent-light/10 rounded-xl transition-all cursor-pointer focus:outline-none focus:ring-0"
            >
              Export Reports (CSV)
            </button>
            <AdminButton onClick={openCreate}>+ Record Absence or Presence</AdminButton>
          </div>
        </div>
      </div>

      {/* Attendance Logs & Summaries Panel */}
      <AdminPanel
        title="Attendance Records Sheet"
        subtitle="Daily shift history database logs & aggregated periods"
      >
        {/* Segmented View Tabs */}
        <div className="flex gap-2 border-b border-accent/10 pb-4 mb-4 px-2">
          <button
            onClick={() => setViewTab("daily")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer focus:outline-none focus:ring-0 ${
              viewTab === "daily"
                ? "bg-[#800000]/10 text-[#800000] border-l-4 border-[#800000] shadow-sm"
                : "text-muted hover:bg-accent-light/10"
            }`}
          >
            Daily Logs
          </button>
          <button
            onClick={() => setViewTab("weekly")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer focus:outline-none focus:ring-0 ${
              viewTab === "weekly"
                ? "bg-[#800000]/10 text-[#800000] border-l-4 border-[#800000] shadow-sm"
                : "text-muted hover:bg-accent-light/10"
            }`}
          >
            Weekly Summary
          </button>
          <button
            onClick={() => setViewTab("monthly")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer focus:outline-none focus:ring-0 ${
              viewTab === "monthly"
                ? "bg-[#800000]/10 text-[#800000] border-l-4 border-[#800000] shadow-sm"
                : "text-muted hover:bg-accent-light/10"
            }`}
          >
            Monthly Summary
          </button>
        </div>

        <div className="overflow-x-auto px-2 pb-2">
          {viewTab === "daily" && (
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead>
                <tr className="admin-table-head text-muted">
                  <th className="rounded-l-lg px-4 py-3 font-medium">Staff Member</th>
                  <th className="px-4 py-3 font-medium">Position</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Time In</th>
                  <th className="px-4 py-3 font-medium">Time Out</th>
                  <th className="px-4 py-3 font-medium">Total Hours</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="rounded-r-lg px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-muted">
                      No daily records found.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => {
                    const staffAccount = staffAccounts.find((s) => s.id === record.staffId);
                    const position = staffAccount ? (staffAccount.role === "head_staff" ? "Head Staff" : "Staff") : "Staff";
                    return (
                      <tr key={record.id} className="border-b border-accent/5 last:border-0 hover:bg-accent-light/10 text-ink">
                        <td className="px-4 py-3 font-semibold text-[#800000]">
                          {record.staffName}
                        </td>
                        <td className="px-4 py-3 text-muted text-xs capitalize">{position}</td>
                        <td className="px-4 py-3 text-muted text-xs">{record.date}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted">{record.timeIn || "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted">{record.timeOut || "—"}</td>
                        <td className="px-4 py-3 font-semibold text-xs">{record.totalHours ? `${record.totalHours} hrs` : "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize border ${
                            record.status === "Present"
                              ? "bg-green-50 text-green-800 border-green-200"
                              : record.status === "Late"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : record.status === "Absent"
                              ? "bg-red-50 text-red-800 border-red-200"
                              : "bg-blue-50 text-blue-800 border-blue-200"
                          }`}>
                            {record.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted italic max-w-[200px] truncate" title={record.reason || ""}>
                          {record.reason || "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openEdit(record)}
                              className="rounded-lg px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent-light transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(record)}
                              className="rounded-lg px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {viewTab === "weekly" && (
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead>
                <tr className="admin-table-head text-muted">
                  <th className="rounded-l-lg px-4 py-3 font-medium">Staff Member</th>
                  <th className="px-4 py-3 font-medium">Position</th>
                  <th className="px-4 py-3 font-medium">Week Period</th>
                  <th className="px-4 py-3 font-medium text-center">Present</th>
                  <th className="px-4 py-3 font-medium text-center">Late</th>
                  <th className="px-4 py-3 font-medium text-center">Excused</th>
                  <th className="px-4 py-3 font-medium text-center">Absent</th>
                  <th className="rounded-r-lg px-4 py-3 font-medium text-right">Total Hours</th>
                </tr>
              </thead>
              <tbody>
                {filteredWeeklySummaries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-muted">
                      No weekly summaries found.
                    </td>
                  </tr>
                ) : (
                  filteredWeeklySummaries.map((summary) => (
                    <tr key={`${summary.staffId}_${summary.period}`} className="border-b border-accent/5 last:border-0 hover:bg-accent-light/10 text-ink">
                      <td className="px-4 py-3 font-semibold text-[#800000]">
                        {summary.staffName}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs capitalize">{summary.position}</td>
                      <td className="px-4 py-3 text-muted text-xs font-mono">{summary.period}</td>
                      <td className="px-4 py-3 text-center font-bold text-green-700">{summary.presentCount}</td>
                      <td className="px-4 py-3 text-center font-bold text-amber-600">{summary.lateCount}</td>
                      <td className="px-4 py-3 text-center font-bold text-blue-600">{summary.excusedCount}</td>
                      <td className="px-4 py-3 text-center font-bold text-red-500">{summary.absentCount}</td>
                      <td className="px-4 py-3 text-right font-bold font-mono text-[#800000]">{summary.totalHours} hrs</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {viewTab === "monthly" && (
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead>
                <tr className="admin-table-head text-muted">
                  <th className="rounded-l-lg px-4 py-3 font-medium">Staff Member</th>
                  <th className="px-4 py-3 font-medium">Position</th>
                  <th className="px-4 py-3 font-medium">Month</th>
                  <th className="px-4 py-3 font-medium text-center">Present</th>
                  <th className="px-4 py-3 font-medium text-center">Late</th>
                  <th className="px-4 py-3 font-medium text-center">Excused</th>
                  <th className="px-4 py-3 font-medium text-center">Absent</th>
                  <th className="rounded-r-lg px-4 py-3 font-medium text-right">Total Hours</th>
                </tr>
              </thead>
              <tbody>
                {filteredMonthlySummaries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-muted">
                      No monthly summaries found.
                    </td>
                  </tr>
                ) : (
                  filteredMonthlySummaries.map((summary) => (
                    <tr key={`${summary.staffId}_${summary.period}`} className="border-b border-accent/5 last:border-0 hover:bg-accent-light/10 text-ink">
                      <td className="px-4 py-3 font-semibold text-[#800000]">
                        {summary.staffName}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs capitalize">{summary.position}</td>
                      <td className="px-4 py-3 text-muted text-xs font-mono">{summary.period}</td>
                      <td className="px-4 py-3 text-center font-bold text-green-700">{summary.presentCount}</td>
                      <td className="px-4 py-3 text-center font-bold text-amber-600">{summary.lateCount}</td>
                      <td className="px-4 py-3 text-center font-bold text-blue-600">{summary.excusedCount}</td>
                      <td className="px-4 py-3 text-center font-bold text-red-500">{summary.absentCount}</td>
                      <td className="px-4 py-3 text-right font-bold font-mono text-[#800000]">{summary.totalHours} hrs</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </AdminPanel>

      {/* Manual / Edit Attendance Modal */}
      <AdminModal
        open={open}
        title={editing ? "Edit Attendance Record" : "Log Attendance Record"}
        onClose={() => setOpen(false)}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton onClick={handleSubmit}>
              {editing ? "Save Changes" : "Log Record"}
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          <AdminField label="Staff Member">
            <AdminSelect
              value={form.staffId}
              onChange={(e) => setForm({ ...form, staffId: e.target.value })}
              disabled={!!editing}
            >
              {activeStaff.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name} (@{staff.username})
                </option>
              ))}
            </AdminSelect>
          </AdminField>

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Date">
              <AdminInput
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </AdminField>
            <AdminField label="Attendance Status">
              <AdminSelect
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as AttendanceStatus })}
              >
                <option value="Present">Present</option>
                <option value="Late">Late</option>
                <option value="Absent">Absent</option>
                <option value="Excused">Excused Absence</option>
              </AdminSelect>
            </AdminField>
          </div>

          {(form.status === "Present" || form.status === "Late") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="Time In">
                <AdminInput
                  type="text"
                  value={form.timeIn}
                  onChange={(e) => setForm({ ...form, timeIn: e.target.value })}
                  placeholder="e.g. 08:30 AM"
                />
              </AdminField>
              <AdminField label="Time Out (optional if currently on shift)">
                <AdminInput
                  type="text"
                  value={form.timeOut}
                  onChange={(e) => setForm({ ...form, timeOut: e.target.value })}
                  placeholder="e.g. 05:30 PM"
                />
              </AdminField>
            </div>
          )}

          {form.status === "Excused" && (
            <AdminField label="Absence Excuse Reason / Remarks">
              <AdminTextarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="e.g. Dental checkup appointment, family leave approval"
                required
              />
            </AdminField>
          )}
        </div>
      </AdminModal>
    </>
  );
}
