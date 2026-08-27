import { Badge } from "@/components/ui/badge";
import { farolColor } from "@/lib/format";
import type { Farol } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FarolBadge({ farol }: { farol: Farol | string | null | undefined }) {
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", farolColor(farol))}>
      {farol ?? "—"}
    </Badge>
  );
}
