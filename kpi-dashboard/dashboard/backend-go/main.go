package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"
)

// ── In-memory cache ───────────────────────────────────────────────────────────

type Cache struct {
	mu        sync.RWMutex
	tasks     []TaskRow
	fetchedAt string
	weekStart time.Time
	weekEnd   time.Time
	isLoading bool
}

var cache = &Cache{}

func (c *Cache) get() ([]TaskRow, string, time.Time, time.Time) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.tasks, c.fetchedAt, c.weekStart, c.weekEnd
}

func (c *Cache) set(tasks []TaskRow, ws, we time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.tasks = tasks
	c.fetchedAt = time.Now().Format("2006-01-02 15:04:05")
	c.weekStart = ws
	c.weekEnd = we
	c.isLoading = false
}

// ── Refresh: fetch tuần hiện tại → upsert DB → update cache ──────────────────

func refreshCache() {
	cache.mu.Lock()
	if cache.isLoading {
		cache.mu.Unlock()
		log.Println("[scheduler] Đang load, bỏ qua")
		return
	}
	cache.isLoading = true
	cache.mu.Unlock()

	ws, we := WeekBounds(time.Now())
	loc, _ := time.LoadLocation("Asia/Ho_Chi_Minh")
	log.Printf("[fetch] Tuần %s – %s",
		ws.In(loc).Format("02/01/2006"), we.In(loc).Format("02/01/2006"))

	syncID := logSyncStart("weekly", ws, we)

	tasks, err := fetchAllTasksForWeek(ws, we)
	if err != nil {
		log.Printf("[fetch] Lỗi: %v", err)
		logSyncDone(syncID, 0, err.Error())
		cache.mu.Lock()
		cache.isLoading = false
		cache.mu.Unlock()
		return
	}

	// Lưu vào DB (upsert)
	if dbPool != nil {
		if err := upsertTasks(tasks, ws); err != nil {
			log.Printf("[db] upsert error: %v", err)
		}
		// Reload toàn bộ từ DB vào cache để dashboard luôn thấy đủ dữ liệu
		if all, err := loadAllTasksFromDB(); err == nil {
			cache.set(all, ws, we)
			logSyncDone(syncID, len(all), "")
			log.Printf("[fetch] Xong: %d tasks tuần → cache %d tasks tổng từ DB", len(tasks), len(all))
			return
		}
	}

	cache.set(tasks, ws, we)
	logSyncDone(syncID, len(tasks), "")
	log.Printf("[fetch] Xong: %d tasks → DB updated", len(tasks))
}

// ── Full sync: kéo TẤT CẢ tasks (không filter ngày) ─────────────────────────

func fullSync() {
	cache.mu.Lock()
	if cache.isLoading {
		cache.mu.Unlock()
		log.Println("[fullsync] Đang load, bỏ qua")
		return
	}
	cache.isLoading = true
	cache.mu.Unlock()

	log.Println("[fullsync] Bắt đầu full sync toàn bộ tasks...")
	ws, we := WeekBounds(time.Now())
	syncID := logSyncStart("full_sync", ws, we)

	// Dùng zero time → không filter ngày
	tasks, err := fetchAllTasksForWeek(time.Time{}, time.Time{})
	if err != nil {
		log.Printf("[fullsync] Lỗi: %v", err)
		logSyncDone(syncID, 0, err.Error())
		cache.mu.Lock()
		cache.isLoading = false
		cache.mu.Unlock()
		return
	}

	if dbPool != nil {
		if err := upsertTasks(tasks, ws); err != nil {
			log.Printf("[db] upsert error: %v", err)
		}
	}
	logSyncDone(syncID, len(tasks), "")
	log.Printf("[fullsync] Xong: %d tasks tổng", len(tasks))

	// Cache chứa TOÀN BỘ tasks (không filter tuần)
	cache.set(tasks, ws, we)
}

func filterByWeek(tasks []TaskRow, ws, we time.Time) []TaskRow {
	if ws.IsZero() {
		return tasks
	}
	wsStr := ws.Format("2006-01-02")
	weStr := we.Format("2006-01-02")
	var result []TaskRow
	for _, t := range tasks {
		if t.DateUpdated >= wsStr && t.DateUpdated <= weStr {
			result = append(result, t)
		}
	}
	return result
}

// ── Weekly scheduler ──────────────────────────────────────────────────────────

func startWeeklyScheduler() {
	go func() {
		for {
			now := time.Now()
			loc, _ := time.LoadLocation("Asia/Ho_Chi_Minh")
			nowLocal := now.In(loc)
			daysUntilMonday := (8 - int(nowLocal.Weekday())) % 7
			if daysUntilMonday == 0 {
				daysUntilMonday = 7
			}
			nextMonday := time.Date(
				nowLocal.Year(), nowLocal.Month(), nowLocal.Day()+daysUntilMonday,
				0, 5, 0, 0, loc,
			)
			wait := nextMonday.Sub(now)
			log.Printf("[scheduler] Lần fetch tiếp theo: %s (còn %s)",
				nextMonday.Format("02/01/2006 15:04"), wait.Round(time.Minute))

			<-time.NewTimer(wait).C
			log.Println("[scheduler] Bắt đầu fetch tuần mới...")
			go refreshCache()
		}
	}()
}

// ── CORS & JSON helpers ───────────────────────────────────────────────────────

func withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func writeJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(data)
}

// ── Handlers ──────────────────────────────────────────────────────────────────

func handleTasks(w http.ResponseWriter, r *http.Request) {
	tasks, fetchedAt, _, _ := cache.get()
	writeJSON(w, map[string]interface{}{
		"tasks":      tasks,
		"fetched_at": fetchedAt,
		"loading":    cache.isLoading,
	})
}

func handleKpiByAssignee(w http.ResponseWriter, r *http.Request) {
	tasks, _, _, _ := cache.get()
	writeJSON(w, calcKpiByAssignee(tasks))
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	tasks, fetchedAt, ws, we := cache.get()
	writeJSON(w, calcStats(tasks, fetchedAt, ws, we))
}

func handleCompliance(w http.ResponseWriter, r *http.Request) {
	tasks, _, _, _ := cache.get()
	writeJSON(w, calcCompliance(tasks))
}

// Refresh thủ công — chỉ tuần hiện tại
func handleRefresh(w http.ResponseWriter, r *http.Request) {
	log.Println("[api] Manual refresh")
	go refreshCache()
	writeJSON(w, map[string]interface{}{"message": "Đang fetch dữ liệu tuần này...", "loading": true})
}

// Full sync toàn bộ lịch sử
func handleFullSync(w http.ResponseWriter, r *http.Request) {
	log.Println("[api] Full sync triggered")
	go fullSync()
	writeJSON(w, map[string]interface{}{"message": "Đang full sync tất cả tasks... Quá trình này có thể mất vài phút.", "loading": true})
}

// Lịch sử tất cả tasks từ DB
func handleAllTasks(w http.ResponseWriter, r *http.Request) {
	if dbPool == nil {
		writeJSON(w, map[string]interface{}{"error": "Database chưa kết nối", "tasks": []interface{}{}})
		return
	}
	tasks, err := loadAllTasksFromDB()
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	writeJSON(w, map[string]interface{}{
		"tasks": tasks,
		"total": len(tasks),
	})
}

// Lịch sử sync
func handleSyncHistory(w http.ResponseWriter, r *http.Request) {
	history, err := querySyncHistory()
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	writeJSON(w, history)
}

// Status server
func handleStatus(w http.ResponseWriter, r *http.Request) {
	tasks, fetchedAt, ws, we := cache.get()
	loc, _ := time.LoadLocation("Asia/Ho_Chi_Minh")
	dbCount := 0
	if dbPool != nil {
		dbCount = countTasksInDB()
	}
	writeJSON(w, map[string]interface{}{
		"server":         "Go KPI Dashboard",
		"cache_tasks":    len(tasks),
		"db_total_tasks": dbCount,
		"fetched_at":     fetchedAt,
		"loading":        cache.isLoading,
		"week_start":     ws.In(loc).Format("02/01/2006 15:04"),
		"week_end":       we.In(loc).Format("02/01/2006 15:04"),
	})
}

// ── Main ──────────────────────────────────────────────────────────────────────

func main() {
	log.Println("🚀 KPI Dashboard Server (Go) starting on :8080")

	// Init DB
	if err := initDB(); err != nil {
		log.Printf("[db] Không kết nối được DB: %v — chạy không có DB", err)
	} else {
		if err := migrateDB(); err != nil {
			log.Printf("[db] Migration lỗi: %v", err)
		} else {
			// Startup: load TOÀN BỘ tasks từ DB vào cache ngay lập tức
			// → server restart không bao giờ mất dữ liệu cũ
			ws, we := WeekBounds(time.Now())
			if tasks, err := loadAllTasksFromDB(); err == nil && len(tasks) > 0 {
				cache.set(tasks, ws, we)
				log.Printf("[cache] Đã load %d tasks từ DB (toàn bộ lịch sử)", len(tasks))
			}
		}
	}

	// Fetch từ ClickUp (background, không block)
	go refreshCache()

	// Lên lịch mỗi thứ Hai
	startWeeklyScheduler()

	// Routes
	mux := http.NewServeMux()
	mux.HandleFunc("/api/tasks", withCORS(handleTasks))
	mux.HandleFunc("/api/tasks/all", withCORS(handleAllTasks))
	mux.HandleFunc("/api/kpi/by-assignee", withCORS(handleKpiByAssignee))
	mux.HandleFunc("/api/stats", withCORS(handleStats))
	mux.HandleFunc("/api/compliance", withCORS(handleCompliance))
	mux.HandleFunc("/api/refresh", withCORS(handleRefresh))
	mux.HandleFunc("/api/sync/full", withCORS(handleFullSync))
	mux.HandleFunc("/api/sync/history", withCORS(handleSyncHistory))
	mux.HandleFunc("/api/status", withCORS(handleStatus))
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })

	log.Fatal(http.ListenAndServe(":8080", mux))
}
