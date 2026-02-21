"use client";

import { useState } from "react";
import { useSettings, useUpdateApiKey } from "@/hooks/useSettings";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Eye, EyeOff, Save, CheckCircle } from "lucide-react";

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const updateApiKey = useUpdateApiKey();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }
    try {
      await updateApiKey.mutateAsync(apiKey);
      toast.success("API key updated successfully");
      setApiKey("");
    } catch (error) {
      toast.error("Failed to update API key");
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading settings...</div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure your ModelsLab API key and default parameters
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Key</CardTitle>
          <CardDescription>
            Your ModelsLab API key for image generation and training.
            Get one at{" "}
            <a
              href="https://modelslab.com/dashboard/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              modelslab.com/dashboard/api-keys
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            {settings?.has_api_key ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                Configured
              </Badge>
            ) : (
              <Badge variant="destructive">Not configured</Badge>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="apiKey"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your ModelsLab API key"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <Button
                onClick={handleSave}
                disabled={updateApiKey.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default Parameters</CardTitle>
          <CardDescription>
            Default values used for image generation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">Model</Label>
              <p className="font-medium">
                {settings?.default_model_id || "sdxl"}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">LoRA Base</Label>
              <p className="font-medium">
                {settings?.default_lora_base || "sdxl"}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Guidance Scale</Label>
              <p className="font-medium">
                {settings?.default_guidance_scale ?? 7.5}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">
                Inference Steps
              </Label>
              <p className="font-medium">
                {settings?.default_num_steps ?? 31}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Width</Label>
              <p className="font-medium">
                {settings?.default_width ?? 1024}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Height</Label>
              <p className="font-medium">
                {settings?.default_height ?? 1024}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
