import type { Metadata } from "next";

import SavedScreen from "@/components/saved-screen";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";

export const metadata: Metadata = {
  title: "Saved homes · Mayaar",
  description: "The homes you've kept from your shortlist, with the reasoning a click away.",
};

export default function SavedPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <SavedScreen />
      </main>
      <SiteFooter />
    </>
  );
}
