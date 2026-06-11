"use client";

import { useState } from "react";
import { Wand2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { generatePassword, generatePassphrase } from "@ironlox/crypto";
import { CopyButton } from "@/components/shared/copy-button";

interface PasswordGeneratorProps {
  onSelect: (password: string) => void;
}

export function PasswordGenerator({ onSelect }: PasswordGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"password" | "passphrase">("password");

  // Password options
  const [length, setLength] = useState(20);
  const [upper, setUpper] = useState(true);
  const [lower, setLower] = useState(true);
  const [numbers, setNumbers] = useState(true);
  const [symbols, setSymbols] = useState(true);

  // Passphrase options
  const [wordCount, setWordCount] = useState(4);
  const [separator, setSeparator] = useState("-");
  const [capitalize, setCapitalize] = useState(false);

  const [generated, setGenerated] = useState("");

  function generate() {
    if (mode === "password") {
      setGenerated(generatePassword({ length, uppercase: upper, lowercase: lower, numbers, symbols }));
    } else {
      setGenerated(generatePassphrase({ wordCount, separator, capitalize }));
    }
  }

  function handleSelect() {
    if (generated) {
      onSelect(generated);
      setOpen(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="inline-flex items-center justify-center rounded-lg border border-input bg-background hover:bg-muted size-8 shrink-0 transition-colors">
        <Wand2 className="size-4" />
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <Tabs value={mode} onValueChange={(v) => setMode(v as "password" | "passphrase")}>
          <TabsList className="w-full">
            <TabsTrigger value="password" className="flex-1">Password</TabsTrigger>
            <TabsTrigger value="passphrase" className="flex-1">Passphrase</TabsTrigger>
          </TabsList>

          <TabsContent value="password" className="space-y-3 mt-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Length: {length}</Label>
              </div>
              <Slider
                value={[length]}
                onValueChange={(v) => { if (Array.isArray(v)) setLength(v[0] ?? 20); }}
                min={8}
                max={128}
                step={1}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <Checkbox id="upper" checked={upper} onCheckedChange={(c) => setUpper(!!c)} />
                <Label htmlFor="upper" className="text-xs">A-Z</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="lower" checked={lower} onCheckedChange={(c) => setLower(!!c)} />
                <Label htmlFor="lower" className="text-xs">a-z</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="nums" checked={numbers} onCheckedChange={(c) => setNumbers(!!c)} />
                <Label htmlFor="nums" className="text-xs">0-9</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="sym" checked={symbols} onCheckedChange={(c) => setSymbols(!!c)} />
                <Label htmlFor="sym" className="text-xs">!@#$</Label>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="passphrase" className="space-y-3 mt-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Words: {wordCount}</Label>
              </div>
              <Slider
                value={[wordCount]}
                onValueChange={(v) => { if (Array.isArray(v)) setWordCount(v[0] ?? 4); }}
                min={3}
                max={10}
                step={1}
              />
            </div>
            <div className="flex items-center gap-4">
              <Label className="text-xs">Separator</Label>
              <div className="flex gap-1">
                {["-", " ", ".", ""].map((sep) => (
                  <Button
                    key={sep}
                    variant={separator === sep ? "default" : "outline"}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setSeparator(sep)}
                  >
                    {sep || "none"}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="cap" checked={capitalize} onCheckedChange={(c) => setCapitalize(!!c)} />
              <Label htmlFor="cap" className="text-xs">Capitalize</Label>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={generate}>
              <RefreshCw className="size-3.5 mr-1" />
              Generate
            </Button>
          </div>
          {generated && (
            <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm font-mono break-all">
              <span className="flex-1 text-xs">{generated}</span>
              <CopyButton value={generated} />
            </div>
          )}
          <Button
            className="w-full"
            size="sm"
            disabled={!generated}
            onClick={handleSelect}
          >
            Use This {mode === "password" ? "Password" : "Passphrase"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
