-- KPI Dashboard – PostgreSQL schema
-- Tự động chạy khi container Postgres khởi động lần đầu

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
    started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at  TIMESTAMPTZ,
    error_msg    TEXT        DEFAULT '',
    status       TEXT        DEFAULT 'running'
);
