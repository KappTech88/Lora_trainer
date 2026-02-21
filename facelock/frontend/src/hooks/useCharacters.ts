"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CharacterCreate } from "@/lib/types";

export function useCharacters() {
  return useQuery({
    queryKey: ["characters"],
    queryFn: () => api.listCharacters(),
  });
}

export function useCharacter(id: string) {
  return useQuery({
    queryKey: ["character", id],
    queryFn: () => api.getCharacter(id),
    enabled: !!id,
  });
}

export function useCharacterImages(id: string) {
  return useQuery({
    queryKey: ["character-images", id],
    queryFn: () => api.getCharacterImages(id),
    enabled: !!id,
  });
}

export function useCreateCharacter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CharacterCreate) => api.createCharacter(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["characters"] });
    },
  });
}

export function useDeleteCharacter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCharacter(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["characters"] });
    },
  });
}

export function useUploadCharacterImages(characterId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      files,
      imageType,
    }: {
      files: File[];
      imageType?: string;
    }) => api.uploadCharacterImages(characterId, files, imageType),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["character-images", characterId],
      });
      queryClient.invalidateQueries({ queryKey: ["character", characterId] });
      queryClient.invalidateQueries({ queryKey: ["characters"] });
    },
  });
}
