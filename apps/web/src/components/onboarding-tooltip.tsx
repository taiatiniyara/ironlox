"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, ArrowRight } from "lucide-react";

interface OnboardingTooltipProps {
  step: number;
  title: string;
  description: string;
  children?: React.ReactNode;
  onNext: () => void;
  onDismiss: () => void;
  totalSteps: number;
}

export function OnboardingTooltip({
  step,
  title,
  description,
  children,
  onNext,
  onDismiss,
  totalSteps,
}: OnboardingTooltipProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-lg animate-fade-in-up">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Step {step} of {totalSteps}
        </p>
        <Button variant="ghost" size="icon" className="size-5" onClick={onDismiss}>
          <X className="size-3" />
        </Button>
      </div>
      <h3 className="text-sm font-semibold mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground mb-3">{description}</p>
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full w-4 transition-colors ${
                i + 1 === step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <Button variant="outline" size="sm" className="gap-1" onClick={onNext}>
          {step === totalSteps ? "Done" : "Next"}
          <ArrowRight className="size-3" />
        </Button>
      </div>
      {children}
    </div>
  );
}

export function OnboardingTour() {
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("ironlox_onboarding_dismissed");
    if (stored === "true") setDismissed(true);
  }, []);

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem("ironlox_onboarding_dismissed", "true");
  }

  function handleNext() {
    if (step >= 3) {
      handleDismiss();
    } else {
      setStep((s) => s + 1);
    }
  }

  if (dismissed) return null;

  const steps = [
    {
      title: "Welcome to your Vault",
      description:
        "This is where all your passwords, cards, notes, and identities live. Everything is encrypted before it leaves your device.",
    },
    {
      title: "Search and Filter",
      description:
        "Use the search bar to find items by name, username, or URL. Filter by category (Login, Card, Note, Identity) or by tags.",
    },
    {
      title: "Add Your First Item",
      description:
        "Click the + button or press 'N' to create your first login, card, note, or identity. Import from another password manager via the Import page.",
    },
    {
      title: "Stay Secure",
      description:
        "Visit the Security Dashboard to check your passwords against breaches, find weak or reused passwords, and enable 2FA.",
    },
  ];

  const currentStep = steps[step];
  if (!currentStep) return null;

  return (
    <div className="mb-4">
      <OnboardingTooltip
        step={step + 1}
        title={currentStep.title}
        description={currentStep.description}
        onNext={handleNext}
        onDismiss={handleDismiss}
        totalSteps={steps.length}
      />
    </div>
  );
}
