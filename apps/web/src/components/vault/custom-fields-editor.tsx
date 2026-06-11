"use client";

import { Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type CustomFieldType = "text" | "hidden";

interface CustomField {
  name: string;
  value: string;
  type: CustomFieldType;
}

interface CustomFieldsEditorProps {
  fields: CustomField[];
  onChange: (fields: CustomField[]) => void;
}

export function CustomFieldsEditor({ fields, onChange }: CustomFieldsEditorProps) {
  function addField() {
    onChange([...fields, { name: "", value: "", type: "text" }]);
  }

  function updateField(index: number, update: Partial<CustomField>) {
    const updated = fields.map((f, i) => (i === index ? { ...f, ...update } : f));
    onChange(updated);
  }

  function removeField(index: number) {
    onChange(fields.filter((_, i) => i !== index));
  }

  function toggleType(index: number) {
    const field = fields[index];
    updateField(index, { type: field!.type === "text" ? "hidden" : "text" });
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">Custom Fields</Label>
      {fields.map((field, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="flex-1 space-y-1.5">
            <Input
              value={field.name}
              onChange={(e) => updateField(i, { name: e.target.value })}
              placeholder="Field name"
              className="text-xs h-8"
            />
            <div className="flex gap-1">
              <Input
                value={field.value}
                onChange={(e) => updateField(i, { value: e.target.value })}
                type={field.type === "hidden" ? "password" : "text"}
                placeholder="Value"
                className="text-xs h-8 flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => toggleType(i)}
              >
                {field.type === "hidden" ? (
                  <EyeOff className="size-3.5 text-muted-foreground" />
                ) : (
                  <Eye className="size-3.5 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 mt-1"
            onClick={() => removeField(i)}
          >
            <Trash2 className="size-3.5 text-muted-foreground" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={addField}
      >
        <Plus className="size-3.5 mr-1" />
        Add Field
      </Button>
    </div>
  );
}
