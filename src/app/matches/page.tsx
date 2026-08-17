import type { Metadata } from "next";

import MatchesScreen from "@/components/matches-screen";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";

export const metadata: Metadata = {
  title: "Your matches · Mayaar",
  description: "Five Islamabad homes ranked against what you described, with the reasoning shown.",
};

export default function MatchesPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <MatchesScreen />
      </main>
      <SiteFooter />
    </>
  );
}
