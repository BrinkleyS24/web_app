import { DashboardLayout } from "@/components/DashboardLayout";
import { Wrench } from "lucide-react";

const FixSuggestions = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Wrench className="w-6 h-6 text-accent" />
            Fix Suggestions
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Targeted resume edits for each job.</p>
        </div>
        <div className="glass-card rounded-xl p-6 text-sm text-muted-foreground">
          Fix Suggestions will appear once we finish integrating personalized feedback from your email history.
        </div>
      </div>
    </DashboardLayout>
  );
};

export default FixSuggestions;
