/**
 * API client module for Plan2Space 3D backend endpoints.
 */

const API_BASE = '/api/v1';

export async function fetchCapabilities() {
  const res = await fetch(`${API_BASE}/capabilities`);
  if (!res.ok) throw new Error(`Capabilities request failed: ${res.statusText}`);
  return await res.json();
}

export async function uploadFloorPlanImage(file, name = 'Floor Plan', scalePpm = null) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', name);
  if (scalePpm) {
    formData.append('scale_pixels_per_metre', scalePpm.toString());
  }

  const res = await fetch(`${API_BASE}/floor-plans`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Image upload failed');
  }
  return await res.json();
}

export async function createFloorPlanJSON(payload) {
  const res = await fetch(`${API_BASE}/floor-plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to create floor plan');
  }
  return await res.json();
}

export async function getFloorPlan(planId) {
  const res = await fetch(`${API_BASE}/floor-plans/${planId}`);
  if (!res.ok) throw new Error(`Failed to load floor plan: ${res.statusText}`);
  return await res.json();
}

export async function updateFloorPlanGeometry(planId, geometry) {
  const res = await fetch(`${API_BASE}/floor-plans/${planId}/geometry`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(geometry),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to update geometry');
  }
  return await res.json();
}

export async function calibrateScale(planId, calData) {
  const res = await fetch(`${API_BASE}/floor-plans/${planId}/calibrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(calData),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Scale calibration failed');
  }
  return await res.json();
}

export async function startConversionJob(floorPlanId, parameters) {
  const res = await fetch(`${API_BASE}/conversions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      floor_plan_id: floorPlanId,
      parameters: parameters,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to start conversion job');
  }
  return await res.json();
}

export async function getConversionJob(jobId) {
  const res = await fetch(`${API_BASE}/conversions/${jobId}`);
  if (!res.ok) throw new Error(`Job poll failed: ${res.statusText}`);
  return await res.json();
}

export function getModelUrl(jobId, format = 'glb') {
  return `${API_BASE}/conversions/${jobId}/model?format=${format}`;
}
