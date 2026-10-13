export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const token = localStorage.getItem("buildwise_token");
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let data = null;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    let errorMsg = "An unexpected error occurred.";
    if (data) {
      if (typeof data.detail === "string") {
        errorMsg = data.detail;
      } else if (Array.isArray(data.detail)) {
        errorMsg = data.detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
      } else if (data.message) {
        errorMsg = data.message;
      }
    }
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

/* ============================================================
   CAMELCASE <-> SNAKE_CASE FORM CONVERTERS
============================================================ */

export function plannerFormToBackend(form) {
  if (!form) return {};
  return {
    plot_width: Number(form.width || 40),
    plot_depth: Number(form.length || 60),
    facing: String(form.facing || "North"),
    location: String(form.location || "Tamil Nadu"),
    bedrooms: Number(form.bedrooms || 3),
    bathrooms: Number(form.bathrooms || 2),
    floors: Number(form.floors || 1),
    parking: Boolean(form.parking),
    balcony: Boolean(form.balcony),
    pooja: Boolean(form.pooja),
    utility: Boolean(form.utility),
    budget: Number(form.budget || 3500000),
    monthly_budget: Number(form.monthlyBudget || 300000),
    quality: String(form.quality || "Standard"),
  };
}

export function plannerFormFromBackend(data) {
  if (!data) return null;
  return {
    width: Number(data.width || data.plot_width || 40),
    length: Number(data.length || data.plot_depth || 60),
    facing: String(data.facing || "North"),
    location: String(data.location || "Tamil Nadu"),
    bedrooms: Number(data.bedrooms || 3),
    bathrooms: Number(data.bathrooms || 2),
    floors: Number(data.floors || 1),
    parking: data.parking !== undefined ? Boolean(data.parking) : true,
    balcony: data.balcony !== undefined ? Boolean(data.balcony) : true,
    pooja: Boolean(data.pooja),
    utility: data.utility !== undefined ? Boolean(data.utility) : true,
    budget: Number(data.budget || 3500000),
    monthlyBudget: Number(data.monthlyBudget || data.monthly_budget || 300000),
    quality: String(data.quality || "Standard"),
  };
}

/* ============================================================
   API ENDPOINT CLIENT METHODS
============================================================ */

export async function getHealth() {
  return request("/api/health");
}

export async function getMlStatus() {
  return request("/api/ml/status");
}

export async function estimateAffordability(form) {
  const payload = plannerFormToBackend(form);
  return request("/api/estimate/affordability", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function estimateCost(params) {
  return request("/api/estimate/cost", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function estimateSchedule(params) {
  return request("/api/estimate/schedule", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function getCurrentProject() {
  return request("/api/projects/current");
}

export async function saveCurrentProject(payload) {
  return request("/api/projects/current", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function selectProjectPlan(planId) {
  return request("/api/projects/current/selected-plan", {
    method: "PUT",
    body: JSON.stringify({ plan_id: planId }),
  });
}

export async function getProjectSummary() {
  return request("/api/projects/current/summary");
}

export async function getProjectConstruction(month = 1) {
  return request(`/api/projects/current/construction?month=${month}`);
}

export async function getProjectReport() {
  return request("/api/projects/current/report");
}

export async function getProjectMaterials() {
  return request("/api/projects/current/materials");
}

export async function updateMaterial(id, patch) {
  return request(`/api/projects/current/materials/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function addCustomMaterial(material) {
  return request("/api/projects/current/materials", {
    method: "POST",
    body: JSON.stringify(material),
  });
}

export async function deleteCustomMaterial(id) {
  return request(`/api/projects/current/materials/${id}`, {
    method: "DELETE",
  });
}

export async function getProjectTasks(day = null) {
  const url = day !== null && day !== undefined
    ? `/api/projects/current/tasks?day=${day}`
    : "/api/projects/current/tasks";
  return request(url);
}

export async function updateProjectTask(id, patch) {
  return request(`/api/projects/current/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function postponeProjectTask(id) {
  return request(`/api/projects/current/tasks/${id}/postpone`, {
    method: "POST",
  });
}

export async function createProjectTask(task) {
  return request("/api/projects/current/tasks", {
    method: "POST",
    body: JSON.stringify(task),
  });
}

export async function loginUser(email, password) {
  const data = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (data?.access_token) {
    localStorage.setItem("buildwise_token", data.access_token);
  }
  return data;
}

export async function registerUser(email, password, name = "Builder") {
  const data = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
  if (data?.access_token) {
    localStorage.setItem("buildwise_token", data.access_token);
  }
  return data;
}

export async function getMe() {
  return request("/api/auth/me");
}
