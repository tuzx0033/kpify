import { useMemo } from "react";

const STATUS_COLOR = {
  closed: "#22c55e",
  "in progress": "#3b82f6",
  open: "#94a3b8",
  pending: "#f59e0b",
  blocked: "#ef4444",
  completed: "#22c55e",
  "in review": "#a78bfa",
  "hoàn thành chờ build": "#06b6d4",
};

function scoreColor(score, weight) {
  if (!score || !weight) return "#64748b";
  const r = score / weight;
  if (score === 0) return "#ef4444";
  if (r >= 0.9) return "#22c55e";
  if (r >= 0.7) return "#f59e0b";
  return "#ef4444";
}

function tfBadge(tf) {
  const num = typeof tf === "number" ? tf : Number(tf);
  if (!Number.isFinite(num) || num <= 0) {
    return <span style={{ color: "#64748b", fontWeight: 600, fontSize: 12 }}>—</span>;
  }
  let color = "#ef4444";
  let label = "Trễ nặng";
  if (num >= 1.0) {
    color = "#22c55e";
    label = "Đúng hạn";
  } else if (num >= 0.9) {
    color = "#f59e0b";
    label = "Trễ nhẹ";
  } else if (num >= 0.8) {
    color = "#f97316";
    label = "Trễ vừa";
  }

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 1 }}>
      <span style={{ color, fontWeight: 800, fontSize: 13, lineHeight: 1 }}>{num.toFixed(1)}</span>
      <span style={{ color: "var(--text-dim)", fontWeight: 600, fontSize: 10, lineHeight: 1.2 }}>{label}</span>
    </div>
  );
}

function toNumeric(value) {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function formatCompactNumber(value) {
  const num = toNumeric(value);
  if (num == null) return "—";
  if (Number.isInteger(num)) return String(num);
  return num.toFixed(2).replace(/\.0+$|0+$/g, "");
}

function weightBand(hours) {
  const h = toNumeric(hours);
  if (h == null || h <= 0) return null;
  if (h <= 0.5) return { range: "<=0.5h", weight: 1 };
  if (h <= 1.0) return { range: "0.5-1h", weight: 2 };
  if (h <= 2.0) return { range: "1-2h", weight: 3 };
  if (h <= 4.0) return { range: "2-4h", weight: 5 };
  if (h <= 6.0) return { range: "4-6h", weight: 8 };
  return { range: ">6h", weight: 13 };
}

function explainWeight(task) {
  const w = toNumeric(task?.kpi_weight);
  if (w == null || w <= 0) return "Chưa đủ dữ liệu";
  if (task?.kpi_weight_source === "points") {
    return `Points trực tiếp = ${formatCompactNumber(w)}`;
  }
  if (task?.kpi_weight_source === "time_estimate") {
    const h = toNumeric(task?.time_estimate_hours);
    const band = weightBand(h);
    if (h != null && band) {
      return `${formatCompactNumber(h)}h -> khung ${band.range} => ${band.weight}`;
    }
    return "Map từ Time Estimate";
  }
  return "Nguồn khác";
}

function formatFactor(value) {
  const num = toNumeric(value);
  if (num == null) return "—";
  return num.toFixed(1);
}

function qualityBadge(label) {
  const map = {
    excellent: ["🌟 Excellent", "#22c55e", "×1.1"],
    good: ["👍 Good", "#3b82f6", "×1.0"],
    "needs fix": ["🔧 Needs Fix", "#f97316", "×0.8"],
    fail: ["❌ Fail", "#ef4444", "×0.0"],
  };
  const [display, color, mult] = map[label?.toLowerCase()] ?? [
    "—",
    "#64748b",
    "",
  ];
  return (
    <span style={{ color, fontWeight: 600, fontSize: 12 }}>
      {display} {mult && <span style={{ opacity: 0.7 }}>({mult})</span>}
    </span>
  );
}

function weightSourceBadge(source) {
  if (source === "points") {
    return (
      <span
        style={{
          background: "#3b82f622",
          color: "#60a5fa",
          padding: "2px 8px",
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        Points trực tiếp
      </span>
    );
  }
  if (source === "time_estimate") {
    return (
      <span
        style={{
          background: "#f59e0b22",
          color: "#fbbf24",
          padding: "2px 8px",
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        Time Estimate
      </span>
    );
  }
  return <span style={{ color: "#64748b", fontSize: 11 }}>—</span>;
}

export default function EmployeeDetailModal({
  assigneeName,
  kpiRow,
  tasks,
  onClose,
}) {
  // Filter tasks belonging to this assignee that have a score
  const employeeTasks = useMemo(() => {
    if (!tasks || !assigneeName) return [];
    return tasks.filter(
      (t) => (t.assignees || []).includes(assigneeName) && t.kpi_score != null,
    );
  }, [tasks, assigneeName]);

  // Calculate total from individual tasks (should match dashboard)
  const calcTotal = useMemo(() => {
    return employeeTasks.reduce((sum, t) => sum + (t.kpi_score ?? 0), 0);
  }, [employeeTasks]);

  const calcWeight = useMemo(() => {
    return employeeTasks.reduce((sum, t) => {
      const w = typeof t.kpi_weight === "number" ? t.kpi_weight : 0;
      return sum + w;
    }, 0);
  }, [employeeTasks]);

  if (!assigneeName) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          zIndex: 1000,
          animation: "fadeIn .2s ease",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(1050px, 95vw)",
          maxHeight: "88vh",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          zIndex: 1001,
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
          animation: "slideUp .25s ease",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: "var(--text-primary)",
                marginBottom: 4,
              }}
            >
              👤 {assigneeName}
            </div>
            <div
              style={{
                display: "flex",
                gap: 16,
                fontSize: 13,
                color: "var(--text-muted)",
              }}
            >
              {kpiRow?.kpi_pct != null && (
                <span>
                  KPI:{" "}
                  <strong
                    style={{
                      color:
                        kpiRow.kpi_pct >= 100
                          ? "#22c55e"
                          : kpiRow.kpi_pct >= 80
                            ? "#f59e0b"
                            : "#ef4444",
                    }}
                  >
                    {kpiRow.kpi_pct}%
                  </strong>
                </span>
              )}
              {kpiRow?.dhs != null && (
                <span>
                  ĐHS:{" "}
                  <strong style={{ color: "#a5f3fc" }}>
                    {kpiRow.dhs.toFixed(3)}
                  </strong>
                </span>
              )}
              <span>
                Tasks có điểm:{" "}
                <strong style={{ color: "#a78bfa" }}>
                  {employeeTasks.length}
                </strong>
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "var(--border)",
              border: "none",
              borderRadius: 8,
              width: 36,
              height: 36,
              cursor: "pointer",
              fontSize: 18,
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all .15s",
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "#ef4444";
              e.target.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "var(--border)";
              e.target.style.color = "var(--text-muted)";
            }}
          >
            ✕
          </button>
        </div>

        {/* Summary cards */}
        <div
          style={{
            padding: "16px 24px",
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          {[
            {
              label: "Tổng điểm",
              value: calcTotal.toFixed(1),
              color: "#a5f3fc",
              icon: "🎯",
            },
            {
              label: "Tổng weight",
              value: calcWeight.toFixed(1),
              color: "#f59e0b",
              icon: "⚖️",
            },
            {
              label: "Đúng hạn",
              value: kpiRow?.tasks_on_time ?? 0,
              color: "#22c55e",
              icon: "✅",
            },
            {
              label: "Trễ hạn",
              value: kpiRow?.tasks_late ?? 0,
              color: "#f87171",
              icon: "⏰",
            },
            {
              label: "Closed",
              value: kpiRow?.tasks_closed ?? 0,
              color: "#94a3b8",
              icon: "📦",
            },
          ].map((card) => (
            <div
              key={card.label}
              style={{
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "10px 16px",
                minWidth: 110,
                flex: "1 1 auto",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  marginBottom: 4,
                }}
              >
                {card.icon} {card.label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: card.color }}>
                {card.value}
              </div>
            </div>
          ))}
        </div>

        {/* Quick guide */}
        <div
          style={{
            padding: "12px 24px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
            background: "var(--bg)",
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-sec)", marginBottom: 8 }}>
            📐 Hướng dẫn đọc nhanh
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
            }}
          >
            <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", background: "var(--surface)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24", marginBottom: 4 }}>Weight</div>
              <div style={{ fontSize: 11, lineHeight: 1.45 }}>Points &gt; 0 thì lấy trực tiếp.</div>
              <div style={{ fontSize: 11, lineHeight: 1.45 }}>Không có Points thì map Time Estimate:</div>
              <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
                &lt;=0.5h=1, 0.5-1h=2, 1-2h=3, 2-4h=5, 4-6h=8, &gt;6h=13
              </div>
            </div>

            <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", background: "var(--surface)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#22c55e", marginBottom: 4 }}>TimeFactor (hệ số)</div>
              <div style={{ fontSize: 11, lineHeight: 1.45 }}>1.0 = đúng hạn, 0.9 = trễ nhẹ</div>
              <div style={{ fontSize: 11, lineHeight: 1.45 }}>0.8 = trễ vừa, 0.6 = trễ nặng</div>
            </div>

            <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", background: "var(--surface)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#93c5fd", marginBottom: 4 }}>Score</div>
              <div style={{ fontSize: 11, lineHeight: 1.45 }}>Score = Weight × TimeFactor × QualityFactor</div>
              <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
                Dòng nào cũng có công thức chi tiết ở cột Score
              </div>
            </div>
          </div>
        </div>

        {/* Task detail table */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
          >
            <thead>
              <tr>
                {[
                  "#",
                  "Tên task",
                  "Status",
                  "Weight (điểm gốc)",
                  "Nguồn Weight",
                  "TimeFactor (hệ số)",
                  "Quality",
                  "Score",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 12px",
                      textAlign: "left",
                      color: "var(--text-muted)",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      borderBottom: "1px solid var(--border)",
                      background: "var(--surface)",
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employeeTasks.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      padding: 32,
                      textAlign: "center",
                      color: "var(--text-dim)",
                    }}
                  >
                    Không có task nào có điểm
                  </td>
                </tr>
              )}
              {employeeTasks.map((t, i) => {
                const w = typeof t.kpi_weight === "number" ? t.kpi_weight : 0;
                return (
                  <tr
                    key={t.id + i}
                    style={{
                      background:
                        i % 2 === 0 ? "transparent" : "var(--surface-alt)",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <td
                      style={{
                        padding: "8px 12px",
                        color: "var(--text-dim)",
                        fontWeight: 600,
                      }}
                    >
                      {i + 1}
                    </td>
                    <td style={{ padding: "8px 12px", maxWidth: 280 }}>
                      <a
                        href={t.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#93c5fd", textDecoration: "none" }}
                        title={t.name}
                      >
                        {t.name?.length > 50
                          ? t.name.slice(0, 50) + "…"
                          : t.name}
                      </a>
                      {t.due_date && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-dim)",
                            marginTop: 2,
                          }}
                        >
                          📅 Due: {t.due_date.slice(0, 10)}
                          {t.date_closed && (
                            <span> → Closed: {t.date_closed.slice(0, 10)}</span>
                          )}
                          {t.kpi_late_days > 0 && (
                            <span style={{ color: "#f87171", fontWeight: 600 }}>
                              {" "}
                              (trễ {t.kpi_late_days} ngày)
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <span
                        style={{
                          background:
                            (STATUS_COLOR[t.status?.toLowerCase()] ??
                              "#475569") + "33",
                          color:
                            STATUS_COLOR[t.status?.toLowerCase()] ?? "#94a3b8",
                          padding: "2px 8px",
                          borderRadius: 99,
                          fontSize: 12,
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        color: "#f59e0b",
                        fontWeight: 800,
                        fontSize: 15,
                      }}
                    >
                      <div>{w || "—"}</div>
                      {w > 0 && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-dim)",
                            marginTop: 1,
                            fontWeight: 600,
                            lineHeight: 1.35,
                          }}
                        >
                          {explainWeight(t)}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      {weightSourceBadge(t.kpi_weight_source)}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      {tfBadge(t.kpi_time_factor)}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      {qualityBadge(t.kpi_quality_label, t.kpi_quality_factor)}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <div>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: scoreColor(t.kpi_score, t.kpi_weight),
                          }}
                        >
                          {t.kpi_score != null ? t.kpi_score : "—"}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-dim)",
                          marginTop: 1,
                          fontWeight: 600,
                        }}
                      >
                        {w > 0 &&
                        t.kpi_time_factor &&
                        t.kpi_quality_factor != null
                          ? `${formatCompactNumber(w)} × ${formatFactor(t.kpi_time_factor)} × ${formatFactor(t.kpi_quality_factor)} = ${formatCompactNumber(t.kpi_score)}`
                          : ""}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Total row */}
              {employeeTasks.length > 0 && (
                <tr
                  style={{
                    borderTop: "2px solid var(--border)",
                    background: "var(--bg)",
                  }}
                >
                  <td
                    colSpan={3}
                    style={{
                      padding: "12px 12px",
                      fontWeight: 800,
                      fontSize: 14,
                      color: "var(--text-primary)",
                      textAlign: "right",
                    }}
                  >
                    TỔNG CỘNG
                  </td>
                  <td
                    style={{
                      padding: "12px 12px",
                      fontWeight: 800,
                      fontSize: 16,
                      color: "#f59e0b",
                    }}
                  >
                    {calcWeight.toFixed(1)}
                  </td>
                  <td colSpan={3}></td>
                  <td
                    style={{
                      padding: "12px 12px",
                      fontWeight: 800,
                      fontSize: 18,
                      color: "#a5f3fc",
                    }}
                  >
                    {calcTotal.toFixed(1)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, -45%); }
          to { opacity: 1; transform: translate(-50%, -50%); }
        }
      `}</style>
    </>
  );
}
