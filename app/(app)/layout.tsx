import { Separator } from "@/components/ui/separator";
import { GestfyLogo } from "@/components/brand/gestfy-logo";
import { SidebarNav } from "@/components/sidebar-nav";
import { SidebarFooterClient } from "@/components/sidebar-footer-client";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <aside className="w-64 shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col">
        <div className="px-5 py-5">
          <GestfyLogo variant="full" size={32} showSubtitle />
        </div>

        <Separator className="bg-sidebar-border" />

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav />
        </div>

        <Separator className="bg-sidebar-border" />

        <SidebarFooterClient />
      </aside>

      <main className="flex-1 overflow-auto bg-background">
        {children}
      </main>
    </div>
  );
}
