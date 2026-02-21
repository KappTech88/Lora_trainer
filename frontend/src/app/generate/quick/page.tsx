"use client";

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { resolveImageUrl, QUICK_MODES } from "@/lib/constants";
import { useQuickGenerate, useGenerationPolling } from "@/hooks/useGeneration";
import type { QuickGenerateRequest } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Upload, Wand2, Loader2, Download, X } from "lucide-react";

export default function QuickGeneratePage() {
  const [mode, setMode] = useState<"flux_headshot" | "face_gen">(
    "flux_headshot"
  );
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState(
    "cartoon, anime, blurry, ugly, deformed, bad anatomy"
  );
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [facePreview, setFacePreview] = useState<string>("");
  const [faceUrl, setFaceUrl] = useState<string>("");
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [steps, setSteps] = useState(25);
  const [guidance, setGuidance] = useState(5.5);
  const [activeGenId, setActiveGenId] = useState<string | null>(null);

  const quickGenerate = useQuickGenerate();
  const { data: polledGen } = useGenerationPolling(activeGenId);
  const { data: presets } = useQuery({
    queryKey: ["presets"],
    queryFn: () => api.listPresets(),
  });

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setFaceFile(file);
      setFacePreview(URL.createObjectURL(file));
      setFaceUrl("");
    },
    []
  );

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      setFaceFile(file);
      setFacePreview(URL.createObjectURL(file));
      setFaceUrl("");
    }
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    let imageUrl = faceUrl;

    if (faceFile && !faceUrl) {
      try {
        toast.info("Uploading face image...");
        const uploaded = await api.uploadFaceImage(faceFile);
        imageUrl = uploaded.public_url || "";
        setFaceUrl(imageUrl);
      } catch {
        toast.error("Failed to upload face image");
        return;
      }
    }

    if (!imageUrl) {
      toast.error("Please upload a face image");
      return;
    }

    const data: QuickGenerateRequest = {
      prompt,
      negative_prompt: negativePrompt,
      face_image_url: imageUrl,
      mode,
      width,
      height,
      num_inference_steps: steps,
      guidance_scale: guidance,
      samples: 1,
    };

    try {
      const result = await quickGenerate.mutateAsync(data);
      setActiveGenId(result.id);
      toast.success(
        result.status === "processing"
          ? "Generation started! Polling for results..."
          : "Image generated!"
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Generation failed"
      );
    }
  };

  const applyPreset = (preset: { prompt_template?: string; negative_prompt?: string }) => {
    if (preset.prompt_template) {
      setPrompt(preset.prompt_template.replace("{trigger_word}", ""));
    }
    if (preset.negative_prompt) {
      setNegativePrompt(preset.negative_prompt);
    }
  };

  const currentGen = polledGen || quickGenerate.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Quick Generate</h1>
        <p className="text-muted-foreground">
          Generate images from a face reference — no training required
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          {/* Mode selector */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-2">
                {QUICK_MODES.map((m) => (
                  <Button
                    key={m.value}
                    variant={mode === m.value ? "default" : "outline"}
                    onClick={() => setMode(m.value)}
                    className="flex-1"
                  >
                    <div className="text-center">
                      <div className="font-medium">{m.label}</div>
                      <div className="text-xs opacity-70">
                        {m.description}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Face image upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Face Image</CardTitle>
            </CardHeader>
            <CardContent>
              {facePreview ? (
                <div className="relative inline-block">
                  <img
                    src={facePreview}
                    alt="Face preview"
                    className="h-32 w-32 rounded-md object-cover"
                  />
                  <button
                    onClick={() => {
                      setFaceFile(null);
                      setFacePreview("");
                      setFaceUrl("");
                    }}
                    className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed p-8 text-muted-foreground hover:border-primary hover:text-primary"
                  onClick={() =>
                    document.getElementById("face-upload")?.click()
                  }
                >
                  <Upload className="h-8 w-8" />
                  <p className="text-sm">
                    Drop a face image here or click to upload
                  </p>
                </div>
              )}
              <input
                id="face-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </CardContent>
          </Card>

          {/* Prompt */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Prompt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the image you want to generate..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  Negative Prompt
                </Label>
                <Textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* Style presets */}
          {presets && presets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Style Presets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {presets.map((preset) => (
                    <Button
                      key={preset.id}
                      variant="outline"
                      size="sm"
                      onClick={() => applyPreset(preset)}
                    >
                      {preset.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={quickGenerate.isPending || !prompt.trim()}
            size="lg"
            className="w-full"
          >
            {quickGenerate.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="mr-2 h-4 w-4" />
            )}
            Generate
          </Button>

          {/* Results */}
          {currentGen && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  Results
                  <Badge
                    variant={
                      currentGen.status === "success"
                        ? "default"
                        : currentGen.status === "processing"
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    {currentGen.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {currentGen.status === "processing" ? (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">
                      Generating your image...
                    </p>
                  </div>
                ) : currentGen.status === "success" &&
                  currentGen.output_urls?.length ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {currentGen.output_urls.map((url, i) => (
                      <div key={i} className="group relative">
                        <img
                          src={resolveImageUrl(currentGen, i)}
                          alt={`Generated ${i + 1}`}
                          className="rounded-md"
                        />
                        <a
                          href={resolveImageUrl(currentGen, i)}
                          download
                          className="absolute bottom-2 right-2 rounded-md bg-black/50 p-2 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </div>
                    ))}
                  </div>
                ) : currentGen.status === "error" ? (
                  <p className="text-center text-destructive py-4">
                    Generation failed. Check your API key and try again.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Parameters sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Width</Label>
                  <Input
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value))}
                    min={256}
                    max={1024}
                    step={64}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Height</Label>
                  <Input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value))}
                    min={256}
                    max={1024}
                    step={64}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-xs">Steps</Label>
                  <span className="text-xs text-muted-foreground">
                    {steps}
                  </span>
                </div>
                <div className="flex gap-2">
                  {[21, 25, 31].map((s) => (
                    <Button
                      key={s}
                      variant={steps === s ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setSteps(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-xs">Guidance Scale</Label>
                  <span className="text-xs text-muted-foreground">
                    {guidance}
                  </span>
                </div>
                <Slider
                  value={[guidance]}
                  onValueChange={([v]) => setGuidance(v)}
                  min={1}
                  max={20}
                  step={0.5}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
