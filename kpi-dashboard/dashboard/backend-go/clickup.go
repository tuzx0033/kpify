package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"sync"
	"time"
)

const (
	TOKEN       = "pk_107627547_EQSQELUF5LVO8HIGB2Z5W67V7LLDBUB4"
	BASE_URL    = "https://api.clickup.com/api/v2"
	MAX_WORKERS = 8
)

// ── ClickUp API types ─────────────────────────────────────────────────────────

type CUTeam struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type CUSpace struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type CUFolder struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type CUList struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	FolderName string `json:"-"`
	SpaceName  string `json:"-"`
	TeamName   string `json:"-"`
}

type CUStatus struct {
	Status string `json:"status"`
	Type   string `json:"type"`
}

type CUPriority struct {
	Priority string `json:"priority"`
}

type CUAssignee struct {
	Username string `json:"username"`
}

type CUTag struct {
	Name string `json:"name"`
}

type CUCFOption struct {
	ID         string      `json:"id"`
	Name       string      `json:"name"`
	OrderIndex interface{} `json:"orderindex"`
}

type CUCFTypeConfig struct {
	Options []CUCFOption `json:"options"`
}

type CUCustomField struct {
	ID         string         `json:"id"`
	Name       string         `json:"name"`
	Type       string         `json:"type"`
	Value      interface{}    `json:"value"`
	TypeConfig CUCFTypeConfig `json:"type_config"`
}

type CUTask struct {
	ID           string          `json:"id"`
	Name         string          `json:"name"`
	Description  string          `json:"description"`
	Status       CUStatus        `json:"status"`
	Priority     *CUPriority     `json:"priority"`
	Assignees    []CUAssignee    `json:"assignees"`
	Tags         []CUTag         `json:"tags"`
	Creator      *CUAssignee     `json:"creator"`
	DueDate      string          `json:"due_date"`
	StartDate    string          `json:"start_date"`
	DateCreated  string          `json:"date_created"`
	DateUpdated  string          `json:"date_updated"`
	DateClosed   string          `json:"date_closed"`
	TimeEstimate interface{}     `json:"time_estimate"`
	TimeSpent    interface{}     `json:"time_spent"`
	Points       interface{}     `json:"points"`
	Parent       interface{}     `json:"parent"`
	URL          string          `json:"url"`
	CustomFields []CUCustomField `json:"custom_fields"`
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

var httpClient = &http.Client{Timeout: 30 * time.Second}

func cuGet(path string) ([]byte, error) {
	req, err := http.NewRequest("GET", BASE_URL+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", TOKEN)
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

// ── Week boundary helpers ─────────────────────────────────────────────────────

// WeekBounds trả về (Monday 00:00, Sunday 23:59:59) của tuần chứa t, tính theo UTC+7
func WeekBounds(t time.Time) (weekStart, weekEnd time.Time) {
	loc, _ := time.LoadLocation("Asia/Ho_Chi_Minh")
	t = t.In(loc)
	// Tính Monday
	weekday := int(t.Weekday())
	if weekday == 0 {
		weekday = 7 // Sunday → 7
	}
	monday := t.AddDate(0, 0, -(weekday - 1))
	weekStart = time.Date(monday.Year(), monday.Month(), monday.Day(), 0, 0, 0, 0, loc)
	weekEnd = weekStart.AddDate(0, 0, 7).Add(-time.Second)
	return weekStart.UTC(), weekEnd.UTC()
}

func toMs(t time.Time) int64 {
	return t.UnixNano() / int64(time.Millisecond)
}

func tsToTime(ts string) *time.Time {
	if ts == "" || ts == "null" {
		return nil
	}
	ms, err := strconv.ParseInt(ts, 10, 64)
	if err != nil {
		return nil
	}
	t := time.UnixMilli(ms)
	return &t
}

func formatTime(t *time.Time) string {
	if t == nil {
		return ""
	}
	loc, _ := time.LoadLocation("Asia/Ho_Chi_Minh")
	return t.In(loc).Format("2006-01-02 15:04:05")
}

// ── Fetch workspace structure ─────────────────────────────────────────────────

func fetchTeams() ([]CUTeam, error) {
	body, err := cuGet("/team")
	if err != nil {
		return nil, err
	}
	var result struct {
		Teams []CUTeam `json:"teams"`
	}
	return result.Teams, json.Unmarshal(body, &result)
}

func fetchSpaces(teamID string) ([]CUSpace, error) {
	body, err := cuGet("/team/" + teamID + "/space?archived=false")
	if err != nil {
		return nil, err
	}
	var result struct {
		Spaces []CUSpace `json:"spaces"`
	}
	return result.Spaces, json.Unmarshal(body, &result)
}

func fetchFolders(spaceID string) ([]CUFolder, error) {
	body, err := cuGet("/space/" + spaceID + "/folder?archived=false")
	if err != nil {
		return nil, err
	}
	var result struct {
		Folders []CUFolder `json:"folders"`
	}
	return result.Folders, json.Unmarshal(body, &result)
}

func fetchListsInFolder(folder CUFolder, spaceName, teamName string) ([]CUList, error) {
	body, err := cuGet("/folder/" + folder.ID + "/list?archived=false")
	if err != nil {
		return nil, err
	}
	var result struct {
		Lists []CUList `json:"lists"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	for i := range result.Lists {
		result.Lists[i].FolderName = folder.Name
		result.Lists[i].SpaceName = spaceName
		result.Lists[i].TeamName = teamName
	}
	return result.Lists, nil
}

func fetchListsNoFolder(spaceID, spaceName, teamName string) ([]CUList, error) {
	body, err := cuGet("/space/" + spaceID + "/list?archived=false")
	if err != nil {
		return nil, err
	}
	var result struct {
		Lists []CUList `json:"lists"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	for i := range result.Lists {
		result.Lists[i].SpaceName = spaceName
		result.Lists[i].TeamName = teamName
	}
	return result.Lists, nil
}

// ── Fetch tasks (weekly filter) ───────────────────────────────────────────────

// fetchTasksForList kéo tasks có date_updated_gt = weekStart
// → lấy tất cả task được cập nhật/tạo/đóng trong tuần này
// Nếu weekStart.IsZero() → kéo toàn bộ (full sync, không filter ngày)
func fetchTasksForList(lst CUList, weekStart, weekEnd time.Time) []TaskRow {
	var results []TaskRow
	page := 0

	for {
		var path string
		if weekStart.IsZero() {
			path = fmt.Sprintf(
				"/list/%s/task?page=%d&include_closed=true&include_subtasks=true",
				lst.ID, page,
			)
		} else {
			path = fmt.Sprintf(
				"/list/%s/task?page=%d&include_closed=true&include_subtasks=true&date_updated_gt=%d",
				lst.ID, page, toMs(weekStart),
			)
		}
		body, err := cuGet(path)
		if err != nil {
			break
		}
		var result struct {
			Tasks []CUTask `json:"tasks"`
		}
		if err := json.Unmarshal(body, &result); err != nil {
			break
		}
		if len(result.Tasks) == 0 {
			break
		}
		for _, t := range result.Tasks {
			row := buildTaskRow(t, lst, weekStart, weekEnd)
			results = append(results, row)
		}
		page++
	}
	return results
}

// ── Parallel fetch all tasks ──────────────────────────────────────────────────

func fetchAllTasksForWeek(weekStart, weekEnd time.Time) ([]TaskRow, error) {
	teams, err := fetchTeams()
	if err != nil {
		return nil, fmt.Errorf("fetch teams: %w", err)
	}

	var allLists []CUList

	for _, team := range teams {
		spaces, err := fetchSpaces(team.ID)
		if err != nil {
			continue
		}
		for _, space := range spaces {
			// Fetch folders + no-folder lists concurrently
			var wg sync.WaitGroup
			folderCh := make(chan []CUFolder, 1)
			listCh := make(chan []CUList, 1)

			wg.Add(2)
			go func() {
				defer wg.Done()
				folders, _ := fetchFolders(space.ID)
				folderCh <- folders
			}()
			go func() {
				defer wg.Done()
				lists, _ := fetchListsNoFolder(space.ID, space.Name, team.Name)
				listCh <- lists
			}()
			wg.Wait()
			folders := <-folderCh
			noFolderLists := <-listCh

			// Fetch folder lists concurrently
			type folderResult struct{ lists []CUList }
			flCh := make(chan folderResult, len(folders))
			sem := make(chan struct{}, MAX_WORKERS)
			var fwg sync.WaitGroup
			for _, f := range folders {
				fwg.Add(1)
				go func(folder CUFolder) {
					defer fwg.Done()
					sem <- struct{}{}
					defer func() { <-sem }()
					lists, _ := fetchListsInFolder(folder, space.Name, team.Name)
					flCh <- folderResult{lists}
				}(f)
			}
			fwg.Wait()
			close(flCh)
			for r := range flCh {
				allLists = append(allLists, r.lists...)
			}
			allLists = append(allLists, noFolderLists...)
		}
	}

	// Fetch tasks for all lists concurrently
	taskCh := make(chan []TaskRow, len(allLists))
	sem := make(chan struct{}, MAX_WORKERS)
	var twg sync.WaitGroup
	for _, lst := range allLists {
		twg.Add(1)
		go func(l CUList) {
			defer twg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			rows := fetchTasksForList(l, weekStart, weekEnd)
			taskCh <- rows
		}(lst)
	}
	twg.Wait()
	close(taskCh)

	var allTasks []TaskRow
	for batch := range taskCh {
		allTasks = append(allTasks, batch...)
	}
	return allTasks, nil
}

// ── Parse helpers ─────────────────────────────────────────────────────────────

func parseFloat(v interface{}) float64 {
	if v == nil {
		return 0
	}
	switch val := v.(type) {
	case float64:
		return val
	case string:
		f, _ := strconv.ParseFloat(val, 64)
		return f
	case json.Number:
		f, _ := val.Float64()
		return f
	}
	return 0
}

func resolveDropdown(cf CUCustomField) string {
	val := cf.Value
	if val == nil {
		return ""
	}
	valStr := fmt.Sprintf("%v", val)
	for _, opt := range cf.TypeConfig.Options {
		oi := fmt.Sprintf("%v", opt.OrderIndex)
		if oi == valStr || opt.ID == valStr {
			return opt.Name
		}
	}
	return valStr
}
