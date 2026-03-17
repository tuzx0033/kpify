import axios from "axios";

// Khi build Docker: VITE_API_URL được inject qua docker-compose args
// Khi dev local: fallback về localhost:8080
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export const fetchStats         = ()              => axios.get(`${BASE}/api/stats`).then(r => r.data);
export const fetchKpiByAssignee = ()              => axios.get(`${BASE}/api/kpi/by-assignee`).then(r => r.data);
export const fetchTasks         = ()              => axios.get(`${BASE}/api/tasks`).then(r => r.data);
export const fetchCompliance    = ()              => axios.get(`${BASE}/api/compliance`).then(r => r.data);
// Refresh thủ công → Go server tự fetch lại tuần hiện tại ở background
export const triggerRefresh     = ()              => axios.get(`${BASE}/api/refresh`).then(r => r.data);
export const fetchServerStatus  = ()              => axios.get(`${BASE}/api/status`).then(r => r.data);
export const triggerFullSync    = ()              => axios.get(`${BASE}/api/sync/full`).then(r => r.data);
export const fetchSyncHistory   = ()              => axios.get(`${BASE}/api/sync/history`).then(r => r.data);
export const fetchAllTasks      = ()              => axios.get(`${BASE}/api/tasks/all`).then(r => r.data);

// Ping định kỳ để giữ Render free tier không ngủ (mỗi 10 phút)
export const keepAlive = () => {
  axios.get(`${BASE}/health`).catch(() => {});
  setInterval(() => axios.get(`${BASE}/health`).catch(() => {}), 10 * 60 * 1000);
};
