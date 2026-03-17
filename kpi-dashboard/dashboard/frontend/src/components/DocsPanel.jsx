const ACCENT = "#3b82f6";

function Card({ children, style = {} }) {
  return (
    <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: 24, ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9" }}>{title}</h3>
      </div>
      {subtitle && <p style={{ fontSize: 13, color: "#64748b", marginTop: 4, marginLeft: 32 }}>{subtitle}</p>}
    </div>
  );
}

function Table({ headers, rows, colColors = [] }) {
  return (
    <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #334155" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: "10px 16px", textAlign: "left", background: "#0f172a",
                color: "#94a3b8", fontWeight: 700, borderBottom: "1px solid #334155", whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "#0f172a22" }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: "9px 16px", color: colColors[ci] || "#e2e8f0",
                  borderBottom: "1px solid #1e293b", lineHeight: 1.5 }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Formula({ children }) {
  return (
    <div style={{ background: "#0f172a", border: "1px solid #3b82f644", borderRadius: 10,
      padding: "14px 20px", margin: "12px 0", fontFamily: "monospace",
      fontSize: 16, fontWeight: 700, color: "#93c5fd", textAlign: "center", letterSpacing: 0.5 }}>
      {children}
    </div>
  );
}

function Badge({ children, color = "#3b82f6" }) {
  return (
    <span style={{ background: color + "22", color, fontSize: 12, fontWeight: 700,
      padding: "2px 8px", borderRadius: 99, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function Alert({ icon, children, color = "#f59e0b" }) {
  return (
    <div style={{ background: color + "11", border: `1px solid ${color}44`, borderRadius: 8,
      padding: "10px 14px", fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, marginTop: 10 }}>
      <span style={{ marginRight: 6 }}>{icon}</span>{children}
    </div>
  );
}

export default function DocsPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── 1. Công thức tổng quan ── */}
      <Card>
        <SectionTitle icon="🧮" title="Công thức tính điểm task"
          subtitle="Áp dụng cho Dev / BA / Tester-QA — theo QUY_DINH_TINH_DIEM_KPI v3.1" />
        <Formula>Score_Task = Weight × TimeFactor × QualityFactor</Formula>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
          {[
            { name: "Weight", desc: "Độ nặng của task (điểm cơ bản). Lấy từ Points trong ClickUp hoặc tự map từ Time Estimate.", color: "#fbbf24" },
            { name: "TimeFactor", desc: "Hệ số đúng hạn. Phụ thuộc vào số ngày trễ giữa Due date và date_closed.", color: "#06b6d4" },
            { name: "QualityFactor", desc: "Hệ số chất lượng. Do Lead/Reviewer chọn khi review và đóng task.", color: "#a78bfa" },
          ].map(f => (
            <div key={f.name} style={{ flex: "1 1 220px", background: "#0f172a", borderRadius: 10,
              padding: "12px 16px", border: `1px solid ${f.color}33` }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: f.color, marginBottom: 6 }}>{f.name}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── 2. Weight ── */}
      <Card>
        <SectionTitle icon="⚖️" title="Weight — Độ nặng của task"
          subtitle="Ưu tiên lấy từ Points. Nếu không có, tự map từ Time Estimate theo thang Fibonacci." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 8, textTransform: "uppercase" }}>
              Thang Fibonacci gợi ý
            </div>
            <Table
              headers={["Time Estimate", "Weight", "Ví dụ"]}
              rows={[
                ["0.25 – 0.5h", "1", "Verify nhỏ, cập nhật minor"],
                ["0.5 – 1h",    "2", "Sửa bug nhỏ, chỉnh validation"],
                ["1 – 2h",      "3", "Thêm field, chỉnh API nhỏ"],
                ["2 – 4h",      "5", "Feature nhỏ 1 flow"],
                ["4 – 6h",      "8", "Feature vừa, nhiều case"],
                ["6 – 8h",      "13", "Task lớn — nên tách nếu có thể"],
              ]}
              colColors={["#94a3b8", "#fbbf24", "#64748b"]}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 8, textTransform: "uppercase" }}>
              Quy tắc quan trọng
            </div>
            {[
              { icon: "🔒", text: "Weight chốt ở planning, không đổi sau khi task In Progress." },
              { icon: "✂️", text: "Task >8h bắt buộc phải tách nhỏ." },
              { icon: "🚫", text: "Không chia nhỏ vô lý để tăng số task." },
              { icon: "📋", text: "Due date chỉ thay đổi trước In Progress, phải có comment + phê duyệt Lead/PM." },
            ].map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0",
                borderBottom: "1px solid #1e293b", fontSize: 13, color: "#cbd5e1" }}>
                <span>{r.icon}</span><span>{r.text}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ── 3. TimeFactor ── */}
      <Card>
        <SectionTitle icon="⏰" title="TimeFactor — Hệ số đúng hạn"
          subtitle="So sánh date_closed với due_date. Nếu không có due_date → mặc định TimeFactor = 1.0." />
        <Table
          headers={["Tình trạng", "TimeFactor", "Ý nghĩa", "Tính toán"]}
          rows={[
            ["Đúng hạn hoặc sớm",  "1.0", "Không trừ điểm",   "late_days = 0"],
            ["Trễ 1 – 2 ngày",     "0.9", "Trừ 10% điểm task", "1 ≤ late_days ≤ 2"],
            ["Trễ 3 – 5 ngày",     "0.8", "Trừ 20% điểm task", "3 ≤ late_days ≤ 5"],
            ["Trễ > 5 ngày",       "0.6", "Trừ 40% điểm task", "late_days > 5"],
          ]}
          colColors={["#94a3b8", "#06b6d4", "#64748b", "#475569"]}
        />
        <Alert icon="💡" color="#3b82f6">
          <strong>Ngoại lệ Blocked:</strong> Nếu task có nhãn <Badge color="#ef4444">Blocked</Badge> + comment + tên blocker,
          Lead/PM có thể không trừ thời gian bị kẹt vào late_days.
        </Alert>
        <Alert icon="⚠️" color="#f59e0b">
          <strong>late_days = date_closed − due_date</strong> (tính theo ngày, không tính giờ).
          Task chưa Closed (chưa có date_closed) → TimeFactor mặc định 1.0, không phản ánh thực tế.
        </Alert>
      </Card>

      {/* ── 4. QualityFactor ── */}
      <Card>
        <SectionTitle icon="🏅" title="QualityFactor — Hệ số chất lượng"
          subtitle="Do Lead/Reviewer chọn trên custom field Quality trong ClickUp khi Done/Closed. Assignee không tự chọn." />
        <Table
          headers={["Quality", "QualityFactor", "Ý nghĩa", "Ghi chú"]}
          rows={[
            ["Excellent", "1.1", "Bonus 10% — ít/không rework, đạt AC/DoD", "Làm tốt hơn yêu cầu"],
            ["Good",      "1.0", "Đạt yêu cầu, lỗi nhỏ xử lý nhanh",        "Mặc định nếu chưa chọn"],
            ["Needs Fix", "0.8", "Bị trả về/sửa lại đáng kể",               "Trừ 20% điểm"],
            ["Fail",      "0.0", "Không đạt, gần như làm lại từ đầu",        "Mất toàn bộ điểm task"],
          ]}
          colColors={["#a78bfa", "#22c55e", "#94a3b8", "#64748b"]}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
          <div>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 8, textTransform: "uppercase" }}>
              Rework Reason — Trừ đúng người
            </div>
            <Table
              headers={["Nguyên nhân", "Xử lý"]}
              rows={[
                ["Requirement change",    "Không trừ chất lượng → giữ Good"],
                ["External / Blocked",    "Không trừ trễ nếu có evidence"],
                ["Dev bug",               "Trừ Dev, không trừ BA/QA"],
                ["Missed requirement (BA)", "Trừ BA"],
                ["QA missed",             "Trừ QA"],
              ]}
              colColors={["#94a3b8", "#fbbf24"]}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Alert icon="📋" color="#a78bfa">
              <strong>Ví dụ 1 — Task thông thường:</strong><br />
              Weight=8 · Trễ 4 ngày (TimeFactor=0.8) · Quality=Good (1.0)<br />
              <span style={{ color: "#93c5fd", fontWeight: 700 }}>Score = 8 × 0.8 × 1.0 = 6.4</span>
            </Alert>
            <Alert icon="🚀" color="#22c55e">
              <strong>Ví dụ 2 — Task Blocked:</strong><br />
              Weight=13 · Blocked 7 ngày (Lead xác nhận) → TimeFactor=1.0 · Quality=Excellent (1.1)<br />
              <span style={{ color: "#86efac", fontWeight: 700 }}>Score = 13 × 1.0 × 1.1 = 14.3</span>
            </Alert>
          </div>
        </div>
      </Card>

      {/* ── 5. KPI% cá nhân ── */}
      <Card>
        <SectionTitle icon="📊" title="Tính KPI% cá nhân"
          subtitle="Tỉ lệ hoàn thành so với khối lượng được giao — công bằng dù được giao ít hay nhiều." />
        <Formula>KPI% = (Tổng Score_Task / Tổng Weight được giao) × 100</Formula>
        <Alert icon="ℹ️" color="#3b82f6">
          <strong>Tổng Weight được giao</strong> = tổng Weight của tất cả task mà người đó là Assignee <em>và</em> có Due date
          nằm trong kỳ báo cáo (dù task Done hay chưa). Task không có Due date hoặc Due date ngoài kỳ → không tính.
        </Alert>

        {/* Bảng ví dụ */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 8, textTransform: "uppercase" }}>
            Ví dụ KPI cá nhân tháng
          </div>
          <Table
            headers={["Tổng Weight giao", "Tổng Score đạt", "KPI%", "ĐHS"]}
            rows={[
              ["23", "22.1", "96.1%", "0.961"],
              ["20", "24",   "120%",  "1.200 (cap)"],
              ["15", "10",   "66.7%", "0.800 (min)"],
            ]}
            colColors={["#94a3b8", "#a5f3fc", "#fbbf24", "#22c55e"]}
          />
        </div>
      </Card>

      {/* ── 6. ĐHS ── */}
      <Card>
        <SectionTitle icon="💰" title="Quy đổi KPI% → ĐHS (0.8 – 1.2)"
          subtitle="Hệ số hiệu suất cá nhân dùng để chia thưởng." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <Formula style={{ fontSize: 13 }}>
              KPI% &lt; 80 → ĐHS = 0.8{"\n"}
              80 ≤ KPI% ≤ 120 → ĐHS = 0.8 + (KPI% − 80) × 0.01{"\n"}
              KPI% &gt; 120 → ĐHS = 1.2 (cap)
            </Formula>
            <Table
              headers={["KPI%", "ĐHS"]}
              rows={[
                ["< 80%",  "0.800 (sàn)"],
                ["80%",    "0.800"],
                ["85%",    "0.850"],
                ["96.1%",  "0.961"],
                ["100%",   "1.000"],
                ["105%",   "1.050"],
                ["> 120%", "1.200 (trần)"],
              ]}
              colColors={["#94a3b8", "#22c55e"]}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 10, textTransform: "uppercase" }}>
              Hệ số vị trí (HSVT)
            </div>
            <Table
              headers={["Vị trí", "HSVT"]}
              rows={[
                ["Project Manager", "1.5"],
                ["Business Analyst", "1.2"],
                ["Senior Dev",       "1.2"],
                ["Junior Dev",       "0.8"],
                ["QA/Tester",        "1.0"],
              ]}
              colColors={["#94a3b8", "#fbbf24"]}
            />
            <Alert icon="💡" color="#f59e0b" style={{ marginTop: 10 }}>
              <strong>Tiền thưởng cá nhân</strong> = (Quỹ thưởng / Tổng điểm team) × (HSVT × ĐHS)
            </Alert>
          </div>
        </div>
      </Card>

      {/* ── 7. Dữ liệu bắt buộc ── */}
      <Card>
        <SectionTitle icon="📋" title="Dữ liệu bắt buộc trên ClickUp"
          subtitle="Mỗi task hợp lệ cần tối thiểu các trường sau để tính được KPI." />
        <Table
          headers={["Trường", "Bắt buộc", "Ảnh hưởng điểm", "Ghi chú"]}
          rows={[
            ["Assignee",           "✅ Có",      "⚖️ Gián tiếp", "Ai chịu trách nhiệm — KPI tính theo người"],
            ["Weight / Points",    "✅ Có",      "🎯 Trực tiếp", "Nếu không có, tự map từ Time Estimate"],
            ["Time Estimate",      "Khuyến nghị","🎯 Trực tiếp", "Fallback khi không có Points"],
            ["Due date",           "✅ Có",      "🎯 Trực tiếp", "Tính TimeFactor — thiếu mặc định 1.0"],
            ["Quality",            "Khi đóng",  "🎯 Trực tiếp", "Lead/Reviewer chọn — thiếu mặc định Good=1.0"],
            ["Mô tả + tiêu chí",   "✅ Có",      "❌ Không",     "Nói rõ làm gì, xong là như thế nào"],
            ["Work Type",          "✅ Có",      "❌ Không",     "Dev / BA / QA / Leader"],
            ["Blocked/Rework Reason", "Khi phát sinh", "⚖️ Gián tiếp", "Cần comment + bằng chứng"],
          ]}
          colColors={["#e2e8f0", "#22c55e", "#a78bfa", "#64748b"]}
        />
      </Card>

      {/* ── 8. Timebox ── */}
      <Card>
        <SectionTitle icon="🕐" title="Quy định thời lượng (Timebox)"
          subtitle="Tránh task quá nhỏ (spam) hoặc quá to (khó theo dõi)." />
        <Table
          headers={["Vai trò", "Tối thiểu", "Tối đa", "Ghi chú"]}
          rows={[
            ["Dev",        "0.5h", "8h",  "Task <0.5h: gom vào Daily Support. Task >8h: bắt buộc tách."],
            ["BA",         "0.25h","8h",  "Spec lớn: tách Spec v1 / Review / Spec v2 / UAT Support."],
            ["QA/Tester",  "0.25h","6h",  "Regression/Release có thể 6–10h nhưng phải tách theo module."],
            ["Leader",     "0.25h","8h",  "Task quản trị: planning, risk, stakeholder, coaching, release."],
          ]}
          colColors={["#a78bfa", "#22c55e", "#ef4444", "#64748b"]}
        />
      </Card>

      {/* ── 9. KPI Leader ── */}
      <Card>
        <SectionTitle icon="👑" title="KPI cho Leader (Team Lead / PM)"
          subtitle="Leader tạo kết quả qua team — không chấm giống Dev/BA/QA." />
        <Formula>KPI%_Leader = 60% × KPI%_Team + 40% × KPI%_Leadership</Formula>
        <Table
          headers={["Mục Leadership", "Trọng số", "Ví dụ tiêu chí"]}
          rows={[
            ["Planning hygiene",       "25%", "Planning đúng hạn, task rõ ràng, không overload"],
            ["Quality / Release",      "25%", "Release ổn định, ít hotfix, bug production thấp"],
            ["Stakeholder management", "25%", "Phản hồi khách hàng tốt, expectation rõ ràng"],
            ["People / Coaching",      "25%", "Coaching thành viên, retention team, phát triển"],
          ]}
          colColors={["#e2e8f0", "#fbbf24", "#64748b"]}
        />
      </Card>

      {/* ── 10. API fields map ── */}
      <Card>
        <SectionTitle icon="🔌" title="Mapping API ClickUp → KPI"
          subtitle="Cách các field trong ClickUp API v2 được dùng để tính điểm." />
        <Table
          headers={["Field trong API", "Dùng để tính", "Ghi chú"]}
          rows={[
            ["task.points",          "Weight (ưu tiên 1)",         "Nếu > 0 dùng trực tiếp"],
            ["task.time_estimate",   "Weight (fallback)",           "ms → giờ → map Fibonacci"],
            ["task.due_date",        "TimeFactor (due_dt)",         "Unix ms timestamp"],
            ["task.date_closed",     "TimeFactor (closed_dt)",      "Có khi task Closed/Done"],
            ["task.custom_fields[]  name='Quality'", "QualityFactor", "Dropdown: Excellent/Good/Needs Fix/Fail"],
            ["task.assignees[].username", "KPI cá nhân",           "Có thể nhiều assignee/task"],
            ["task.status.status",   "Phân loại, lọc Closed",      "Không dùng trong công thức"],
            ["task.tags[].name",     "Phát hiện Blocked",          "Tag 'blocked' → ngoại lệ TimeFactor"],
          ]}
          colColors={["#93c5fd", "#a78bfa", "#64748b"]}
        />
        <Alert icon="🔗" color="#3b82f6">
          Endpoint: <code style={{ background: "#0f172a", padding: "2px 6px", borderRadius: 4, color: "#93c5fd" }}>
            GET /api/v2/list/{"{list_id}"}/task?include_closed=true&include_subtasks=true&page={"{n}"}
          </code>
        </Alert>
      </Card>

      {/* Footer */}
      <div style={{ textAlign: "center", fontSize: 12, color: "#334155", padding: "8px 0" }}>
        Tài liệu tham chiếu: QUY_DINH_TINH_DIEM_KPI_TREN_CLICKUP_Final.pdf · Phiên bản v3.1
      </div>
    </div>
  );
}
