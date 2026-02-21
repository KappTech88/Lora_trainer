"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { QuickGenerateRequest, LoraGenerateRequest } from "@/lib/types";

export function useQuickGenerate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: QuickGenerateRequest) => api.quickGenerate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery"] });
    },
  });
}

export function useLoraGenerate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LoraGenerateRequest) => api.loraGenerate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery"] });
    },
  });
}

export function useGenerationPolling(generationId: string | null) {
  return useQuery({
    queryKey: ["generation", generationId],
    queryFn: () => api.getGeneration(generationId!),
    enabled: !!generationId,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === "processing" ? 3000 : false;
    },
  });
}
