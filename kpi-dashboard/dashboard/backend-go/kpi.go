package main

import (
	"fmt"
	"math"
	"strings"
	"time"
)

// ── TaskRow: dữ liệu đã được flatten ─────────────────────────────────────────

type TaskRow struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Status      string   `json:"status"`
	StatusType  string   `json:"status_type"`
	Priority    string   `json:"priority"`
	Team        string   `json:"team"`
	Space       string   `json:"space"`
	Folder      string   `json:"folder"`
	List        string   `json:"list"`
	Assignees   []string `json:"assignees"`
	Tags        []string `json:"tags"`
	Creator     string   `json:"creator"`
	ParentID    string   `json:"parent_id"`
	URL         string   `json:"url"`

	DateCreated       string  `json:"date_created"`
	DateUpdated       string  `json:"date_updated"`
	DateClosed        string  `json:"date_closed"`
	DueDate           string  `json:"due_date"`
	StartDate         string  `json:"start_date"`
	TimeEstimateHours float64 `json:"time_estimate_hours,omitempty"`
	TimeSpentHours    float64 `json:"time_spent_hours,omitempty"`

	// KPI
	KpiWeight        interface{} `json:"kpi_weight"`
	KpiWeightSource  string      `json:"kpi_weight_source"`
	KpiLateDays      int         `json:"kpi_late_days"`
	KpiTimeFactor    float64     `json:"kpi_time_factor"`
	KpiQualityLabel  string      `json:"kpi_quality_label"`
	KpiQualityFactor float64     `json:"kpi_quality_factor"`
	KpiScore         interface{} `json:"kpi_score"` // nil nếu không tính được

	// Custom fields (dynamic)
	CustomFields map[string]interface{} `json:"cf,omitempty"`
}

// ── Estimate → Weight (Fibonacci) ────────────────────────────────────────────

func estimateToWeight(hours float64) float64 {
	switch {
	case hours <= 0:
		return 0
	case hours <= 0.5:
		return 1
	case hours <= 1.0:
		return 2
	case hours <= 2.0:
		return 3
	case hours <= 4.0:
		return 5
	case hours <= 6.0:
		return 8
	default:
		return 13 // ≥6h, nên tách
	}
}

// ── Quality resolve ───────────────────────────────────────────────────────────

var qualityMap = map[string]float64{
	"excellent": 1.1,
	"good":      1.0,
	"needs fix": 0.8,
	"needsfix":  0.8,
	"needs_fix": 0.8,
	"fail":      0.0,
}

var numericQualityMap = map[float64]string{
	1.1: "excellent",
	1.0: "good",
	0.8: "needs fix",
	0.0: "fail",
}

func resolveQuality(cfs []CUCustomField) (label string, factor float64) {
	factor = 1.0 // default Good
	for _, cf := range cfs {
		if !strings.EqualFold(cf.Name, "quality") {
			continue
		}
		if cf.Value == nil || cf.Value == "" {
			break
		}
		switch cf.Type {
		case "drop_down", "labels":
			label = strings.ToLower(resolveDropdown(cf))
		default:
			label = strings.ToLower(strings.TrimSpace(fmt.Sprintf("%v", cf.Value)))
		}
		// Fallback: nếu label là số (1.0, 1.1...) → dùng numericQualityMap
		if _, ok := qualityMap[label]; !ok {
			if f := parseFloat(cf.Value); f > 0 {
				rounded := math.Round(f*10) / 10
				if name, ok := numericQualityMap[rounded]; ok {
					label = name
				}
			}
		}
		break
	}
	if f, ok := qualityMap[label]; ok {
		factor = f
	}
	return
}

// ── Build TaskRow từ CUTask ───────────────────────────────────────────────────

func buildTaskRow(t CUTask, lst CUList, weekStart, weekEnd time.Time) TaskRow {
	row := TaskRow{
		ID:          t.ID,
		Name:        t.Name,
		Description: strings.TrimSpace(t.Description),
		Status:      t.Status.Status,
		StatusType:  t.Status.Type,
		Team:        lst.TeamName,
		Space:       lst.SpaceName,
		Folder:      lst.FolderName,
		List:        lst.Name,
		URL:         t.URL,
	}

	if t.Priority != nil {
		row.Priority = t.Priority.Priority
	}
	if t.Creator != nil {
		row.Creator = t.Creator.Username
	}
	if t.Parent != nil {
		row.ParentID = fmt.Sprintf("%v", t.Parent)
	}

	for _, a := range t.Assignees {
		if a.Username != "" {
			row.Assignees = append(row.Assignees, a.Username)
		}
	}
	for _, tag := range t.Tags {
		if tag.Name != "" {
			row.Tags = append(row.Tags, tag.Name)
		}
	}

	// Timestamps
	row.DateCreated = formatTime(tsToTime(t.DateCreated))
	row.DateUpdated = formatTime(tsToTime(t.DateUpdated))
	row.DateClosed = formatTime(tsToTime(t.DateClosed))
	row.DueDate = formatTime(tsToTime(t.DueDate))
	row.StartDate = formatTime(tsToTime(t.StartDate))

	// Time estimate / spent (ms → hours)
	if te := parseFloat(t.TimeEstimate); te > 0 {
		row.TimeEstimateHours = math.Round(te/3600000*100) / 100
	}
	if ts := parseFloat(t.TimeSpent); ts > 0 {
		row.TimeSpentHours = math.Round(ts/3600000*100) / 100
	}

	// ── Weight ────────────────────────────────────────────────────────────────
	var weight float64
	if pts := parseFloat(t.Points); pts > 0 {
		weight = pts
		row.KpiWeightSource = "points"
	} else if row.TimeEstimateHours > 0 {
		if w := estimateToWeight(row.TimeEstimateHours); w > 0 {
			weight = w
			row.KpiWeightSource = "time_estimate"
		}
	}
	if weight > 0 {
		row.KpiWeight = weight
	}

	// ── TimeFactor ────────────────────────────────────────────────────────────
	row.KpiTimeFactor = 1.0
	dueT := tsToTime(t.DueDate)
	closedT := tsToTime(t.DateClosed)
	if dueT != nil && closedT != nil {
		loc, _ := time.LoadLocation("Asia/Ho_Chi_Minh")
		dueDt := dueT.In(loc).Truncate(24 * time.Hour)
		closedDt := closedT.In(loc).Truncate(24 * time.Hour)
		lateDays := int(math.Max(0, closedDt.Sub(dueDt).Hours()/24))
		row.KpiLateDays = lateDays
		switch {
		case lateDays == 0:
			row.KpiTimeFactor = 1.0
		case lateDays <= 2:
			row.KpiTimeFactor = 0.9
		case lateDays <= 5:
			row.KpiTimeFactor = 0.8
		default:
			row.KpiTimeFactor = 0.6
		}
	}

	// ── QualityFactor ─────────────────────────────────────────────────────────
	row.KpiQualityLabel, row.KpiQualityFactor = resolveQuality(t.CustomFields)

	// ── Score ─────────────────────────────────────────────────────────────────
	if weight > 0 {
		score := math.Round(weight*row.KpiTimeFactor*row.KpiQualityFactor*1000) / 1000
		row.KpiScore = score
	}

	// ── Custom fields (flatten) ───────────────────────────────────────────────
	cfMap := map[string]interface{}{}
	for _, cf := range t.CustomFields {
		if cf.Value == nil || cf.Value == "" {
			continue
		}
		key := "cf_" + cf.Name
		switch cf.Type {
		case "drop_down", "labels":
			cfMap[key] = resolveDropdown(cf)
		case "date":
			cfMap[key] = formatTime(tsToTime(fmt.Sprintf("%v", cf.Value)))
		default:
			cfMap[key] = cf.Value
		}
	}
	if len(cfMap) > 0 {
		row.CustomFields = cfMap
	}

	return row
}

// ── KPI per assignee ──────────────────────────────────────────────────────────

type AssigneeKPI struct {
	Assignee    string   `json:"assignee"`
	TotalWeight float64  `json:"total_weight"`
	TotalScore  float64  `json:"total_score"`
	TasksTotal  int      `json:"tasks_total"`
	TasksScored int      `json:"tasks_scored"`
	TasksOnTime int      `json:"tasks_on_time"`
	TasksLate   int      `json:"tasks_late"`
	TasksClosed int      `json:"tasks_closed"`
	KpiPct      *float64 `json:"kpi_pct"`
	DHS         *float64 `json:"dhs"`
}

func calcKpiByAssignee(tasks []TaskRow) []AssigneeKPI {
	people := map[string]*AssigneeKPI{}

	for _, t := range tasks {
		for _, a := range t.Assignees {
			if a == "" {
				continue
			}
			if _, ok := people[a]; !ok {
				people[a] = &AssigneeKPI{Assignee: a}
			}
			p := people[a]
			p.TasksTotal++
			if t.DateClosed != "" {
				p.TasksClosed++
			}
			w, _ := t.KpiWeight.(float64)
			s, _ := t.KpiScore.(float64)
			if w > 0 {
				p.TotalWeight += w
			}
			if t.KpiScore != nil {
				p.TotalScore += s
				p.TasksScored++
				if t.KpiLateDays == 0 {
					p.TasksOnTime++
				} else {
					p.TasksLate++
				}
			}
		}
	}

	result := make([]AssigneeKPI, 0, len(people))
	for _, p := range people {
		if p.TotalWeight > 0 {
			pct := math.Round((p.TotalScore/p.TotalWeight)*1000) / 10
			p.KpiPct = &pct
			var dhs float64
			switch {
			case pct < 80:
				dhs = 0.8
			case pct > 120:
				dhs = 1.2
			default:
				dhs = math.Round((0.8+(pct-80)*0.01)*1000) / 1000
			}
			p.DHS = &dhs
		}
		result = append(result, *p)
	}
	// Sort: KPI% cao nhất trước
	for i := 0; i < len(result)-1; i++ {
		for j := i + 1; j < len(result); j++ {
			ai, aj := 0.0, 0.0
			if result[i].KpiPct != nil {
				ai = *result[i].KpiPct
			}
			if result[j].KpiPct != nil {
				aj = *result[j].KpiPct
			}
			if aj > ai {
				result[i], result[j] = result[j], result[i]
			}
		}
	}
	return result
}

// ── Stats ─────────────────────────────────────────────────────────────────────

type StatsResponse struct {
	TotalTasks     int            `json:"total_tasks"`
	TotalScored    int            `json:"total_scored"`
	TotalClosed    int            `json:"total_closed"`
	OnTimeCount    int            `json:"on_time_count"`
	LateCount      int            `json:"late_count"`
	OnTimeRate     float64        `json:"on_time_rate"`
	TeamKpiPct     *float64       `json:"team_kpi_pct"`
	StatusDist     map[string]int `json:"status_dist"`
	TimeFactorDist map[string]int `json:"time_factor_dist"`
	QualityDist    map[string]int `json:"quality_dist"`
	WeekLabel      string         `json:"week_label"`
	FetchedAt      string         `json:"fetched_at"`
}

func calcStats(tasks []TaskRow, fetchedAt string, weekStart, weekEnd time.Time) StatsResponse {
	loc, _ := time.LoadLocation("Asia/Ho_Chi_Minh")
	weekLabel := fmt.Sprintf("%s – %s",
		weekStart.In(loc).Format("02/01/2006"),
		weekEnd.In(loc).Format("02/01/2006"),
	)

	s := StatsResponse{
		TotalTasks:     len(tasks),
		StatusDist:     map[string]int{},
		TimeFactorDist: map[string]int{"1": 0, "0.9": 0, "0.8": 0, "0.6": 0},
		QualityDist:    map[string]int{},
		WeekLabel:      weekLabel,
		FetchedAt:      fetchedAt,
	}

	var totalW, totalScore float64
	for _, t := range tasks {
		s.StatusDist[t.Status]++
		if t.DateClosed != "" {
			s.TotalClosed++
		}
		if t.KpiScore != nil {
			s.TotalScored++
			score, _ := t.KpiScore.(float64)
			w, _ := t.KpiWeight.(float64)
			totalScore += score
			totalW += w

			tf := fmt.Sprintf("%g", t.KpiTimeFactor)
			s.TimeFactorDist[tf]++

			ql := t.KpiQualityLabel
			if ql == "" {
				ql = "unset"
			}
			s.QualityDist[ql]++

			if t.KpiLateDays == 0 && t.DateClosed != "" {
				s.OnTimeCount++
			} else if t.KpiLateDays > 0 && t.DateClosed != "" {
				s.LateCount++
			}
		}
	}

	if s.TotalClosed > 0 {
		s.OnTimeRate = math.Round(float64(s.OnTimeCount)/float64(s.TotalClosed)*1000) / 10
	}
	if totalW > 0 {
		pct := math.Round(totalScore/totalW*1000) / 10
		s.TeamKpiPct = &pct
	}
	return s
}

// ── Compliance ────────────────────────────────────────────────────────────────

type ComplianceRule struct {
	Key          string
	Label        string
	Icon         string
	Severity     string
	AffectsScore bool
	Hint         string
	OnlyClosed   bool
	Check        func(t TaskRow) bool
}

var complianceRules = []ComplianceRule{
	{
		Key: "missing_weight", Label: "Thiếu Weight/Points", Icon: "⚖️",
		Severity: "critical", AffectsScore: true, OnlyClosed: false,
		Hint:  "Score_Task = Weight × TimeFactor × QualityFactor — không có Weight thì không tính được điểm",
		Check: func(t TaskRow) bool { return t.KpiWeight == nil },
	},
	{
		Key: "missing_due_date", Label: "Thiếu Due date", Icon: "📅",
		Severity: "critical", AffectsScore: true, OnlyClosed: false,
		Hint:  "TimeFactor phụ thuộc vào Due date — thiếu thì mặc định TimeFactor = 1.0",
		Check: func(t TaskRow) bool { return t.DueDate == "" },
	},
	{
		Key: "missing_quality", Label: "Thiếu Quality (task Closed chưa review)", Icon: "🏅",
		Severity: "critical", AffectsScore: true, OnlyClosed: true,
		Hint:  "QualityFactor: Excellent=1.1 / Good=1.0 / Needs Fix=0.8 / Fail=0.0",
		Check: func(t TaskRow) bool { return t.KpiQualityLabel == "" },
	},
	{
		Key: "no_time_estimate", Label: "Thiếu Time Estimate (dùng để suy ra Weight)", Icon: "⏱️",
		Severity: "warning", AffectsScore: true, OnlyClosed: false,
		Hint:  "Khi không có Points, Weight được map tự động từ Time Estimate",
		Check: func(t TaskRow) bool { return t.KpiWeight == nil },
	},
	{
		Key: "oversize_task", Label: "Task >8h — nên tách nhỏ", Icon: "✂️",
		Severity: "info", AffectsScore: true, OnlyClosed: false,
		Hint:  "Task >8h bị gán Weight tối đa = 13 và khó theo dõi đúng hạn",
		Check: func(t TaskRow) bool { return t.TimeEstimateHours > 8 },
	},
	{
		Key: "missing_assignee", Label: "Thiếu Assignee", Icon: "👤",
		Severity: "critical", AffectsScore: false, OnlyClosed: false,
		Hint:  "Không biết ai chịu trách nhiệm — KPI không tính được cho cá nhân",
		Check: func(t TaskRow) bool { return len(t.Assignees) == 0 },
	},
	{
		Key: "missing_description", Label: "Thiếu Mô tả / Tiêu chí nghiệm thu", Icon: "📝",
		Severity: "warning", AffectsScore: false, OnlyClosed: false,
		Hint:  "Mục 3 tài liệu: bắt buộc có mô tả rõ làm gì, xong là như thế nào",
		Check: func(t TaskRow) bool { return strings.TrimSpace(t.Description) == "" },
	},
}

type RuleSummary struct {
	Key          string  `json:"key"`
	Label        string  `json:"label"`
	Icon         string  `json:"icon"`
	Severity     string  `json:"severity"`
	AffectsScore bool    `json:"affects_score"`
	Hint         string  `json:"hint"`
	Count        int     `json:"count"`
	Applicable   int     `json:"applicable"`
	Rate         float64 `json:"rate"`
}

type IssueMissing struct {
	Key          string `json:"key"`
	Label        string `json:"label"`
	Icon         string `json:"icon"`
	Severity     string `json:"severity"`
	AffectsScore bool   `json:"affects_score"`
	Hint         string `json:"hint"`
}

type TaskIssue struct {
	ID                string         `json:"id"`
	Name              string         `json:"name"`
	URL               string         `json:"url"`
	Status            string         `json:"status"`
	Assignees         []string       `json:"assignees"`
	List              string         `json:"list"`
	Missing           []IssueMissing `json:"missing"`
	ScoreBlocked      bool           `json:"score_blocked"`
	ScoreBlockerCount int            `json:"score_blocker_count"`
	CriticalCount     int            `json:"critical_count"`
	WarningCount      int            `json:"warning_count"`
}

type CleanTask struct {
	ID               string      `json:"id"`
	Name             string      `json:"name"`
	URL              string      `json:"url"`
	Status           string      `json:"status"`
	Assignees        []string    `json:"assignees"`
	List             string      `json:"list"`
	DueDate          string      `json:"due_date"`
	DateClosed       string      `json:"date_closed"`
	KpiWeight        interface{} `json:"kpi_weight"`
	KpiWeightSource  string      `json:"kpi_weight_source"`
	KpiTimeFactor    float64     `json:"kpi_time_factor"`
	KpiLateDays      int         `json:"kpi_late_days"`
	KpiQualityLabel  string      `json:"kpi_quality_label"`
	KpiQualityFactor float64     `json:"kpi_quality_factor"`
	KpiScore         interface{} `json:"kpi_score"`
}

type ComplianceResponse struct {
	TotalTasks      int           `json:"total_tasks"`
	TasksWithIssues int           `json:"tasks_with_issues"`
	TasksClean      int           `json:"tasks_clean"`
	ComplianceRate  float64       `json:"compliance_rate"`
	Summary         []RuleSummary `json:"summary"`
	TaskIssues      []TaskIssue   `json:"task_issues"`
	CleanTasks      []CleanTask   `json:"clean_tasks"`
}

func calcCompliance(tasks []TaskRow) ComplianceResponse {
	total := len(tasks)

	// Summary
	summary := make([]RuleSummary, 0, len(complianceRules))
	for _, rule := range complianceRules {
		count, applicable := 0, 0
		for _, t := range tasks {
			if rule.OnlyClosed && t.DateClosed == "" {
				continue
			}
			applicable++
			if rule.Check(t) {
				count++
			}
		}
		rate := 0.0
		if applicable > 0 {
			rate = math.Round(float64(count)/float64(applicable)*1000) / 10
		}
		summary = append(summary, RuleSummary{
			Key: rule.Key, Label: rule.Label, Icon: rule.Icon,
			Severity: rule.Severity, AffectsScore: rule.AffectsScore, Hint: rule.Hint,
			Count: count, Applicable: applicable, Rate: rate,
		})
	}

	// Task issues
	var taskIssues []TaskIssue
	for _, t := range tasks {
		var missing []IssueMissing
		for _, rule := range complianceRules {
			if rule.OnlyClosed && t.DateClosed == "" {
				continue
			}
			if rule.Check(t) {
				missing = append(missing, IssueMissing{
					Key: rule.Key, Label: rule.Label, Icon: rule.Icon,
					Severity: rule.Severity, AffectsScore: rule.AffectsScore, Hint: rule.Hint,
				})
			}
		}
		if len(missing) == 0 {
			continue
		}
		issue := TaskIssue{
			ID: t.ID, Name: t.Name, URL: t.URL,
			Status: t.Status, Assignees: t.Assignees, List: t.List,
			Missing: missing,
		}
		for _, m := range missing {
			if m.Severity == "critical" {
				issue.CriticalCount++
			}
			if m.Severity == "warning" {
				issue.WarningCount++
			}
			if m.AffectsScore {
				issue.ScoreBlockerCount++
			}
		}
		issue.ScoreBlocked = issue.ScoreBlockerCount > 0
		taskIssues = append(taskIssues, issue)
	}
	// Sort: critical nhiều nhất trước
	for i := 0; i < len(taskIssues)-1; i++ {
		for j := i + 1; j < len(taskIssues); j++ {
			if taskIssues[j].CriticalCount > taskIssues[i].CriticalCount {
				taskIssues[i], taskIssues[j] = taskIssues[j], taskIssues[i]
			}
		}
	}

	// Clean tasks = có kpi_score tính được
	var cleanTasks []CleanTask
	for _, t := range tasks {
		if t.KpiScore == nil {
			continue
		}
		cleanTasks = append(cleanTasks, CleanTask{
			ID: t.ID, Name: t.Name, URL: t.URL, Status: t.Status,
			Assignees: t.Assignees, List: t.List, DueDate: t.DueDate, DateClosed: t.DateClosed,
			KpiWeight: t.KpiWeight, KpiWeightSource: t.KpiWeightSource,
			KpiTimeFactor: t.KpiTimeFactor, KpiLateDays: t.KpiLateDays,
			KpiQualityLabel: t.KpiQualityLabel, KpiQualityFactor: t.KpiQualityFactor,
			KpiScore: t.KpiScore,
		})
	}

	cleanCount := len(cleanTasks)
	compRate := 0.0
	if total > 0 {
		compRate = math.Round(float64(cleanCount)/float64(total)*1000) / 10
	}

	return ComplianceResponse{
		TotalTasks: total, TasksWithIssues: len(taskIssues), TasksClean: cleanCount,
		ComplianceRate: compRate, Summary: summary,
		TaskIssues: taskIssues, CleanTasks: cleanTasks,
	}
}
