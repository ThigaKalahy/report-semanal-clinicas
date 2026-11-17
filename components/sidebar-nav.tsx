"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ScrollText,
  Building2,
  FileText,
  TrendingUp,
  Target,
  CalendarOff,
  ClipboardCheck,
  CalendarDays,
  History,
  Columns3,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

const mainNavItems = [
  { href: "/clinicas", label: "Clínicas", icon: Building2 },
  // Antes do report: o checkpoint é a conferência que vem primeiro no fluxo.
  { href: "/checkpoint", label: "Checkpoint", icon: ClipboardCheck },
  { href: "/relatorio", label: "Gerar Report Semanal", icon: FileText },
  { href: "/dashboard", label: "Logs", icon: ScrollText },
];

/** Módulo financeiro: tudo o que veio do Sync Financeiro mora aqui dentro. */
const financeiroNavItems = [
  { href: "/fechamentos", label: "Fechamentos do mês", icon: CalendarDays },
  { href: "/fechamentos/historico", label: "Histórico", icon: History },
  { href: "/fechamentos/comparativos", label: "Comparativos", icon: Columns3 },
];

const configNavItems = [
  { href: "/configuracoes/tipos-meta", label: "Tipos de Meta", icon: Target },
  { href: "/configuracoes/feriados", label: "Feriados", icon: CalendarOff },
];

export function SidebarNav() {
  const pathname = usePathname();
  const noFinanceiro = financeiroNavItems.some(({ href }) => pathname === href || pathname.startsWith(href + "/")) || pathname.startsWith("/fechamentos-pdf/");
  const [financeiroAberto, setFinanceiroAberto] = useState(noFinanceiro);
  const [estavaNoFinanceiro, setEstavaNoFinanceiro] = useState(noFinanceiro);

  // entrar numa tela do módulo (por link, atalho ou busca) abre o grupo
  if (noFinanceiro !== estavaNoFinanceiro) {
    setEstavaNoFinanceiro(noFinanceiro);
    if (noFinanceiro) setFinanceiroAberto(true);
  }

  function isActive(href: string) {
    if (pathname === href) return true;
    if (!pathname.startsWith(href + "/")) return false;
    // um item mais específico do menu ganha (Comparativos não acende Fechamentos)
    return !financeiroNavItems.some((i) => i.href !== href && i.href.startsWith(href + "/") &&
      (pathname === i.href || pathname.startsWith(i.href + "/")));
  }

  function navLink(href: string, label: string, Icon: React.ElementType, indent = false) {
    const active = isActive(href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors",
          indent ? "px-5" : "px-3",
          active
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </Link>
    );
  }

  return (
    <nav className="space-y-0.5">
      {mainNavItems.map(({ href, label, icon }) => navLink(href, label, icon))}

      <button
        type="button"
        onClick={() => setFinanceiroAberto((v) => !v)}
        aria-expanded={financeiroAberto}
        aria-controls="menu-financeiro"
        className={cn(
          "w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          noFinanceiro && !financeiroAberto ? "text-sidebar-primary" : "text-sidebar-foreground"
        )}
      >
        <TrendingUp className="h-4 w-4 shrink-0" />
        <span>Reports Financeiros</span>
        <ChevronDown
          className={cn("ml-auto h-4 w-4 shrink-0 transition-transform", financeiroAberto ? "rotate-0" : "-rotate-90")}
        />
      </button>
      {financeiroAberto && (
        <div id="menu-financeiro" className="space-y-0.5 pl-4">
          {financeiroNavItems.map(({ href, label, icon }) => navLink(href, label, icon))}
        </div>
      )}

      <div className="pt-4 pb-0.5">
        <p className="px-3 text-[10px] font-semibold text-sidebar-foreground/50 uppercase tracking-widest font-heading">
          Configurações
        </p>
      </div>

      {configNavItems.map(({ href, label, icon }) => navLink(href, label, icon, true))}
    </nav>
  );
}
