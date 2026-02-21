"use client";

import { useCallback, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_BASE, resolveImageUrl } from "@/lib/constants";
import {
  useCharacter,
  useCharacterImages,
  useUploadCharacterImages,
  useDeleteCharacter,
} from "@/hooks/useCharacters";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Upload,
  Trash2,
  Wand2,
  ImageIcon,
  GraduationCap,
  Loader2,
  X,
} from "lucide-react";

export default function CharacterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: character, isLoading } = useCharacter(id);
  const { data: images } = useCharacterImages(id);
  const uploadImages = useUploadCharacterImages(id);
  const deleteCharacter = useDeleteCharacter();
  const { data: generations } = useQuery({
    queryKey: ["gallery", "character", id],
    queryFn: () => api.listGenerations({ character_id: id }),
    enabled: !!id,
  });

  const handleUpload = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;
      try {
        await uploadImages.mutateAsync({ files: fileArray, imageType: "training" });
        toast.success(`Uploaded ${fileArray.length} image(s)`);
      } catch {
        toast.error("Failed to upload images");
      }
    },
    [uploadImages]
  );

  const handleDeleteImage = async (imageId: string) => {
    try {
      await api.deleteCharacterImage(id, imageId);
      queryClient.invalidateQueries({ queryKey: ["character-images", id] });
      queryClient.invalidateQueries({ queryKey: ["character", id] });
      toast.success("Image deleted");
    } catch {
      toast.error("Failed to delete image");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this character?")) return;
    try {
      await deleteCharacter.mutateAsync(id);
      toast.success("Character deleted");
      router.push("/characters");
    } catch {
      toast.error("Failed to delete character");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!character) {
    return <p>Character not found</p>;
  }

  const statusColor: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    none: "outline",
    training: "secondary",
    deploying_gpu: "secondary",
    deployed: "default",
    failed: "destructive",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{character.name}</h1>
          {character.description && (
            <p className="text-muted-foreground">{character.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          {character.lora_status === "deployed" && (
            <Button asChild>
              <Link href={`/generate?character=${id}`}>
                <Wand2 className="mr-2 h-4 w-4" />
                Generate
              </Link>
            </Button>
          )}
          <Button
            variant="destructive"
            size="icon"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Badge variant={statusColor[character.lora_status] || "outline"}>
          LoRA: {character.lora_status}
        </Badge>
        {character.trigger_word && (
          <Badge variant="outline">
            Trigger: <code className="ml-1">{character.trigger_word}</code>
          </Badge>
        )}
        {character.lora_base_model && (
          <Badge variant="outline">Base: {character.lora_base_model}</Badge>
        )}
        <Badge variant="outline">
          {character.image_count} images
        </Badge>
      </div>

      <Tabs defaultValue="images">
        <TabsList>
          <TabsTrigger value="images">
            <ImageIcon className="mr-2 h-4 w-4" />
            Images
          </TabsTrigger>
          <TabsTrigger value="training">
            <GraduationCap className="mr-2 h-4 w-4" />
            Training
          </TabsTrigger>
          <TabsTrigger value="generations">
            <Wand2 className="mr-2 h-4 w-4" />
            Generations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="images" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Upload 10-20 training images with varied angles, lighting, and
              expressions
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadImages.isPending}
            >
              {uploadImages.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Upload Images
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleUpload(e.target.files)}
            />
          </div>

          {images && images.length > 0 ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {images.map((img) => (
                <div key={img.id} className="group relative">
                  <img
                    src={
                      img.file_path
                        ? `${API_BASE}/storage/${img.file_path}`
                        : img.public_url || ""
                    }
                    alt="Training"
                    className="aspect-square rounded-md object-cover"
                  />
                  <button
                    onClick={() => handleDeleteImage(img.id)}
                    className="absolute right-1 top-1 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground">
                  No images uploaded yet
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="training" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>LoRA Training</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {character.lora_status === "none" ? (
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    Train a LoRA model to lock this character&apos;s identity
                    across generations. Requires at least 5 training images.
                  </p>
                  <Button asChild>
                    <Link href={`/characters/${id}/train`}>
                      <GraduationCap className="mr-2 h-4 w-4" />
                      Start Training
                    </Link>
                  </Button>
                </div>
              ) : character.lora_status === "training" ||
                character.lora_status === "deploying_gpu" ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>
                      Training in progress: {character.lora_status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Training ID: {character.lora_training_id}
                  </p>
                </div>
              ) : character.lora_status === "deployed" ? (
                <div className="space-y-3">
                  <p className="text-green-600 font-medium">
                    Model deployed and ready!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Model ID: {character.lora_model_id}
                  </p>
                  <Button asChild>
                    <Link href={`/generate?character=${id}`}>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Generate with LoRA
                    </Link>
                  </Button>
                </div>
              ) : (
                <div>
                  <p className="text-destructive">
                    Training failed. You can retry.
                  </p>
                  <Button asChild className="mt-2">
                    <Link href={`/characters/${id}/train`}>
                      Retry Training
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generations" className="space-y-4">
          {generations && generations.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {generations.map((gen) => (
                <div key={gen.id} className="group relative">
                  {gen.status === "success" && gen.output_urls?.[0] ? (
                    <img
                      src={resolveImageUrl(gen)}
                      alt={gen.prompt || ""}
                      className="aspect-square rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex aspect-square items-center justify-center rounded-md bg-muted">
                      <Badge
                        variant={
                          gen.status === "processing"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {gen.status}
                      </Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <Wand2 className="h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground">
                  No generations yet for this character
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
