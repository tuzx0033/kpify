import * as XLSX from "xlsx";

const TF_LABEL = { 1: "Đúng hạn", 0.9: "Trễ 1-2 ngày", 0.8: "Trễ 3-5 ngày", 0.6: "Trễ >5 ngày" };

export function exportTasksToExcel(tasks, filename = "KPI_Tasks_All.xlsx") {
  const rows = tasks.map((t) => ({
    "ID":                t.id ?? "",
    "Tên Task":          t.name ?? "",
    "Assignee":          (t.assignees || []).join(", "),
    "Tags":              (t.tags || []).join(", "),
    "Status":            t.status ?? "",
    "Priority":          t.priority ?? "",
    "Team":              t.team ?? "",
    "Space":             t.space ?? "",
    "Folder":            t.folder ?? "",
    "List":              t.list ?? "",
    "Ngày tạo":          t.date_created ? t.date_created.slice(0, 10) : "",
    "Ngày cập nhật":     t.date_updated ? t.date_updated.slice(0, 10) : "",
    "Due date":          t.due_date ? t.due_date.slice(0, 10) : "",
    "Start date":        t.start_date ? t.start_date.slice(0, 10) : "",
    "Ngày đóng":         t.date_closed ? t.date_closed.slice(0, 10) : "",
    "Time Estimate (h)": t.time_estimate_hours ?? "",
    "Time Spent (h)":    t.time_spent_hours ?? "",
    "Weight":            t.kpi_weight ?? "",
    "Weight Source":     t.kpi_weight_source ?? "",
    "Trễ (ngày)":        t.kpi_late_days ?? 0,
    "TimeFactor":        t.kpi_time_factor ?? "",
    "TimeFactor Label":  TF_LABEL[t.kpi_time_factor] ?? "",
    "Quality":           t.kpi_quality_label || "unset",
    "Quality Factor":    t.kpi_quality_factor ?? "",
    "Score":             t.kpi_score ?? "",
    "URL":               t.url ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Tự động căn độ rộng cột theo nội dung
  const colWidths = Object.keys(rows[0] || {}).map((key) => {
    const maxLen = Math.max(
      key.length,
      ...rows.map((r) => String(r[key] ?? "").length)
    );
    return { wch: Math.min(maxLen + 2, 50) };
  });
  ws["!cols"] = colWidths;

  // Freeze row đầu (header)
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tasks");

  // Sheet tóm tắt KPI theo assignee
  const kpiMap = {};
  for (const t of tasks) {
    for (const a of t.assignees || []) {
      if (!a) continue;
      if (!kpiMap[a]) kpiMap[a] = { assignee: a, total: 0, scored: 0, weight: 0, score: 0, onTime: 0, late: 0 };
      kpiMap[a].total++;
      const w = t.kpi_weight ?? 0;
      const s = t.kpi_score ?? null;
      if (s !== null && s !== "") {
        kpiMap[a].scored++;
        kpiMap[a].weight += Number(w);
        kpiMap[a].score += Number(s);
        if ((t.kpi_late_days ?? 0) === 0 && t.date_closed) kpiMap[a].onTime++;
        else if ((t.kpi_late_days ?? 0) > 0) kpiMap[a].late++;
      }
    }
  }
  const kpiRows = Object.values(kpiMap).map((p) => ({
    "Assignee":        p.assignee,
    "Tổng tasks":      p.total,
    "Tasks có điểm":   p.scored,
    "Total Weight":    Math.round(p.weight * 100) / 100,
    "Total Score":     Math.round(p.score * 100) / 100,
    "KPI%":            p.weight > 0 ? Math.round((p.score / p.weight) * 1000) / 10 : "",
    "Đúng hạn":        p.onTime,
    "Trễ":             p.late,
  })).sort((a, b) => (b["KPI%"] || 0) - (a["KPI%"] || 0));

  const wsKpi = XLSX.utils.json_to_sheet(kpiRows);
  wsKpi["!cols"] = Object.keys(kpiRows[0] || {}).map((k) => ({ wch: Math.max(k.length, 12) + 2 }));
  XLSX.utils.book_append_sheet(wb, wsKpi, "KPI Summary");

  XLSX.writeFile(wb, filename);
}
