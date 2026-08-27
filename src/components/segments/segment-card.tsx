import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SegmentFormDialog } from "@/components/segments/segment-form-dialog";
import { DeleteSegmentButton } from "@/components/segments/delete-segment-button";
import type { SegmentWithConditions } from "@/lib/repositories/segment-repository";

interface SegmentCardProps {
  segment: SegmentWithConditions;
  memberCount: number;
  canManage: boolean;
}

export async function SegmentCard({ segment, memberCount, canManage }: SegmentCardProps) {
  const t = await getTranslations("segments");

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            {segment.name}
            {segment.is_system ? (
              <Badge variant="secondary" className="text-[10px]">
                {t("system")}
              </Badge>
            ) : null}
          </CardTitle>
          {segment.description ? <p className="mt-1 text-sm text-muted-foreground">{segment.description}</p> : null}
        </div>
        {canManage ? (
          <div className="flex shrink-0 items-center gap-1">
            <SegmentFormDialog
              mode="edit"
              segmentId={segment.id}
              initialName={segment.name}
              initialDescription={segment.description}
              initialConditions={segment.conditions}
            />
            {!segment.is_system ? <DeleteSegmentButton segmentId={segment.id} segmentName={segment.name} /> : null}
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{memberCount.toLocaleString("en-US")}</p>
        <p className="text-xs text-muted-foreground">{t("customersLabel")}</p>
      </CardContent>
    </Card>
  );
}
