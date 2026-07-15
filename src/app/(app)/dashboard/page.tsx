import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Placeholder dashboard so post-login lands on a real page in Phase 1.
// Replaced by the full metrics dashboard (metric cards, recent runs, recent
// errors) in Phase 2.
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Observability overview for your agent runs.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Phase 1 complete</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          The scaffold, schema, seed data, and auth are in place. The full
          metrics dashboard, runs list, and trace timeline arrive in Phase 2.
          Explore the seeded runs now with <code>npx prisma studio</code>.
        </CardContent>
      </Card>
    </div>
  );
}
