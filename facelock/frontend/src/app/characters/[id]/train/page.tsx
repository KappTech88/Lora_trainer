"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_BASE, BASE_MODELS } from "@/lib/constants";
import { useCharacter, useCharacterImages } from "@/hooks/useCharacters";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle,
  GraduationCap,
  Loader2,
  RefreshCw,
  Wand2,
} from "lucide-react";

export default function TrainingPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: character } = useCharacter(id);
  const { data: images } = useCharacterImages(id);

  const [step, setStep] = useState(1);
  const [instancePrompt, setInstancePrompt] = useState("");
  const [classPrompt, setClassPrompt] = useState("photo of a person");
  const [maxSteps, setMaxSteps] = useState(2000);
  const [baseModel, setBaseModel] = useState("sdxl");

  const submitTraining = useMutation({
    mutationFn: () =>
      api.submitTraining({
        character_id: id,
        instance_prompt:
          instancePrompt ||
          `photo of ${character?.trigger_word || character?.name?.toLowerCase()} person`,
        class_prompt: classPrompt,
        max_train_steps: maxSteps,
        base_model_type: baseModel,
      }),
  });

  const { data: trainingStatus, refetch: refreshStatus } = useQuery({
    queryKey: ["training-status", id],
    queryFn: () => api.refreshTrainingStatus(id),
    enabled: step === 3,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "training" || s === "deploying_gpu" ? 10000 : false;
    },
  });

  const handleSubmit = async () => {
    try {
      await submitTraining.mutateAsync();
      toast.success("Training job submitted!");
      setStep(3);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Training submission failed"
      );
    }
  };

  const trainingImages = images?.filter((i) => i.image_type === "training") || [];
  const hasEnoughImages = trainingImages.length >= 5;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Train LoRA</h1>
        <p className="text-muted-foreground">
          Train a custom LoRA model for {character?.name}
        </p>
      </div>

      <div className="flex gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
              s === step
                ? "bg-primary text-primary-foreground"
                : s < step
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {s < step ? <CheckCircle className="h-4 w-4" /> : s}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Review Training Images</CardTitle>
            <CardDescription>
              Ensure you have at least 5 high-quality training images
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              {hasEnoughImages ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  {trainingImages.length} images ready
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {trainingImages.length}/5 images (need more)
                </Badge>
              )}
            </div>

            {trainingImages.length > 0 && (
              <div className="grid grid-cols-5 gap-2">
                {trainingImages.map((img) => (
                  <img
                    key={img.id}
                    src={
                      img.file_path
                        ? `${API_BASE}/storage/${img.file_path}`
                        : img.public_url || ""
                    }
                    alt="Training"
                    className="aspect-square rounded-md object-cover"
                  />
                ))}
              </div>
            )}

            {!hasEnoughImages && (
              <p className="text-sm text-muted-foreground">
                Go back to the character page to upload more images.
              </p>
            )}

            <Button
              onClick={() => setStep(2)}
              disabled={!hasEnoughImages}
              className="w-full"
            >
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Configure Training</CardTitle>
            <CardDescription>
              Set up training parameters. Default values work well for most cases.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Instance Prompt</Label>
              <Input
                value={
                  instancePrompt ||
                  `photo of ${character?.trigger_word || "person"} person`
                }
                onChange={(e) => setInstancePrompt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Describes what the training images show
              </p>
            </div>

            <div className="space-y-2">
              <Label>Class Prompt</Label>
              <Input
                value={classPrompt}
                onChange={(e) => setClassPrompt(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Max Training Steps</Label>
                <span className="text-sm text-muted-foreground">
                  {maxSteps}
                </span>
              </div>
              <Slider
                value={[maxSteps]}
                onValueChange={([v]) => setMaxSteps(v)}
                min={1000}
                max={3000}
                step={100}
              />
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

            <div className="rounded-md bg-muted p-3">
              <p className="text-sm font-medium">Estimated cost: $1.00</p>
              <p className="text-xs text-muted-foreground">
                Charged to your ModelsLab wallet
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitTraining.isPending}
                className="flex-1"
              >
                {submitTraining.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <GraduationCap className="mr-2 h-4 w-4" />
                )}
                Submit Training
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Training Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              {trainingStatus?.status === "deployed" ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : trainingStatus?.status === "failed" ? (
                <AlertCircle className="h-6 w-6 text-destructive" />
              ) : (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              )}
              <div>
                <p className="font-medium capitalize">
                  {trainingStatus?.status || "Submitting..."}
                </p>
                {trainingStatus?.training_id && (
                  <p className="text-xs text-muted-foreground">
                    ID: {trainingStatus.training_id}
                  </p>
                )}
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => refreshStatus()}
              className="w-full"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Status
            </Button>

            {trainingStatus?.status === "deployed" && (
              <Button
                onClick={() => router.push(`/generate?character=${id}`)}
                className="w-full"
              >
                <Wand2 className="mr-2 h-4 w-4" />
                Generate with LoRA
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
