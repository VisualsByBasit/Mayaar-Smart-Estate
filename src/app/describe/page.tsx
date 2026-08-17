import type { Metadata } from "next";

import DescribeComposer from "@/components/describe-composer";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";

export const metadata: Metadata = {
  title: "Describe your home · Mayaar",
  description:
    "Tell Mayaar about your household, your budget and where you'd actually live, in your own words.",
};

export default function DescribePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <DescribeComposer />
      </main>
      <SiteFooter />
    </>
  );
}
