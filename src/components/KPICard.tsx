import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  className?: string;
}

export const KPICard = ({ title, value, icon: Icon, trend, className }: KPICardProps) => {
  return (
    <Card className={cn("hover:shadow-lg transition-all duration-300", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-2">{title}</p>
            <h3 className="text-2xl font-bold text-foreground mb-3">{value}</h3>
            {trend && (
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full",
                    trend.isPositive
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  )}
                >
                  {trend.value}
                </span>
              </div>
            )}
          </div>
          <div className="flex-shrink-0">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Icon className="h-6 w-6 text-primary" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
