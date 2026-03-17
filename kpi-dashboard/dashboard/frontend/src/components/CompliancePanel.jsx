import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const SEVERITY_COLOR  = { critical: "#ef4444", warning: "#f59e0b", info: "#3b82f6" };
const SEVERITY_LABEL  = { critical: "Bắt buộc", warning: "Khuyến nghị", info: "Gợi ý" };
const SEVERITY_BG     = { critical: "#ef444422", warning: "#f59e0b22", info: "#3b82f622" };

function ScoreGauge({ rate }) {
  const color = rate >= 80 ? "#22c55e" : rate >= 50 ? "#f59e0b" : "#ef4444";
  const circumference = 2 * Math.PI * 40;
  const dash = (rate / 100) * circumference;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={100} height={100} viewBox="0 0 100 100">
        <circle cx={50} cy={50} r={40} fill="none" stroke="var(--border)" strokeWidth={10} />
        <circle cx={50} cy={50} r={40} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)" style={{ transition: "stroke-dasharray 0.6s ease" }} />
        <text x={50} y={54} textAnchor="middle" fill={color} fontSize={18} fontWeight={700}>{rate}%</text>
      </svg>
      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Tuân thủ</span>
    </div>
  );
}

const STATUS_COLOR = {
  closed: "#22c55e", "in progress": "#3b82f6", open: "#94a3b8",
  pending: "#f59e0b", blocked: "#ef4444", completed: "#22c55e",
  "in review": "#a78bfa", "hoàn thành chờ build": "#06b6d4",
};

export default function CompliancePanel({ data, loading }) {
  const [search, setSearch]           = useState("");
  const [sevFilter, setSevFilter]     = useState("all");
  const [scoreOnly, setScoreOnly]     = useState(true);
  const [expanded, setExpanded]       = useState(null);
  const [page, setPage]               = useState(0);
  const [viewTab, setViewTab]         = useState("issues"); // "issues" | "clean"
  const [cleanSearch, setCleanSearch] = useState("");
  const [cleanPage, setCleanPage]     = useState(0);
  const PAGE_SIZE = 15;

  if (loading) return (
    <div style={{ background: "var(--surface)", border: "1px solid #334155", borderRadius: 12,
      padding: 40, textAlign: "center", color: "var(--text-dim)" }}>Đang phân tích dữ liệu...</div>
  );
  if (!data) return null;

  const { total_tasks, tasks_with_issues, tasks_clean, compliance_rate, summary, task_issues, clean_tasks = [] } = data;

  // Lọc summary theo toggle scoreOnly
  const visibleSummary = (summary || []).filter(s => !scoreOnly || s.affects_score);

  // Filter task issues
  const filtered = (task_issues || []).filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || t.name?.toLowerCase().includes(q) || (t.assignees || []).join(" ").toLowerCase().includes(q);
    const matchSev = sevFilter === "all"
      || (sevFilter === "score"    && t.score_blocked)
      || (sevFilter === "critical" && t.critical_count > 0)
      || (sevFilter === "warning"  && t.warning_count > 0 && t.critical_count === 0);
    // Nếu scoreOnly thì chỉ hiện task có vấn đề liên quan tính điểm
    const matchScore = !scoreOnly || t.score_blocked;
    return matchSearch && matchSev && matchScore;
  });
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // Bar chart data — chỉ hiện rule phù hợp với toggle
  const chartData = visibleSummary
    .filter(s => s.count > 0)
    .sort((a, b) => b.count - a.count)
    .map(s => ({
      name: s.label.replace("Thiếu ", "").replace(" (task Closed chưa review)", "").replace(" (dùng để suy ra Weight)", ""),
      count: s.count, severity: s.severity, icon: s.icon,
    }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Top: gauge + summary cards + bar chart ── */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 16, background: "var(--surface)",
        border: "1px solid #334155", borderRadius: 12, padding: 20 }}>

        {/* Left: gauge + overview */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, minWidth: 160 }}>
          <ScoreGauge rate={compliance_rate} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
            {[
              { label: "✅ Tính được điểm",      value: tasks_clean,               color: "#22c55e",
                tip: "Task có Weight → hệ thống tính được KpiScore." },
              { label: "❌ Chưa tính được điểm", value: total_tasks - tasks_clean,  color: "#ef4444",
                tip: "Task thiếu Weight hoặc Points → KpiScore = 0, không vào KPI." },
              { label: "⚠️ Thiếu dữ liệu",      value: tasks_with_issues,          color: "#f59e0b",
                tip: "Thiếu ít nhất 1 trường (Due date, Quality, Assignee...). Có thể trùng với nhóm trên." },
              { label: "📋 Tổng tasks",          value: total_tasks,                color: "var(--text-muted)",
                tip: "✅ Tính được điểm + ❌ Chưa tính được điểm = Tổng." },
            ].map(item => (
              <div key={item.label} title={item.tip} style={{ display: "flex", justifyContent: "space-between",
                background: "var(--input-bg)", borderRadius: 6, padding: "5px 10px", cursor: "help" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* Toggle */}
          <button onClick={() => { setScoreOnly(v => !v); setPage(0); }}
            style={{ width: "100%", background: scoreOnly ? "#1d4ed822" : "var(--border)",
              border: `1px solid ${scoreOnly ? "#3b82f6" : "var(--border-mid)"}`,
              borderRadius: 8, padding: "6px 10px", color: scoreOnly ? "#93c5fd" : "#94a3b8",
              cursor: "pointer", fontSize: 12, fontWeight: 600, textAlign: "center" }}>
            {scoreOnly ? "🎯 Chỉ liên quan tính điểm" : "📋 Tất cả tiêu chí"}
          </button>
        </div>

        {/* Right: bar chart */}
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>
            Số task vi phạm theo từng tiêu chí
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11, fill: "#cbd5e1" }} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid #334155", borderRadius: 8 }}
                formatter={(v, n, p) => [`${v} tasks (${p.payload.icon})`, "Vi phạm"]} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={SEVERITY_COLOR[d.severity] || "#64748b"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Summary cards theo từng rule ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {visibleSummary.map(s => (
          <div key={s.key} style={{
            background: "var(--surface)", border: `1px solid ${SEVERITY_COLOR[s.severity]}44`,
            borderRadius: 10, padding: "10px 16px", flex: "1 1 200px", minWidth: 200,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>{s.icon} {s.label}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
                <span style={{ background: SEVERITY_BG[s.severity], color: SEVERITY_COLOR[s.severity],
                  fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 99, whiteSpace: "nowrap" }}>
                  {SEVERITY_LABEL[s.severity]}
                </span>
                {s.affects_score && (
                  <span style={{ background: "#1d4ed822", color: "#60a5fa",
                    fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 99, whiteSpace: "nowrap" }}>
                    🎯 Ảnh hưởng điểm
                  </span>
                )}
              </div>
            </div>
            <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: s.count === 0 ? "#22c55e" : SEVERITY_COLOR[s.severity] }}>
                {s.count}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-dim)" }}>/ {s.applicable} tasks ({s.rate}%)</span>
            </div>
            {/* Mini progress bar */}
            <div style={{ height: 4, background: "var(--border)", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${s.rate}%`, borderRadius: 2, transition: "width .4s",
                background: s.count === 0 ? "#22c55e" : SEVERITY_COLOR[s.severity] }} />
            </div>
            {/* Hint */}
            {s.hint && (
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--border-mid)", lineHeight: 1.4, fontStyle: "italic" }}>
                💡 {s.hint}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Tab switch ── */}
      <div style={{ background: "var(--surface)", border: "1px solid #334155", borderRadius: 12, overflow: "hidden" }}>
        {/* Tab header */}
        <div style={{ display: "flex", borderBottom: "1px solid #334155" }}>
          {[
            { id: "issues", label: `⚠️ Thiếu dữ liệu`, count: filtered.length },
            { id: "clean",  label: `✅ Dữ liệu đủ`,   count: tasks_clean },
          ].map(tab => (
            <button key={tab.id} onClick={() => setViewTab(tab.id)}
              style={{ flex: 1, padding: "14px 20px", background: "transparent", border: "none",
                borderBottom: viewTab === tab.id ? "2px solid #3b82f6" : "2px solid transparent",
                color: viewTab === tab.id ? "#f1f5f9" : "#64748b",
                fontWeight: viewTab === tab.id ? 700 : 400, fontSize: 14, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {tab.label}
              <span style={{ background: viewTab === tab.id ? "#3b82f633" : "#33415533",
                color: viewTab === tab.id ? "#93c5fd" : "#64748b",
                fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Tab: Cần bổ sung ── */}
        {viewTab === "issues" && <>
        <div style={{ padding: "12px 20px", borderBottom: "1px solid #334155",
          display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="🔍 Tìm task, assignee..."
            style={{ background: "var(--input-bg)", border: "1px solid #475569", borderRadius: 8, padding: "6px 12px",
              color: "var(--text-sec)", fontSize: 13, width: 220 }} />
          <select value={sevFilter} onChange={e => { setSevFilter(e.target.value); setPage(0); }}
            style={{ background: "var(--input-bg)", border: "1px solid #475569", borderRadius: 8, padding: "6px 12px",
              color: "var(--text-sec)", fontSize: 13 }}>
            <option value="all">Tất cả</option>
            <option value="score">🎯 Chặn tính điểm</option>
            <option value="critical">🔴 Có lỗi bắt buộc</option>
            <option value="warning">🟡 Chỉ cảnh báo</option>
          </select>
        </div>

        {paged.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-dim)" }}>
            {tasks_with_issues === 0 ? "🎉 Tất cả tasks đều đầy đủ dữ liệu!" : "Không có task nào khớp"}
          </div>
        ) : (
          <div>
            {paged.map((t, i) => (
              <div key={t.id}
                style={{ borderBottom: "1px solid #0f172a", background: i % 2 === 0 ? "transparent" : "#0f172a22" }}>
                {/* Row header */}
                <div onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                  style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: 12,
                    cursor: "pointer", userSelect: "none" }}>
                  <span style={{ fontSize: 14, marginRight: 4 }}>{expanded === t.id ? "▼" : "▶"}</span>

                  {/* Badges lỗi */}
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    {t.score_blocked && (
                      <span style={{ background: "#7f1d1d", color: "#fca5a5", fontSize: 11, fontWeight: 700,
                        padding: "2px 7px", borderRadius: 99, border: "1px solid #ef4444" }}>
                        🎯 Chặn điểm
                      </span>
                    )}
                    {t.critical_count > 0 && (
                      <span style={{ background: "#ef444422", color: "#ef4444", fontSize: 11, fontWeight: 700,
                        padding: "2px 7px", borderRadius: 99 }}>
                        🔴 {t.critical_count} bắt buộc
                      </span>
                    )}
                    {t.warning_count > 0 && (
                      <span style={{ background: "#f59e0b22", color: "#f59e0b", fontSize: 11, fontWeight: 700,
                        padding: "2px 7px", borderRadius: 99 }}>
                        ⚠️ {t.warning_count} cảnh báo
                      </span>
                    )}
                  </div>

                  {/* Task name */}
                  <a href={t.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                    style={{ color: "#93c5fd", fontSize: 13, textDecoration: "none", flex: 1, minWidth: 0 }}
                    title={t.name}>
                    {t.name?.length > 70 ? t.name.slice(0, 70) + "…" : t.name}
                  </a>

                  <span style={{ fontSize: 12, color: "var(--text-dim)", flexShrink: 0 }}>
                    {(t.assignees || []).join(", ") || "—"}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--border-mid)", flexShrink: 0 }}>{t.list}</span>
                </div>

                {/* Expanded: danh sách field còn thiếu */}
                {expanded === t.id && (
                  <div style={{ padding: "0 20px 14px 48px", display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {t.missing.map(m => (
                      <div key={m.key} style={{
                        background: SEVERITY_BG[m.severity],
                        border: `1px solid ${SEVERITY_COLOR[m.severity]}44`,
                        borderRadius: 8, padding: "6px 12px",
                        display: "flex", alignItems: "center", gap: 6,
                      }}>
                        <span>{m.icon}</span>
                        <span style={{ fontSize: 12, color: SEVERITY_COLOR[m.severity], fontWeight: 600 }}>{m.label}</span>
                        <span style={{ fontSize: 10, color: "var(--text-dim)",
                          background: "var(--input-bg)", borderRadius: 99, padding: "1px 6px" }}>
                          {SEVERITY_LABEL[m.severity]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination issues */}
        {totalPages > 1 && (
          <div style={{ padding: "12px 20px", borderTop: "1px solid #334155",
            display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
            <span style={{ color: "var(--text-dim)", fontSize: 13, marginRight: "auto" }}>Trang {page + 1}/{totalPages}</span>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              style={{ background: "var(--border)", border: "none", borderRadius: 6, padding: "5px 14px",
                color: "var(--text-sec)", cursor: page === 0 ? "not-allowed" : "pointer", opacity: page === 0 ? 0.4 : 1 }}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i).filter(i => Math.abs(i - page) <= 2).map(i => (
              <button key={i} onClick={() => setPage(i)}
                style={{ background: i === page ? "#3b82f6" : "var(--border)", border: "none", borderRadius: 6,
                  padding: "5px 12px", color: "var(--text-sec)", cursor: "pointer", fontWeight: i === page ? 700 : 400 }}>
                {i + 1}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
              style={{ background: "var(--border)", border: "none", borderRadius: 6, padding: "5px 14px",
                color: "var(--text-sec)", cursor: page === totalPages - 1 ? "not-allowed" : "pointer",
                opacity: page === totalPages - 1 ? 0.4 : 1 }}>›</button>
          </div>
        )}
        </> /* end tab issues */}

        {/* ── Tab: Đã đầy đủ ── */}
        {viewTab === "clean" && <CleanTasksTab
          tasks={clean_tasks}
          search={cleanSearch} setSearch={s => { setCleanSearch(s); setCleanPage(0); }}
          page={cleanPage}    setPage={setCleanPage}
          pageSize={PAGE_SIZE}
        />}

      </div>
    </div>
  );
}

// ── Component riêng cho tab Đã đầy đủ ──────────────────────────────────────
function CleanTasksTab({ tasks, search, setSearch, page, setPage, pageSize }) {
  const filtered = tasks.filter(t => {
    const q = search.toLowerCase();
    return !q || t.name?.toLowerCase().includes(q) || (t.assignees || []).join(" ").toLowerCase().includes(q);
  });
  const paged      = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const tfColor = tf => tf === 1 ? "#22c55e" : tf >= 0.9 ? "#f59e0b" : tf >= 0.8 ? "#f97316" : "#ef4444";
  const scoreColor = (score, weight) => {
    if (!score || !weight) return "#64748b";
    const r = score / weight;
    if (score === 0) return "#ef4444";
    return r >= 0.9 ? "#22c55e" : r >= 0.7 ? "#f59e0b" : "#ef4444";
  };

  return (
    <>
      <div style={{ padding: "12px 20px", borderBottom: "1px solid #334155", display: "flex", gap: 12, alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Tìm task, assignee..."
          style={{ background: "var(--input-bg)", border: "1px solid #475569", borderRadius: 8, padding: "6px 12px",
            color: "var(--text-sec)", fontSize: 13, width: 220 }} />
        <span style={{ fontSize: 13, color: "var(--text-dim)", marginLeft: "auto" }}>
          {filtered.length} tasks đủ điều kiện tính điểm
        </span>
      </div>

      {paged.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: "var(--text-dim)" }}>Không có task nào</div>
      ) : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--input-bg)" }}>
                {["Tên task", "Assignee", "Status", "List", "Weight", "TimeFactor", "Quality", "Score"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "var(--text-muted)",
                    fontWeight: 600, borderBottom: "1px solid #334155", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((t, i) => (
                <tr key={t.id} style={{ background: i % 2 === 0 ? "transparent" : "#0f172a22",
                  borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "9px 14px", maxWidth: 280 }}>
                    <a href={t.url} target="_blank" rel="noreferrer"
                      style={{ color: "#86efac", textDecoration: "none" }} title={t.name}>
                      {t.name?.length > 65 ? t.name.slice(0, 65) + "…" : t.name}
                    </a>
                  </td>
                  <td style={{ padding: "9px 14px", color: "#c4b5fd", whiteSpace: "nowrap" }}>
                    {(t.assignees || []).join(", ") || "—"}
                  </td>
                  <td style={{ padding: "9px 14px" }}>
                    <span style={{
                      background: (STATUS_COLOR[t.status?.toLowerCase()] ?? "var(--border-mid)") + "33",
                      color: STATUS_COLOR[t.status?.toLowerCase()] ?? "#94a3b8",
                      padding: "2px 8px", borderRadius: 99, fontSize: 12, fontWeight: 600
                    }}>{t.status}</span>
                  </td>
                  <td style={{ padding: "9px 14px", color: "var(--text-dim)", fontSize: 12 }}>{t.list}</td>
                  <td style={{ padding: "9px 14px", color: "#fbbf24", fontWeight: 700 }}>
                    {t.kpi_weight ?? "—"}
                    {t.kpi_weight_source === "time_estimate" &&
                      <span style={{ fontSize: 10, color: "var(--text-dim)", marginLeft: 4 }}>(est)</span>}
                  </td>
                  <td style={{ padding: "9px 14px", fontWeight: 600, color: tfColor(t.kpi_time_factor) }}>
                    {t.kpi_time_factor}
                    {t.kpi_late_days > 0 &&
                      <span style={{ fontSize: 11, color: "#ef4444", marginLeft: 4 }}>+{t.kpi_late_days}d</span>}
                  </td>
                  <td style={{ padding: "9px 14px", color: "#a78bfa", textTransform: "capitalize" }}>
                    {t.kpi_quality_label || <span style={{ color: "var(--border-mid)", fontStyle: "italic" }}>good*</span>}
                  </td>
                  <td style={{ padding: "9px 14px", fontWeight: 800,
                    color: scoreColor(t.kpi_score, t.kpi_weight), fontSize: 15 }}>
                    {t.kpi_score != null ? t.kpi_score : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination clean */}
          {totalPages > 1 && (
            <div style={{ padding: "12px 20px", borderTop: "1px solid #334155",
              display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
              <span style={{ color: "var(--text-dim)", fontSize: 13, marginRight: "auto" }}>Trang {page + 1}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                style={{ background: "var(--border)", border: "none", borderRadius: 6, padding: "5px 14px",
                  color: "var(--text-sec)", cursor: page === 0 ? "not-allowed" : "pointer", opacity: page === 0 ? 0.4 : 1 }}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i).filter(i => Math.abs(i - page) <= 2).map(i => (
                <button key={i} onClick={() => setPage(i)}
                  style={{ background: i === page ? "#22c55e" : "var(--border)", border: "none", borderRadius: 6,
                    padding: "5px 12px", color: i === page ? "#000" : "#e2e8f0",
                    cursor: "pointer", fontWeight: i === page ? 700 : 400 }}>
                  {i + 1}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                style={{ background: "var(--border)", border: "none", borderRadius: 6, padding: "5px 14px",
                  color: "var(--text-sec)", cursor: page === totalPages - 1 ? "not-allowed" : "pointer",
                  opacity: page === totalPages - 1 ? 0.4 : 1 }}>›</button>
            </div>
          )}
        </>
      )}
    </>
  );
}
