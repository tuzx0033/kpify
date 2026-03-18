import { useState } from "react";
import EmployeeDetailModal from "./EmployeeDetailModal";

function dhsColor(dhs) {
  if (dhs === null || dhs === undefined) return "var(--text-dim)";
  if (dhs >= 1.1) return "#22c55e";
  if (dhs >= 1.0) return "#3b82f6";
  if (dhs >= 0.9) return "#f59e0b";
  return "#ef4444";
}

function kpiBar(pct) {
  const clamped = Math.min(pct ?? 0, 130);
  const color = pct >= 100 ? "#22c55e" : pct >= 80 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 100, height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${(clamped / 130) * 100}%`, height: "100%", background: color, borderRadius: 4, transition: "width .4s" }} />
      </div>
      <span style={{ fontSize: 13, color, fontWeight: 600, minWidth: 50 }}>{pct != null ? `${pct}%` : "—"}</span>
    </div>
  );
}

export default function KpiTable({ data, loading, tasks }) {
  const [sort, setSort] = useState({ col: "kpi_pct", dir: -1 });
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const assigneeOptions = [...new Set(
    (data || [])
    .map(row => row.assignee)
    .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  const filtered = (data || []).filter(row => {
     if (!selectedAssignee) return true;
      return row.assignee === selectedAssignee;
  });

  const sorted = [...filtered]
  .sort((a, b) => {
    const av = a[sort.col] ?? -Infinity;
    const bv = b[sort.col] ?? -Infinity;
    return sort.dir * (bv - av);
  })
  .map((row, index) => ({
    ...row,
    stt: index + 1
  }));

  const th = (label, col) => (
    <th onClick={() => setSort(s => ({ col, dir: s.col === col ? -s.dir : -1 }))}
      style={{
        padding: "10px 14px", textAlign: "left", fontSize: 12, color: "var(--text-muted)",
        fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", userSelect: "none",
        background: "var(--surface)", borderBottom: "1px solid var(--border)"
      }}>
      {label}{sort.col === col ? (sort.dir === -1 ? " ▼" : " ▲") : ""}
    </th>
  );

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>
          🏆 KPI theo thành viên
        </div>
        <select
          value={selectedAssignee}
          onChange={e => setSelectedAssignee(e.target.value)}
          style={{ background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 8,
            padding: "6px 12px", color: "var(--text-sec)", fontSize: 13, width: 220 }}
        > <option value="">Tất cả thành viên</option>
  {assigneeOptions.map(name => (
    <option key={name} value={name}>
      {name}
    </option>
  ))} </select>
        
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ padding: "10px 14px" }}>STT</th>
              {th("Tên", "assignee")}
              {th("KPI%", "kpi_pct")}
              {th("ĐHS", "dhs")}
              {th("Tổng điểm", "total_score")}
              {th("Tổng weight", "total_weight")}
              {th("Tasks", "tasks_total")}
              {th("Đúng hạn", "tasks_on_time")}
              {th("Trễ", "tasks_late")}
              {th("Closed", "tasks_closed")}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={10} style={{ padding: 32, textAlign: "center", color: "var(--text-dim)" }}>Đang tải...</td></tr>
            )}
            {!loading && sorted.map((row, i) => (
              <tr key={row.assignee} style={{ background: i % 2 === 0 ? "transparent" : "var(--surface-alt)" }}>
                <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontWeight: 600 }}>{row.stt}</td>
                <td onClick={() => setSelectedEmployee(row)}
                  style={{ padding: "10px 14px", fontWeight: 600, fontSize: 14, color: "#93c5fd",
                    cursor: "pointer", transition: "color .15s" }}
                  onMouseEnter={e => e.target.style.textDecoration = "underline"}
                  onMouseLeave={e => e.target.style.textDecoration = "none"}
                >{row.assignee}</td>
                <td style={{ padding: "10px 14px" }}>{kpiBar(row.kpi_pct)}</td>
                <td style={{ padding: "10px 14px", fontWeight: 700, color: dhsColor(row.dhs) }}>
                  {row.dhs != null ? row.dhs.toFixed(3) : "—"}
                </td>
                <td onClick={() => setSelectedEmployee(row)}
                  style={{ padding: "10px 14px", color: "#a5f3fc", cursor: "pointer", transition: "color .15s" }}
                  onMouseEnter={e => e.target.style.textDecoration = "underline"}
                  onMouseLeave={e => e.target.style.textDecoration = "none"}
                >{row.total_score?.toFixed(1) ?? "—"}</td>
                <td style={{ padding: "10px 14px", color: "var(--text-muted)" }}>{row.total_weight?.toFixed(1) ?? "—"}</td>
                <td style={{ padding: "10px 14px", color: "var(--text-sec)" }}>{row.tasks_total}</td>
                <td style={{ padding: "10px 14px", color: "#22c55e" }}>{row.tasks_on_time}</td>
                <td style={{ padding: "10px 14px", color: "#f87171" }}>{row.tasks_late}</td>
                <td style={{ padding: "10px 14px", color: "var(--text-muted)" }}>{row.tasks_closed}</td>
              </tr>
            ))}
            {!loading && sorted.length === 0 && (
              <tr><td colSpan={10} style={{ padding: 32, textAlign: "center", color: "var(--text-dim)" }}>Không có dữ liệu</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedEmployee && (
        <EmployeeDetailModal
          assigneeName={selectedEmployee.assignee}
          kpiRow={selectedEmployee}
          tasks={tasks || []}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </div>
  );
}
