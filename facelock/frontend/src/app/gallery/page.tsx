"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { resolveImageUrl } from "@/lib/constants";
import type { Generation } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Download,
  Heart,
  Trash2,
  ImageIcon,
  X,
} from "lucide-react";

export default function GalleryPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [favOnly, setFavOnly] = useState(false);
  const [characterFilter, setCharacterFilter] = useState<string>("all");
  const [selectedGen, setSelectedGen] = useState<Generation | null>(null);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);

  const { data: characters } = useQuery({
    queryKey: ["characters"],
    queryFn: () => api.listCharacters(),
  });

  const params: Record<string, string> = { limit: "100" };
  if (statusFilter !== "all") params.status = statusFilter;
  if (favOnly) params.is_favorite = "true";
  if (characterFilter !== "all") params.character_id = characterFilter;

  const { data: generations, isLoading } = useQuery({
    queryKey: ["gallery", params],
    queryFn: () => api.listGenerations(params),
  });

  const handleFavorite = async (gen: Generation) => {
    try {
      await api.toggleFavorite(gen.id);
      queryClient.invalidateQueries({ queryKey: ["gallery"] });
      if (selectedGen?.id === gen.id) {
        setSelectedGen({ ...gen, is_favorite: !gen.is_favorite });
      }
    } catch {
      toast.error("Failed to update favorite");
    }
  };

  const handleDelete = async (gen: Generation) => {
    if (!confirm("Delete this generation?")) return;
    try {
      await api.deleteGeneration(gen.id);
      queryClient.invalidateQueries({ queryKey: ["gallery"] });
      setSelectedGen(null);
      toast.success("Generation deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Gallery</h1>
        <p className="text-muted-foreground">
          Browse all your generated images
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm">Status:</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm">Character:</Label>
          <Select value={characterFilter} onValueChange={setCharacterFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {characters?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={favOnly}
            onCheckedChange={setFavOnly}
            id="fav-filter"
          />
          <Label htmlFor="fav-filter" className="text-sm">
            Favorites only
          </Label>
        </div>
      </div>

      {/* Gallery grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-md" />
          ))}
        </div>
      ) : generations && generations.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {generations.map((gen) =>
            gen.status === "success" && gen.output_urls?.length ? (
              gen.output_urls.map((_, i) => (
                <div
                  key={`${gen.id}-${i}`}
                  className="group relative cursor-pointer"
                  onClick={() => {
                    setSelectedGen(gen);
                    setSelectedImageIdx(i);
                  }}
                >
                  <img
                    src={resolveImageUrl(gen, i)}
                    alt={gen.prompt || ""}
                    className="aspect-square rounded-md object-cover transition-transform group-hover:scale-[1.02]"
                  />
                  {gen.is_favorite && (
                    <Heart className="absolute right-2 top-2 h-4 w-4 fill-red-500 text-red-500" />
                  )}
                </div>
              ))
            ) : (
              <div
                key={gen.id}
                className="flex aspect-square items-center justify-center rounded-md bg-muted"
              >
                <Badge
                  variant={
                    gen.status === "processing" ? "secondary" : "destructive"
                  }
                >
                  {gen.status}
                </Badge>
              </div>
            )
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <ImageIcon className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No generations found</p>
          </CardContent>
        </Card>
      )}

      {/* Image modal */}
      <Dialog
        open={!!selectedGen}
        onOpenChange={(open) => !open && setSelectedGen(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Generation Details
              {selectedGen?.is_favorite && (
                <Heart className="h-4 w-4 fill-red-500 text-red-500" />
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedGen && (
            <div className="space-y-4">
              <img
                src={resolveImageUrl(selectedGen, selectedImageIdx)}
                alt={selectedGen.prompt || ""}
                className="w-full rounded-md"
              />

              {selectedGen.output_urls &&
                selectedGen.output_urls.length > 1 && (
                  <div className="flex gap-2">
                    {selectedGen.output_urls.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedImageIdx(i)}
                        className={`h-16 w-16 rounded-md border-2 overflow-hidden ${
                          i === selectedImageIdx
                            ? "border-primary"
                            : "border-transparent"
                        }`}
                      >
                        <img
                          src={resolveImageUrl(selectedGen, i)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}

              <div className="space-y-2 text-sm">
                {selectedGen.prompt && (
                  <div>
                    <span className="font-medium">Prompt: </span>
                    <span className="text-muted-foreground">
                      {selectedGen.prompt}
                    </span>
                  </div>
                )}
                {selectedGen.seed && (
                  <div>
                    <span className="font-medium">Seed: </span>
                    <span className="text-muted-foreground">
                      {selectedGen.seed}
                    </span>
                  </div>
                )}
                {selectedGen.generation_time && (
                  <div>
                    <span className="font-medium">Time: </span>
                    <span className="text-muted-foreground">
                      {selectedGen.generation_time.toFixed(2)}s
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <a
                  href={resolveImageUrl(selectedGen, selectedImageIdx)}
                  download
                  className="flex-1"
                >
                  <Button variant="outline" className="w-full">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </a>
                <Button
                  variant={
                    selectedGen.is_favorite ? "default" : "outline"
                  }
                  onClick={() => handleFavorite(selectedGen)}
                >
                  <Heart
                    className={`mr-2 h-4 w-4 ${
                      selectedGen.is_favorite ? "fill-current" : ""
                    }`}
                  />
                  Favorite
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => handleDelete(selectedGen)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
