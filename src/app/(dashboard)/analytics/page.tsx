import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/session";
import { getCohortRetention, getVoiceOfCustomer } from "@/lib/repositories/sales-intelligence-repository";
import { listExperiments } from "@/lib/repositories/experiments-repository";
import { ExperimentsPanel } from "@/components/analytics/experiments-panel";

const RETENTION_WINDOWS = [30, 60, 90, 180];

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const t = await getTranslations("analytics");
  const canManageExperiments = user.can("experiments.manage");

  const [cohorts, voiceOfCustomer, experiments] = await Promise.all([getCohortRetention(), getVoiceOfCustomer(), listExperiments()]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("cohortTitle")}</CardTitle>
          <CardDescription>{t("cohortDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {cohorts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noCustomerData")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("cohort")}</TableHead>
                    <TableHead className="text-right">{t("customers")}</TableHead>
                    {RETENTION_WINDOWS.map((w) => (
                      <TableHead key={w} className="text-right">
                        {w}d
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cohorts.map((cohort) => (
                    <TableRow key={cohort.cohortMonth}>
                      <TableCell className="text-sm">{cohort.cohortMonth}</TableCell>
                      <TableCell className="text-right tabular-nums">{cohort.customersInCohort}</TableCell>
                      {RETENTION_WINDOWS.map((w) => (
                        <TableCell key={w} className="text-right tabular-nums">
                          {cohort.retention[w] !== null && cohort.retention[w] !== undefined ? `${cohort.retention[w]}%` : "—"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("vocTitle")}</CardTitle>
          <CardDescription>{t("vocDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {voiceOfCustomer.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noCancellations")}</p>
          ) : (
            <ul className="space-y-2">
              {voiceOfCustomer.map((row) => (
                <li key={row.reasonCategory} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize">{row.reasonCategory.replace(/_/g, " ")}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {row.percentage}% ({row.count})
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${row.percentage}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-base font-semibold">{t("experimentCenter")}</h2>
        <ExperimentsPanel experiments={experiments} canManage={canManageExperiments} />
      </div>
    </div>
  );
}
