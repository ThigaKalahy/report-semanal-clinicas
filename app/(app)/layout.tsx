import Link from "next/link";
import { LayoutDashboard, Building2, FileText } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clinicas", label: "Clínicas", icon: Building2 },
  { href: "/relatorio", label: "Gerar Relatório", icon: FileText },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <aside className="w-60 shrink-0 border-r bg-sidebar flex flex-col">
        <div className="px-6 py-5">
          <span className="text-sm font-semibold tracking-tight">
            Relatório Semanal
          </span>
        </div>
        <Separator />
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
        <Separator />
        <div className="px-6 py-4 text-xs text-muted-foreground">
          v0.1.0
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-background">
        {children}
      </main>
    </div>
  );
}
