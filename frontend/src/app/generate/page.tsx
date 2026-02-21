"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { resolveImageUrl, SCHEDULERS } from "@/lib/constants";
import { useLoraGenerate, useGenerationPolling } from "@/hooks/useGeneration";
import type { LoraGenerateRequest } from "@/lib/types";
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
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Wand2, Loader2, Download } from "lucide-react";

export default function LoraGeneratePageWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoraGeneratePage />
    </Suspense>
  );
}

function LoraGeneratePage() {
  const searchParams = useSearchParams();
  const preselectedChar = searchParams.get("character") || "";

  const [characterId, setCharacterId] = useState(preselectedChar);
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState(
    "bad anatomy, blurry, ugly, deformed, low quality"
  );
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [steps, setSteps] = useState(31);
  const [guidance, setGuidance] = useState(7.5);
  const [loraStrength, setLoraStrength] = useState(0.7);
  const [scheduler, setScheduler] = useState("DPMSolverMultistepScheduler");
  const [samples, setSamples] = useState(1);
  const [activeGenId, setActiveGenId] = useState<string | null>(null);

  const { data: characters } = useQuery({
    queryKey: ["characters"],
    queryFn: () => api.listCharacters(),
  });
  const { data: presets } = useQuery({
    queryKey: ["presets"],
    queryFn: () => api.listPresets(),
  });

  const loraGenerate = useLoraGenerate();
  const { data: polledGen } = useGenerationPolling(activeGenId);

  const deployedCharacters = characters?.filter(
    (c) => c.lora_status === "deployed"
  );
  const selectedChar = characters?.find((c) => c.id === characterId);

  const handleGenerate = async () => {
    if (!characterId) {
      toast.error("Please select a character");
      return;
    }
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    const data: LoraGenerateRequest = {
      character_id: characterId,
      prompt,
      negative_prompt: negativePrompt,
      width,
      height,
      num_inference_steps: steps,
      guidance_scale: guidance,
      lora_strength: loraStrength,
      scheduler,
      samples,
    };

    try {
      const result = await loraGenerate.mutateAsync(data);
      setActiveGenId(result.id);
      toast.success(
        result.status === "processing"
          ? "Generation started!"
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
      const triggerWord = selectedChar?.trigger_word || "";
      setPrompt(
        preset.prompt_template.replace("{trigger_word}", triggerWord)
      );
    }
    if (preset.negative_prompt) {
      setNegativePrompt(preset.negative_prompt);
    }
  };

  const currentGen = polledGen || loraGenerate.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">LoRA Generate</h1>
        <p className="text-muted-foreground">
          Generate images using a trained LoRA model for identity-locked
          results
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          {/* Character selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Character</CardTitle>
            </CardHeader>
            <CardContent>
              {deployedCharacters && deployedCharacters.length > 0 ? (
                <Select value={characterId} onValueChange={setCharacterId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a character..." />
                  </SelectTrigger>
                  <SelectContent>
                    {deployedCharacters.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{" "}
                        {c.trigger_word && (
                          <span className="text-muted-foreground">
                            ({c.trigger_word})
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No deployed LoRA models found. Train a character first.
                </p>
              )}
              {selectedChar?.trigger_word && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Trigger word{" "}
                  <code className="rounded bg-muted px-1">
                    {selectedChar.trigger_word}
                  </code>{" "}
                  will be auto-injected into your prompt
                </p>
              )}
            </CardContent>
          </Card>

          {/* Prompt */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Prompt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the image you want to generate..."
                rows={3}
              />
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

          {/* Generate */}
          <Button
            onClick={handleGenerate}
            disabled={
              loraGenerate.isPending || !prompt.trim() || !characterId
            }
            size="lg"
            className="w-full"
          >
            {loraGenerate.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="mr-2 h-4 w-4" />
            )}
            Generate with LoRA
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
                    {currentGen.output_urls.map((_, i) => (
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
                  {[21, 31, 41].map((s) => (
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

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-xs">LoRA Strength</Label>
                  <span className="text-xs text-muted-foreground">
                    {loraStrength}
                  </span>
                </div>
                <Slider
                  value={[loraStrength]}
                  onValueChange={([v]) => setLoraStrength(v)}
                  min={0.1}
                  max={1.0}
                  step={0.05}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Samples</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((s) => (
                    <Button
                      key={s}
                      variant={samples === s ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setSamples(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Scheduler</Label>
                <Select value={scheduler} onValueChange={setScheduler}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHEDULERS.map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">
                        {s.replace("Scheduler", "")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
