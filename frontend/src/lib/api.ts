import { API_BASE } from "./constants";
import type {
  Character,
  CharacterCreate,
  CharacterImage,
  Generation,
  LoraGenerateRequest,
  PromptPreset,
  QuickGenerateRequest,
  Settings,
  TrainingStatus,
  TrainingSubmitRequest,
  UploadedFace,
} from "./types";

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: HeadersInit = { ...options?.headers };
  if (!(options?.body instanceof FormData)) {
    (headers as Record<string, string>)["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.detail || error.message || "API request failed");
  }
  return res.json();
}

export const api = {
  // Health
  health: () => fetchApi<{ status: string }>("/api/health"),

  // Settings
  getSettings: () => fetchApi<Settings>("/api/settings"),
  updateApiKey: (api_key: string) =>
    fetchApi("/api/settings/api-key", {
      method: "PUT",
      body: JSON.stringify({ api_key }),
    }),

  // Characters
  listCharacters: () => fetchApi<Character[]>("/api/characters"),
  getCharacter: (id: string) => fetchApi<Character>(`/api/characters/${id}`),
  createCharacter: (data: CharacterCreate) =>
    fetchApi<Character>("/api/characters", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCharacter: (id: string, data: Partial<CharacterCreate>) =>
    fetchApi<Character>(`/api/characters/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteCharacter: (id: string) =>
    fetchApi(`/api/characters/${id}`, { method: "DELETE" }),
  uploadCharacterImages: async (
    id: string,
    files: File[],
    imageType: string = "training"
  ): Promise<CharacterImage[]> => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    formData.append("image_type", imageType);
    const res = await fetch(`${API_BASE}/api/characters/${id}/images`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },
  getCharacterImages: (id: string) =>
    fetchApi<CharacterImage[]>(`/api/characters/${id}/images`),
  deleteCharacterImage: (characterId: string, imageId: string) =>
    fetchApi(`/api/characters/${characterId}/images/${imageId}`, {
      method: "DELETE",
    }),

  // Generation
  quickGenerate: (data: QuickGenerateRequest) =>
    fetchApi<Generation>("/api/generate/quick", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  loraGenerate: (data: LoraGenerateRequest) =>
    fetchApi<Generation>("/api/generate/lora", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getGeneration: (id: string) =>
    fetchApi<Generation>(`/api/generate/${id}`),
  uploadFaceImage: async (file: File): Promise<UploadedFace> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/api/generate/upload-face`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },

  // Training
  submitTraining: (data: TrainingSubmitRequest) =>
    fetchApi("/api/training/submit", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getTrainingStatus: (characterId: string) =>
    fetchApi<TrainingStatus>(`/api/training/${characterId}/status`),
  refreshTrainingStatus: (characterId: string) =>
    fetchApi<TrainingStatus>(`/api/training/${characterId}/refresh`, {
      method: "POST",
    }),

  // Gallery
  listGenerations: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
    return fetchApi<Generation[]>(`/api/gallery${qs}`);
  },
  toggleFavorite: (id: string) =>
    fetchApi(`/api/gallery/${id}/favorite`, { method: "PUT" }),
  deleteGeneration: (id: string) =>
    fetchApi(`/api/gallery/${id}`, { method: "DELETE" }),

  // Presets
  listPresets: () => fetchApi<PromptPreset[]>("/api/presets"),
};
