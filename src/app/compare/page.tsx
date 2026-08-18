import type { Metadata } from "next";

import CompareScreen from "@/components/compare-screen";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";

export const metadata: Metadata = {
  title: "Compare homes · Mayaar",
  description:
    "Two or three homes side by side — price, size, rooms and every criterion scored against your brief.",
};

export default function ComparePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <CompareScreen />
      </main>
      <SiteFooter />
    </>
  );
}
