import { API_BASE_URL } from "./api";

function getRoomRequirements(form) {
  const rooms = [
    { id: "living", type: "living", min_area: 120 },
    { id: "kitchen", type: "kitchen", min_area: 50 },
    { id: "dining", type: "dining", min_area: 70 },
    {
      id: "master",
      type: "master_bedroom",
      min_area: 120,
    },
    {
      id: "master_bath",
      type: "attached_bathroom",
      min_area: 30,
      attached_to: "master",
    },
  ];

  for (let i = 2; i <= Number(form.bedrooms); i++) {
    rooms.push({
      id: `bedroom_${i}`,
      type: "bedroom",
      min_area: 100,
    });
  }

  const bathroomsToAdd = Math.max(
    0,
    Number(form.bathrooms) - 1
  );

  for (let i = 0; i < bathroomsToAdd; i++) {
    rooms.push({
      id: `bathroom_${i + 1}`,
      type: "bathroom",
      min_area: 30,
    });
  }

  if (form.pooja) {
    rooms.push({
      id: "pooja",
      type: "pooja",
      min_area: 25,
    });
  }

  if (form.utility) {
    rooms.push({
      id: "utility",
      type: "utility",
      min_area: 30,
    });
  }

  if (form.parking) {
    rooms.push({
      id: "parking",
      type: "parking",
      min_area: 150,
    });
  }

  if (form.balcony) {
    rooms.push({
      id: "balcony",
      type: "balcony",
      min_area: 50,
    });
  }

  return rooms;
}

export function buildEngineRequest(form, seed = 42) {
  const facing = String(form.facing || "North").toUpperCase();

  return {
    request: {
      units: "ft",
      plot: {
        width: Number(form.width),
        depth: Number(form.length),
      },
      road_side: facing[0],
      setbacks: {
        front: 5,
        rear: 3,
        left: 3,
        right: 3,
      },
      floors: Number(form.floors || 1),
      rooms: getRoomRequirements(form),
      solver_options: {
        num_alternatives: 3,
        seed,
      },
      quality: form.quality || "Standard",
      location: form.location || "Tamil Nadu",
      budget: Number(form.budget || 3500000),
      monthly_budget: Number(form.monthlyBudget || 300000),
    },
    options: {
      num_alternatives: 3,
      seed,
      quality: form.quality || "Standard",
      location: form.location || "Tamil Nadu",
    },
  };
}

export async function generateHousePlans(form, seed = 42) {
  const response = await fetch(`${API_BASE_URL}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildEngineRequest(form, seed)),
  });

  const result = await response.json();

  if (!response.ok) {
    const detailMsg = typeof result.detail === "string" ? result.detail : "Unable to generate house plans.";
    throw new Error(detailMsg);
  }

  if (!Array.isArray(result.plans) || result.plans.length === 0) {
    const messages = (result.conflicts || [])
      .map((conflict) => conflict.message)
      .filter(Boolean);

    throw new Error(
      messages.join(" ") ||
      "The model could not generate a feasible plan for these requirements."
    );
  }

  return result;
}
