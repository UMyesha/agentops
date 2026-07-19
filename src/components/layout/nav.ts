import {
  LayoutDashboard,
  FolderKanban,
  Workflow,
  ListChecks,
  ShieldAlert,
  GitBranch,
  Activity,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Primary navigation, shared by the desktop Sidebar and the mobile Dialog nav. */
export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/runs", label: "Runs", icon: Activity },
  { href: "/evaluations", label: "Evaluations", icon: ListChecks },
  { href: "/guardrails", label: "Guardrails", icon: ShieldAlert },
  { href: "/prompts", label: "Prompt Versions", icon: GitBranch },
];

export { Workflow as BrandIcon };

/** True when `pathname` is within the given nav section. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Human labels for the first path segment (section root).
const SECTION_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  runs: "Runs",
  evaluations: "Evaluations",
  guardrails: "Guardrails",
  prompts: "Prompt Versions",
  workflows: "Workflows",
  "tool-calls": "Tool Calls",
};

export interface Crumb {
  label: string;
  href?: string; // omitted for the current (last) crumb
}

/**
 * Derive a readable breadcrumb from a pathname. The first segment maps to a
 * known section label (linked); a following id-like segment renders as a short,
 * unlinked "Detail" crumb. Pure + framework-free so it is unit-testable.
 */
export function breadcrumbFromPath(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [{ label: "Dashboard" }];

  const [section, detail] = segments;
  const sectionLabel = SECTION_LABELS[section] ?? humanize(section);
  const crumbs: Crumb[] = [];

  if (detail) {
    crumbs.push({ label: sectionLabel, href: `/${section}` });
    crumbs.push({ label: "Detail" });
  } else {
    crumbs.push({ label: sectionLabel });
  }
  return crumbs;
}

function humanize(segment: string): string {
  return segment
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
