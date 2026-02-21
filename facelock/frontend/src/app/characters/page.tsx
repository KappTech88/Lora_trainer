"use client";

import { useState } from "react";
import Link from "next/link";
import { useCharacters, useCreateCharacter } from "@/hooks/useCharacters";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Users, ImageIcon } from "lucide-react";
import { BASE_MODELS } from "@/lib/constants";

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  none: "outline",
  training: "secondary",
  deploying_gpu: "secondary",
  deployed: "default",
  failed: "destructive",
};

export default function CharactersPage() {
  const { data: characters, isLoading } = useCharacters();
  const createCharacter = useCreateCharacter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerWord, setTriggerWord] = useState("");
  const [baseModel, setBaseModel] = useState("sdxl");

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Character name is required");
      return;
    }
    try {
      await createCharacter.mutateAsync({
        name,
        description: description || undefined,
        trigger_word: triggerWord || name.toLowerCase().replace(/\s/g, "") + "face",
        lora_base_model: baseModel,
      });
      toast.success("Character created!");
      setOpen(false);
      setName("");
      setDescription("");
      setTriggerWord("");
    } catch {
      toast.error("Failed to create character");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Characters</h1>
          <p className="text-muted-foreground">
            Manage your character identities and LoRA models
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Character
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Character</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Bryant"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Trigger Word</Label>
                <Input
                  value={triggerWord}
                  onChange={(e) => setTriggerWord(e.target.value)}
                  placeholder={
                    name
                      ? `${name.toLowerCase().replace(/\s/g, "")}face`
                      : "e.g., bryantface"
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Used in prompts to activate the LoRA model
                </p>
              </div>
              <div className="space-y-2">
                <Label>Base Model</Label>
                <Select value={baseModel} onValueChange={setBaseModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BASE_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleCreate}
                disabled={createCharacter.isPending}
                className="w-full"
              >
                Create Character
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : characters && characters.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((char) => (
            <Link key={char.id} href={`/characters/${char.id}`}>
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">{char.name}</CardTitle>
                  <Badge variant={statusColors[char.lora_status] || "outline"}>
                    {char.lora_status === "none"
                      ? "No LoRA"
                      : char.lora_status}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-2">
                  {char.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {char.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ImageIcon className="h-3 w-3" />
                      {char.image_count} images
                    </span>
                    {char.trigger_word && (
                      <code className="rounded bg-muted px-1 text-xs">
                        {char.trigger_word}
                      </code>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Users className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">No characters yet</p>
              <p className="text-sm text-muted-foreground">
                Create a character to start training LoRA models
              </p>
            </div>
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Character
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
