export const SCHEDULERS = [
  "DDPMScheduler",
  "DDIMScheduler",
  "PNDMScheduler",
  "LMSDiscreteScheduler",
  "EulerDiscreteScheduler",
  "EulerAncestralDiscreteScheduler",
  "DPMSolverMultistepScheduler",
  "HeunDiscreteScheduler",
  "KDPM2DiscreteScheduler",
  "DPMSolverSinglestepScheduler",
  "KDPM2AncestralDiscreteScheduler",
  "UniPCMultistepScheduler",
  "DEISMultistepScheduler",
  "LCMScheduler",
] as const;

export const BASE_MODELS = [
  { value: "sdxl", label: "Stable Diffusion XL" },
  { value: "sd15", label: "Stable Diffusion 1.5" },
  { value: "flux", label: "FLUX" },
] as const;

export const QUICK_MODES = [
  {
    value: "flux_headshot" as const,
    label: "Flux Headshot",
    description: "Best for professional headshots",
  },
  {
    value: "face_gen" as const,
    label: "Face Generator",
    description: "Generate face variants with different scenes",
  },
] as const;

export const STEP_OPTIONS = [21, 31, 41] as const;

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function resolveImageUrl(
  generation: { local_paths?: string[]; output_urls?: string[] },
  index: number = 0
): string {
  if (generation.local_paths?.[index]) {
    return `${API_BASE}/storage/${generation.local_paths[index]}`;
  }
  if (generation.output_urls?.[index]) {
    return generation.output_urls[index];
  }
  return "";
}
