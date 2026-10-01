"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PageHeader, EmptyState } from "@/components/ui-primitives/page-header";
import { FormModal, type Field } from "@/components/ui-primitives/form-modal";
import { useFetch, useRefresh } from "@/lib/api-hooks";
import { formatCurrency } from "@/lib/format";
import {
  Users,
  Plus,
  Search,
  Pencil,
  Mail,
  Phone,
  MapPin,
  Repeat,
  BadgeCheck,
  IdCard,
  FileText,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ClientOrder {
  id: string;
  title: string;
  status: string;
  price: number | string;
}

interface Client {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  document?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  notes?: string | null;
  isMonthly: boolean;
  monthlyFee?: number | string | null;
  monthlyDay?: number | string | null;
  orders?: ClientOrder[];
}

const FIELDS: Field[] = [
  { name: "name", label: "Nome", type: "text", required: true, placeholder: "João Silva" },
  { name: "email", label: "Email", type: "email", placeholder: "joao@email.com" },
  { name: "phone", label: "Telefone", type: "tel", placeholder: "(11) 99999-9999" },
  { name: "document", label: "Documento (CPF/CNPJ)", type: "text", placeholder: "000.000.000-00" },
  { name: "address", label: "Endereço", type: "textarea", placeholder: "Rua, número, complemento" },
  { name: "city", label: "Cidade", type: "text", placeholder: "São Paulo" },
  { name: "state", label: "Estado (UF)", type: "text", placeholder: "SP" },
  { name: "zip", label: "CEP", type: "text", placeholder: "00000-000" },
  { name: "notes", label: "Observações", type: "textarea", placeholder: "Preferências, anotações..." },
  { name: "isMonthly", label: "Cliente mensalista (recorrente)", type: "switch", default: false },
  { name: "monthlyFee", label: "Mensalidade (R$)", type: "number", step: "0.01", placeholder: "0,00" },
  { name: "monthlyDay", label: "Dia de vencimento", type: "number", placeholder: "1" },
];

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function stringToHue(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(hash) % 360;
}

export function ClientsView() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const refresh = useRefresh();

  // debounce search input -> search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const url = search
    ? `/api/crud/clients?search=${encodeURIComponent(search)}`
    : `/api/crud/clients`;

  const { data, loading } = useFetch<Client[]>(url);

  const filtered = useMemo(() => data ?? [], [data]);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(client: Client) {
    // Normalize decimals for number inputs (Prisma returns Decimal objects)
    setEditing({
      ...client,
      monthlyFee:
        client.monthlyFee !== null && client.monthlyFee !== undefined
          ? Number(client.monthlyFee)
          : "",
      monthlyDay:
        client.monthlyDay !== null && client.monthlyDay !== undefined
          ? Number(client.monthlyDay)
          : "",
    } as any);
    setOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Cadastre e gerencie seus clientes e mensalistas"
        icon={<Users className="h-5 w-5" />}
        action={{
          label: "Novo Cliente",
          onClick: openCreate,
          icon: <Plus className="h-4 w-4 mr-2" />,
        }}
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar por nome, email ou telefone..."
          className="pl-9 h-10"
          aria-label="Buscar clientes"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-7 w-7" />}
          title={search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          description={
            search
              ? `Tente buscar por outro termo.`
              : "Cadastre seu primeiro cliente para começar a organizar sua carteira."
          }
          action={!search ? { label: "Novo Cliente", onClick: openCreate } : undefined}
        />
      ) : (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.05 } },
          }}
        >
          {filtered.map((client) => {
            const hue = stringToHue(client.name);
            const initials = getInitials(client.name);
            const orders = client.orders ?? [];
            const activeOrders = orders.filter(
              (o) => !["done", "delivered"].includes(o.status)
            ).length;
            return (
              <motion.button
                key={client.id}
                type="button"
                onClick={() => openEdit(client)}
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  visible: { opacity: 1, y: 0 },
                }}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="text-left rounded-2xl border border-border/60 bg-card p-5 shadow-sm hover:shadow-md hover:border-primary/40 transition-all group focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-background"
                aria-label={`Editar cliente ${client.name}`}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback
                      className="text-sm font-bold text-white"
                      style={{
                        background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${
                          (hue + 30) % 360
                        } 70% 45%))`,
                      }}
                    >
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold truncate">{client.name}</h3>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {client.isMonthly && (
                        <Badge className="bg-primary/15 text-primary border border-primary/20 hover:bg-primary/20">
                          <Repeat className="h-3 w-3" /> Mensalista
                        </Badge>
                      )}
                      {client.isMonthly && client.monthlyFee ? (
                        <Badge
                          variant="outline"
                          className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        >
                          {formatCurrency(Number(client.monthlyFee))}
                          {client.monthlyDay ? `/mês` : ""}
                        </Badge>
                      ) : null}
                      {activeOrders > 0 && (
                        <Badge variant="secondary" className="text-accent-blue">
                          {activeOrders} ativa{activeOrders > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  {client.email && (
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span>{client.phone}</span>
                    </div>
                  )}
                  {(client.city || client.state) && (
                    <div className="flex items-center gap-2 truncate">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {[client.city, client.state].filter(Boolean).join(" - ")}
                        {client.zip ? ` • CEP ${client.zip}` : ""}
                      </span>
                    </div>
                  )}
                  {client.document && (
                    <div className="flex items-center gap-2">
                      <IdCard className="h-3.5 w-3.5 shrink-0" />
                      <span>{client.document}</span>
                    </div>
                  )}
                </div>

                {client.notes && (
                  <div className="mt-3 pt-3 border-t border-border/40 flex items-start gap-2 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <p className="line-clamp-2">{client.notes}</p>
                  </div>
                )}

                {client.isMonthly && (
                  <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-2 text-xs">
                    <BadgeCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-muted-foreground">
                      Vence dia {String(client.monthlyDay ?? 1).padStart(2, "0")} •{" "}
                      <span className="font-semibold text-foreground">
                        {formatCurrency(Number(client.monthlyFee ?? 0))}
                      </span>
                    </span>
                  </div>
                )}
              </motion.button>
            );
          })}
        </motion.div>
      )}

      <FormModal
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
        title={editing ? "Editar Cliente" : "Novo Cliente"}
        description="Preencha os dados do cliente. Campos com * são obrigatórios."
        fields={FIELDS}
        initialData={editing ?? undefined}
        endpoint="/api/crud/clients"
        id={editing?.id}
        onSaved={() => {
          refresh();
          toast.success(
            editing ? "Cliente atualizado" : "Cliente criado",
            { description: editing ? "Dados salvos com sucesso." : "Novo cliente adicionado." }
          );
        }}
      />
    </div>
  );
}
