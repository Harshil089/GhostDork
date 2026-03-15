import type { Metadata } from "next";

import { GhostDorkDashboard } from "@/components/dashboard/ghostdork-dashboard";

export const metadata: Metadata = {
  title: "GhostDork — OSINT Research Dashboard",
  description:
    "Private OSINT research dashboard for authorized educational workflows, structured search pivots, document discovery, image analysis, and target sweeps.",
};

export default function HomePage() {
  return <GhostDorkDashboard />;
}
