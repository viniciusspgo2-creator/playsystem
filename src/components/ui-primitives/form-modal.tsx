"use client";

import { useState, ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { apiPost, apiDelete } from "@/lib/api-hooks";
import { useRefresh } from "@/lib/api-hooks";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PersonPicker } from "@/components/ui-primitives/person-picker";

export type Field =
  | { name: string; label: string; type: "text" | "number" | "date" | "datetime-local" | "textarea" | "email" | "tel" | "color"; placeholder?: string; required?: boolean; step?: string; default?: any }
  | { name: string; label: string; type: "select"; options: { value: string; label: string }[]; placeholder?: string; required?: boolean; default?: any }
  | { name: string; label: string; type: "person"; options: { value: string; label: string }[]; placeholder?: string; required?: boolean; default?: any; idField?: string; nameField?: string; hint?: string; loadingOptions?: boolean }
  | { name: string; label: string; type: "switch"; default?: boolean }
  | { name: string; label: string; type: "checkbox"; default?: boolean };

interface FormModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  fields: Field[];
  initialData?: Record<string, any>;
  endpoint: string; // e.g. "/api/crud/clients"
  id?: string; // if provided, PUT; else POST
  onSaved?: () => void;
}

// Converte Date/ISO para o formato aceito por inputs de data (hora local)
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

// Monta o estado inicial do formulário; campos "person" derivam de idField/nameField
function buildInitial(
  fields: Field[],
  initialData?: Record<string, any>
): Record<string, any> {
  const v: Record<string, any> = {};
  for (const f of fields) {
    if (f.type === "person") {
      const idF = f.idField || "clientId";
      const nameF = f.nameField || "clientName";
      if (initialData && initialData[idF]) {
        const opt = (f.options || []).find((o) => o.value === initialData[idF]);
        v[f.name] = opt?.label ?? initialData[nameF] ?? f.default ?? "";
        v[idF] = initialData[idF];
        v[nameF] = null;
      } else if (initialData && initialData[nameF]) {
        v[f.name] = initialData[nameF];
        v[idF] = null;
        v[nameF] = initialData[nameF];
      } else {
        v[f.name] = f.default ?? "";
        v[idF] = null;
        v[nameF] = null;
      }
      continue;
    }
    if (initialData && initialData[f.name] !== undefined) {
      let val = initialData[f.name];
      if ((f.type === "date" || f.type === "datetime-local") && val) {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          val = f.type === "date" ? toLocalInputValue(d).slice(0, 10) : toLocalInputValue(d);
        }
      }
      v[f.name] = val;
    }
    else if (f.type === "switch" || f.type === "checkbox") v[f.name] = f.default ?? false;
    else v[f.name] = f.default ?? "";
  }
  return v;
}

export function FormModal({
  open,
  onOpenChange,
  title,
  description,
  fields,
  initialData,
  endpoint,
  id,
  onSaved,
}: FormModalProps) {
  const [values, setValues] = useState<Record<string, any>>(() =>
    buildInitial(fields, initialData)
  );
  const [loading, setLoading] = useState(false);
  const refresh = useRefresh();

  // reset values when modal reopens with new initial data
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      const v = buildInitial(fields, initialData);
      // schedule state update
      setTimeout(() => setValues(v), 0);
    }
  }

  function setField(name: string, val: any) {
    setValues((prev) => ({ ...prev, [name]: val }));
  }

  async function save() {
    setLoading(true);
    try {
      const body: Record<string, any> = { ...values };
      // convert numbers and empty optionals to null
      for (const f of fields) {
        if (f.type === "person") {
          // o picker escreve direto nos campos idField/nameField; o campo em si é só visual
          delete body[f.name];
          const idF = (f as any).idField || "clientId";
          const nameF = (f as any).nameField || "clientName";
          body[idF] = body[idF] || null;
          body[nameF] = body[nameF] || null;
          if (f.required && !body[idF] && !body[nameF]) {
            setLoading(false);
            toast.error(`${f.label}: selecione um cliente ou digite um nome`);
            return;
          }
          continue;
        }
        if (f.type === "number") body[f.name] = Number(body[f.name]) || 0;
        if (f.type === "date" || f.type === "datetime-local") {
          if (body[f.name]) body[f.name] = new Date(body[f.name]);
          else body[f.name] = null;
        }
        // Convert "__none__" placeholder and empty strings to null for non-required select fields
        if (f.type === "select" && !(f as any).required && (body[f.name] === "" || body[f.name] === undefined || body[f.name] === "__none__")) {
          body[f.name] = null;
        }
      }
      if (id) {
        await apiPost(`${endpoint}/${id}`, body, "PUT");
        toast.success("Atualizado com sucesso!");
      } else {
        await apiPost(endpoint, body);
        toast.success("Criado com sucesso!");
      }
      refresh();
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!id) return;
    if (!confirm("Tem certeza que deseja excluir?")) return;
    setLoading(true);
    try {
      await apiDelete(`${endpoint}/${id}`);
      toast.success("Excluído com sucesso!");
      refresh();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          {fields.map((f) => (
            <div
              key={f.name}
              className={f.type === "textarea" || f.type === "switch" || f.type === "checkbox" || f.type === "person" ? "sm:col-span-2" : ""}
            >
              {f.type !== "switch" && f.type !== "checkbox" && (
                <Label htmlFor={f.name} className="block mb-1.5 text-xs font-medium">
                  {f.label}
                  {f.type !== "select" && (f as any).required && <span className="text-destructive ml-0.5">*</span>}
                </Label>
              )}
              {f.type === "text" || f.type === "email" || f.type === "tel" || f.type === "number" || f.type === "date" || f.type === "datetime-local" ? (
                <Input
                  id={f.name}
                  type={f.type}
                  value={values[f.name] ?? ""}
                  onChange={(e) => setField(f.name, e.target.value)}
                  placeholder={(f as any).placeholder}
                  step={(f as any).step}
                  className="h-10"
                />
              ) : f.type === "color" ? (
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={values[f.name] ?? "#FF6B00"}
                    onChange={(e) => setField(f.name, e.target.value)}
                    className="h-10 w-14 rounded-lg border border-border cursor-pointer"
                  />
                  <Input value={values[f.name] ?? ""} onChange={(e) => setField(f.name, e.target.value)} className="h-10 flex-1" />
                </div>
              ) : f.type === "person" ? (
                <div>
                  <PersonPicker
                    value={values[f.name] ?? ""}
                    options={(f as any).options ?? []}
                    loadingOptions={(f as any).loadingOptions}
                    onPickRegistered={(id, label) => {
                      const idF = (f as any).idField || "clientId";
                      const nameF = (f as any).nameField || "clientName";
                      setValues((prev) => ({ ...prev, [f.name]: label, [idF]: id, [nameF]: null }));
                    }}
                    onPickFree={(name) => {
                      const idF = (f as any).idField || "clientId";
                      const nameF = (f as any).nameField || "clientName";
                      setValues((prev) => ({ ...prev, [f.name]: name, [idF]: null, [nameF]: name }));
                    }}
                    onClear={() => {
                      const idF = (f as any).idField || "clientId";
                      const nameF = (f as any).nameField || "clientName";
                      setValues((prev) => ({ ...prev, [f.name]: "", [idF]: null, [nameF]: null }));
                    }}
                    placeholder={(f as any).placeholder}
                  />
                  {(f as any).hint && (
                    <p className="text-[10px] text-muted-foreground mt-1">{(f as any).hint}</p>
                  )}
                </div>
              ) : f.type === "textarea" ? (
                <Textarea
                  id={f.name}
                  value={values[f.name] ?? ""}
                  onChange={(e) => setField(f.name, e.target.value)}
                  placeholder={(f as any).placeholder}
                  rows={3}
                />
              ) : f.type === "select" ? (
                <Select
                  value={values[f.name] || undefined}
                  onValueChange={(v) => setField(f.name, v)}
                >
                  <SelectTrigger className="h-10"><SelectValue placeholder={(f as any).placeholder || "Selecione..."} /></SelectTrigger>
                  <SelectContent>
                    {!(f as any).required && (
                      <SelectItem value="__none__">— Nenhum —</SelectItem>
                    )}
                    {f.options.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              ) : f.type === "switch" ? (
                <div className="flex items-center justify-between py-2">
                  <Label htmlFor={f.name} className="text-sm">{f.label}</Label>
                  <Switch id={f.name} checked={!!values[f.name]} onCheckedChange={(v) => setField(f.name, v)} />
                </div>
              ) : f.type === "checkbox" ? (
                <div className="flex items-center gap-2 py-2">
                  <Checkbox id={f.name} checked={!!values[f.name]} onCheckedChange={(v) => setField(f.name, v)} />
                  <Label htmlFor={f.name} className="text-sm">{f.label}</Label>
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2">
          {id && (
            <Button variant="destructive" onClick={remove} disabled={loading} className="mr-auto">
              Excluir
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {id ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
