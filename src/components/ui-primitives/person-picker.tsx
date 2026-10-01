"use client";

// Picker de pessoa "flexível": sugere clientes cadastrados mas aceita QUALQUER
// nome digitado (cliente avulso, sem cadastro). Usado em transações e contas
// a receber para não obrigar ninguém a cadastrar cliente antes de lançar.

import { useEffect, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, UserPlus, X, Loader2 } from "lucide-react";

interface PersonPickerProps {
  value: string; // texto exibido (nome)
  options: { value: string; label: string }[]; // clientes cadastrados
  onPickRegistered: (id: string, label: string) => void;
  onPickFree: (name: string) => void;
  onClear?: () => void;
  placeholder?: string;
  loadingOptions?: boolean;
}

export function PersonPicker({
  value,
  options,
  onPickRegistered,
  onPickFree,
  onClear,
  placeholder,
  loadingOptions,
}: PersonPickerProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(value);
  }, [value]);

  const trimmed = text.trim();
  const exactMatch =
    trimmed.length > 0 &&
    options.some((o) => o.label.toLowerCase() === trimmed.toLowerCase());
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(trimmed.toLowerCase())
  );

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
      }}
    >
      <PopoverTrigger asChild>
        <div className="relative w-full">
          <Input
            ref={inputRef}
            value={text}
            onChange={(e) => {
              const v = e.target.value;
              setText(v);
              onPickFree(v); // digitação livre sempre vira "avulso" até selecionar um cadastrado
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder || "Nome da pessoa (cadastrada ou avulsa)"}
            className="h-10 pr-8"
            autoComplete="off"
          />
          {text && onClear && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setText("");
                onClear();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              title="Limpar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandList className="max-h-60">
            {loadingOptions ? (
              <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Carregando clientes...
              </div>
            ) : (
              <>
                {filtered.length > 0 && (
                  <CommandGroup heading="Clientes cadastrados">
                    {filtered.slice(0, 8).map((o) => (
                      <CommandItem
                        key={o.value}
                        value={o.label}
                        onSelect={() => {
                          setText(o.label);
                          onPickRegistered(o.value, o.label);
                          setOpen(false);
                        }}
                        className="gap-2"
                      >
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 truncate">{o.label}</span>
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 border-primary/30 text-primary"
                        >
                          cadastrado
                        </Badge>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {trimmed.length > 0 && !exactMatch && (
                  <CommandGroup heading="Sem cadastro">
                    <CommandItem
                      value={`usar-${trimmed}`}
                      onSelect={() => {
                        onPickFree(trimmed);
                        setOpen(false);
                      }}
                      className="gap-2"
                    >
                      <UserPlus className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate">
                        Usar &quot;{trimmed}&quot; como pessoa avulsa
                      </span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0">
                        sem cadastro
                      </Badge>
                    </CommandItem>
                  </CommandGroup>
                )}
                {trimmed.length === 0 && filtered.length === 0 && (
                  <CommandEmpty>
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Nenhum cliente cadastrado — pode digitar um nome livre
                      mesmo assim.
                    </div>
                  </CommandEmpty>
                )}
                {trimmed.length > 0 && filtered.length === 0 && (
                  <CommandEmpty>
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Nenhum cadastrado com esse nome — a opção avulsa acima
                      resolve.
                    </div>
                  </CommandEmpty>
                )}
              </>
            )}
          </CommandList>
        </Command>
        <div className="border-t border-border/60 px-3 py-2 text-[10px] text-muted-foreground flex items-center justify-between gap-2">
          <span>Digite livremente — cadastrar cliente é opcional.</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={(e) => {
              e.preventDefault();
              setOpen(false);
            }}
          >
            Fechar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
