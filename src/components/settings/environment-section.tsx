"use client";

import { useEffect, useState, useCallback } from "react";
import { Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FormSectionCard } from "@/components/shared/form-section-card";

interface EnvironmentState {
  autoPromoteSkills: boolean;
}

const DEFAULT_STATE: EnvironmentState = {
  autoPromoteSkills: false,
};

export function EnvironmentSection() {
  const [state, setState] = useState<EnvironmentState>(DEFAULT_STATE);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/environment");
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch {
      // Use defaults
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleToggle = async (value: boolean) => {
    setState((prev) => ({ ...prev, autoPromoteSkills: value }));
    setSaving(true);
    try {
      const res = await fetch("/api/settings/environment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoPromoteSkills: value }),
      });
      if (res.ok) {
        const data = await res.json();
        setState(data);
        toast.success(`Auto-promote ${value ? "enabled" : "disabled"}`);
      } else {
        throw new Error("Save failed");
      }
    } catch {
      toast.error("Failed to save setting");
      setState((prev) => ({ ...prev, autoPromoteSkills: !value }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Environment
        </CardTitle>
        <CardDescription>
          How Orionfold Relay discovers and syncs skills from your environment into the
          agent profile registry.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormSectionCard
          icon={Wand2}
          title="Auto-promote discovered skills"
          hint="When enabled, every unlinked skill in ~/.claude/skills/ with a valid SKILL.md is automatically converted into an agent profile on the next environment scan. Leave off to review and promote skills manually from the Environment dashboard."
        >
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-promote-toggle" className="text-sm">
              {state.autoPromoteSkills ? "Enabled" : "Disabled"}
            </Label>
            <Switch
              id="auto-promote-toggle"
              checked={state.autoPromoteSkills}
              disabled={saving}
              onCheckedChange={handleToggle}
            />
          </div>
        </FormSectionCard>
      </CardContent>
    </Card>
  );
}
