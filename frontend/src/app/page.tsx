"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { resolveImageUrl } from "@/lib/constants";
import { useSettings } from "@/hooks/useSettings";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Zap, Users, Wand2, ImageIcon } from "lucide-react";

export default function DashboardPage() {
  const { data: settings } = useSettings();
  const { data: generations, isLoading: genLoading } = useQuery({
    queryKey: ["gallery", "recent"],
    queryFn: () => api.listGenerations({ limit: "8" }),
  });
  const { data: characters } = useQuery({
    queryKey: ["characters"],
    queryFn: () => api.listCharacters(),
  });

  const activeTraining = characters?.filter(
    (c) => c.lora_status === "training" || c.lora_status === "deploying_gpu"
  );
  const deployedModels = characters?.filter(
    (c) => c.lora_status === "deployed"
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to FaceLock — Consistent AI Character Image Generator
        </p>
      </div>

      {!settings?.has_api_key && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div className="flex-1">
              <p className="font-medium">API Key Not Configured</p>
              <p className="text-sm text-muted-foreground">
                Set your ModelsLab API key to start generating images.
              </p>
            </div>
            <Button asChild>
              <Link href="/settings">Configure</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Characters</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {characters?.length ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Deployed Models
            </CardTitle>
            <Wand2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {deployedModels?.length ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Active Training
            </CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeTraining?.length ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Generations
            </CardTitle>
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {generations?.length ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Button asChild size="lg" className="h-20">
          <Link href="/generate/quick" className="flex flex-col items-center gap-1">
            <Zap className="h-5 w-5" />
            Quick Generate
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-20">
          <Link href="/characters" className="flex flex-col items-center gap-1">
            <Users className="h-5 w-5" />
            New Character
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-20">
          <Link href="/gallery" className="flex flex-col items-center gap-1">
            <ImageIcon className="h-5 w-5" />
            Browse Gallery
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Generations</CardTitle>
          <CardDescription>Your latest image generations</CardDescription>
        </CardHeader>
        <CardContent>
          {genLoading ? (
            <div className="grid grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-md" />
              ))}
            </div>
          ) : generations && generations.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {generations.slice(0, 8).map((gen) => (
                <div key={gen.id} className="group relative">
                  {gen.status === "success" && gen.output_urls?.[0] ? (
                    <img
                      src={resolveImageUrl(gen)}
                      alt={gen.prompt || "Generated image"}
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
            <p className="text-center text-muted-foreground py-8">
              No generations yet. Start by using Quick Generate!
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
