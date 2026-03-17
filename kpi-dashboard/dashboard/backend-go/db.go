package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var dbPool *pgxpool.Pool

// ── Kết nối DB ────────────────────────────────────────────────────────────────

func initDB() error {
	dsn := os.Getenv("DB_URL")
	if dsn == "" {
		dsn = "postgres://kpi:kpi123@localhost:5432/kpi_dashboard?sslmode=disable"
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return fmt.Errorf("parse DB URL: %w", err)
	}
	cfg.MaxConns = 10
	pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		return fmt.Errorf("connect DB: %w", err)
	}
	if err := pool.Ping(context.Background()); err != nil {
		return fmt.Errorf("ping DB: %w", err)
	}
	dbPool = pool
	log.Println("[db] Kết nối PostgreSQL thành công")
	return nil
}

// ── Schema migration ──────────────────────────────────────────────────────────

func migrateDB() error {
	_, err := dbPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS tasks (
			id                   TEXT PRIMARY KEY,
			name                 TEXT    NOT NULL DEFAULT '',
			description          TEXT    DEFAULT '',
			status               TEXT    DEFAULT '',
			status_type          TEXT    DEFAULT '',
			priority             TEXT    DEFAULT '',
			team                 TEXT    DEFAULT '',
			space                TEXT    DEFAULT '',
			folder               TEXT    DEFAULT '',
			list_name            TEXT    DEFAULT '',
			assignees            TEXT[]  DEFAULT '{}',
			tags                 TEXT[]  DEFAULT '{}',
			creator              TEXT    DEFAULT '',
			parent_id            TEXT    DEFAULT '',
			url                  TEXT    DEFAULT '',
			date_created         TEXT    DEFAULT '',
			date_updated         TEXT    DEFAULT '',
			date_closed          TEXT    DEFAULT '',
			due_date             TEXT    DEFAULT '',
			start_date           TEXT    DEFAULT '',
			time_estimate_hours  DOUBLE PRECISION DEFAULT 0,
			time_spent_hours     DOUBLE PRECISION DEFAULT 0,
			kpi_weight           DOUBLE PRECISION,
			kpi_weight_source    TEXT    DEFAULT '',
			kpi_late_days        INT     DEFAULT 0,
			kpi_time_factor      DOUBLE PRECISION DEFAULT 1.0,
			kpi_quality_label    TEXT    DEFAULT '',
			kpi_quality_factor   DOUBLE PRECISION DEFAULT 1.0,
			kpi_score            DOUBLE PRECISION,
			custom_fields        JSONB   DEFAULT '{}',
			first_seen_week      DATE,
			last_synced_at       TIMESTAMPTZ DEFAULT NOW()
		);

		CREATE INDEX IF NOT EXISTS idx_tasks_due_date    ON tasks(due_date);
		CREATE INDEX IF NOT EXISTS idx_tasks_date_closed ON tasks(date_closed);
		CREATE INDEX IF NOT EXISTS idx_tasks_status      ON tasks(status);
		CREATE INDEX IF NOT EXISTS idx_tasks_assignees   ON tasks USING GIN(assignees);
		CREATE INDEX IF NOT EXISTS idx_tasks_last_synced ON tasks(last_synced_at);

		CREATE TABLE IF NOT EXISTS sync_log (
			id           SERIAL PRIMARY KEY,
			sync_type    TEXT        NOT NULL,
			week_start   DATE,
			week_end     DATE,
			task_count   INT         DEFAULT 0,
			started_at   TIMESTAMPTZ NOT NULL,
			finished_at  TIMESTAMPTZ,
			error_msg    TEXT        DEFAULT '',
			status       TEXT        DEFAULT 'running'
		);
	`)
	if err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	log.Println("[db] Schema migration OK")
	return nil
}

// ── Upsert tasks ──────────────────────────────────────────────────────────────

func upsertTasks(tasks []TaskRow, weekStart time.Time) error {
	ctx := context.Background()
	batch := &pgx.Batch{}

	for _, t := range tasks {
		cfJSON, _ := json.Marshal(t.CustomFields)
		assignees := t.Assignees
		if assignees == nil {
			assignees = []string{}
		}
		tags := t.Tags
		if tags == nil {
			tags = []string{}
		}

		var kpiWeight *float64
		if w, ok := t.KpiWeight.(float64); ok && w > 0 {
			kpiWeight = &w
		}
		var kpiScore *float64
		if s, ok := t.KpiScore.(float64); ok {
			kpiScore = &s
		}

		batch.Queue(`
			INSERT INTO tasks (
				id, name, description, status, status_type, priority,
				team, space, folder, list_name,
				assignees, tags, creator, parent_id, url,
				date_created, date_updated, date_closed, due_date, start_date,
				time_estimate_hours, time_spent_hours,
				kpi_weight, kpi_weight_source, kpi_late_days,
				kpi_time_factor, kpi_quality_label, kpi_quality_factor, kpi_score,
				custom_fields, first_seen_week, last_synced_at
			) VALUES (
				$1,$2,$3,$4,$5,$6,
				$7,$8,$9,$10,
				$11,$12,$13,$14,$15,
				$16,$17,$18,$19,$20,
				$21,$22,
				$23,$24,$25,
				$26,$27,$28,$29,
				$30,$31,NOW()
			)
			ON CONFLICT (id) DO UPDATE SET
				name                = EXCLUDED.name,
				description         = EXCLUDED.description,
				status              = EXCLUDED.status,
				status_type         = EXCLUDED.status_type,
				priority            = EXCLUDED.priority,
				team                = EXCLUDED.team,
				space               = EXCLUDED.space,
				folder              = EXCLUDED.folder,
				list_name           = EXCLUDED.list_name,
				assignees           = EXCLUDED.assignees,
				tags                = EXCLUDED.tags,
				date_updated        = EXCLUDED.date_updated,
				date_closed         = EXCLUDED.date_closed,
				due_date            = EXCLUDED.due_date,
				time_estimate_hours = EXCLUDED.time_estimate_hours,
				time_spent_hours    = EXCLUDED.time_spent_hours,
				kpi_weight          = EXCLUDED.kpi_weight,
				kpi_weight_source   = EXCLUDED.kpi_weight_source,
				kpi_late_days       = EXCLUDED.kpi_late_days,
				kpi_time_factor     = EXCLUDED.kpi_time_factor,
				kpi_quality_label   = EXCLUDED.kpi_quality_label,
				kpi_quality_factor  = EXCLUDED.kpi_quality_factor,
				kpi_score           = EXCLUDED.kpi_score,
				custom_fields       = EXCLUDED.custom_fields,
				last_synced_at      = NOW()
		`,
			t.ID, t.Name, t.Description, t.Status, t.StatusType, t.Priority,
			t.Team, t.Space, t.Folder, t.List,
			assignees, tags, t.Creator, t.ParentID, t.URL,
			t.DateCreated, t.DateUpdated, t.DateClosed, t.DueDate, t.StartDate,
			t.TimeEstimateHours, t.TimeSpentHours,
			kpiWeight, t.KpiWeightSource, t.KpiLateDays,
			t.KpiTimeFactor, t.KpiQualityLabel, t.KpiQualityFactor, kpiScore,
			string(cfJSON), weekStart.Format("2006-01-02"),
		)
	}

	br := dbPool.SendBatch(ctx, batch)
	defer br.Close()
	for range tasks {
		if _, err := br.Exec(); err != nil {
			log.Printf("[db] upsert error: %v", err)
		}
	}
	return nil
}

// ── Load tasks from DB (theo tuần) ───────────────────────────────────────────

func loadTasksFromDB(weekStart, weekEnd time.Time) ([]TaskRow, error) {
	ctx := context.Background()
	rows, err := dbPool.Query(ctx, `
		SELECT
			id, name, description, status, status_type, priority,
			team, space, folder, list_name,
			assignees, tags, creator, parent_id, url,
			date_created, date_updated, date_closed, due_date, start_date,
			time_estimate_hours, time_spent_hours,
			kpi_weight, kpi_weight_source, kpi_late_days,
			kpi_time_factor, kpi_quality_label, kpi_quality_factor, kpi_score,
			custom_fields
		FROM tasks
		WHERE last_synced_at >= $1
		ORDER BY last_synced_at DESC
	`, weekStart)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanTaskRows(rows)
}

// ── Load ALL tasks từ DB ──────────────────────────────────────────────────────

func loadAllTasksFromDB() ([]TaskRow, error) {
	ctx := context.Background()
	rows, err := dbPool.Query(ctx, `
		SELECT
			id, name, description, status, status_type, priority,
			team, space, folder, list_name,
			assignees, tags, creator, parent_id, url,
			date_created, date_updated, date_closed, due_date, start_date,
			time_estimate_hours, time_spent_hours,
			kpi_weight, kpi_weight_source, kpi_late_days,
			kpi_time_factor, kpi_quality_label, kpi_quality_factor, kpi_score,
			custom_fields
		FROM tasks
		ORDER BY last_synced_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanTaskRows(rows)
}

func scanTaskRows(rows pgx.Rows) ([]TaskRow, error) {
	var result []TaskRow
	for rows.Next() {
		var t TaskRow
		var cfRaw []byte
		var kpiWeight, kpiScore *float64
		var assignees, tags []string

		err := rows.Scan(
			&t.ID, &t.Name, &t.Description, &t.Status, &t.StatusType, &t.Priority,
			&t.Team, &t.Space, &t.Folder, &t.List,
			&assignees, &tags, &t.Creator, &t.ParentID, &t.URL,
			&t.DateCreated, &t.DateUpdated, &t.DateClosed, &t.DueDate, &t.StartDate,
			&t.TimeEstimateHours, &t.TimeSpentHours,
			&kpiWeight, &t.KpiWeightSource, &t.KpiLateDays,
			&t.KpiTimeFactor, &t.KpiQualityLabel, &t.KpiQualityFactor, &kpiScore,
			&cfRaw,
		)
		if err != nil {
			log.Printf("[db] scan error: %v", err)
			continue
		}
		t.Assignees = assignees
		t.Tags = tags
		if kpiWeight != nil { t.KpiWeight = *kpiWeight }
		if kpiScore != nil  { t.KpiScore  = *kpiScore }
		if len(cfRaw) > 0 {
			json.Unmarshal(cfRaw, &t.CustomFields)
		}
		result = append(result, t)
	}
	return result, rows.Err()
}

// ── Sync log ──────────────────────────────────────────────────────────────────

func logSyncStart(syncType string, ws, we time.Time) int {
	var id int
	dbPool.QueryRow(context.Background(), `
		INSERT INTO sync_log (sync_type, week_start, week_end, started_at, status)
		VALUES ($1, $2, $3, NOW(), 'running') RETURNING id
	`, syncType, ws.Format("2006-01-02"), we.Format("2006-01-02")).Scan(&id)
	return id
}

func logSyncDone(id, count int, errMsg string) {
	status := "success"
	if errMsg != "" { status = "error" }
	dbPool.Exec(context.Background(), `
		UPDATE sync_log
		SET finished_at=NOW(), task_count=$1, status=$2, error_msg=$3
		WHERE id=$4
	`, count, status, errMsg, id)
}

// ── Đếm task trong DB ─────────────────────────────────────────────────────────

func countTasksInDB() int {
	var n int
	dbPool.QueryRow(context.Background(), "SELECT COUNT(*) FROM tasks").Scan(&n)
	return n
}

// ── Sync history ──────────────────────────────────────────────────────────────

type SyncLogEntry struct {
	ID         int    `json:"id"`
	SyncType   string `json:"sync_type"`
	WeekStart  string `json:"week_start"`
	WeekEnd    string `json:"week_end"`
	TaskCount  int    `json:"task_count"`
	StartedAt  string `json:"started_at"`
	FinishedAt string `json:"finished_at"`
	Status     string `json:"status"`
	ErrorMsg   string `json:"error_msg"`
}

func querySyncHistory() ([]SyncLogEntry, error) {
	rows, err := dbPool.Query(context.Background(), `
		SELECT id, sync_type,
			COALESCE(week_start::TEXT,''), COALESCE(week_end::TEXT,''),
			task_count,
			TO_CHAR(started_at  AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS'),
			TO_CHAR(finished_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS'),
			status, error_msg
		FROM sync_log ORDER BY started_at DESC LIMIT 50
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []SyncLogEntry
	for rows.Next() {
		var e SyncLogEntry
		rows.Scan(&e.ID, &e.SyncType, &e.WeekStart, &e.WeekEnd,
			&e.TaskCount, &e.StartedAt, &e.FinishedAt, &e.Status, &e.ErrorMsg)
		result = append(result, e)
	}
	return result, nil
}
