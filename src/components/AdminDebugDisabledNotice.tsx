import { ShieldAlert } from "lucide-react";

export function AdminDebugDisabledNotice() {
  return (
    <section className="glass-card rounded-xl p-6 space-y-2">
      <div className="flex items-center gap-2 text-warning-foreground">
        <ShieldAlert className="w-5 h-5" />
        <h2 className="text-base font-semibold text-foreground">Debug Routes Disabled</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        The frontend route is available for admin accounts, but the backend gate is off. Set
        {" "}
        <code>ENABLE_ADMIN_DEBUG_ROUTES=true</code>
        {" "}
        on the backend to enable live debug data and repair actions.
      </p>
    </section>
  );
}
