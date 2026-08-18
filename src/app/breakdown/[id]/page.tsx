import type { Metadata } from "next";
import { notFound } from "next/navigation";

import BreakdownScreen from "@/components/breakdown-screen";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import { LISTINGS, getListing } from "@/lib/listings";

export function generateStaticParams() {
  return LISTINGS.map((listing) => ({ id: String(listing.id) }));
}

export async function generateMetadata(
  props: PageProps<"/breakdown/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const listing = getListing(Number(id));
  if (!listing) return { title: "Breakdown not found · Mayaar" };
  return {
    title: `Why ${listing.title} ranks · Mayaar`,
    description: `Every criterion this ${listing.marla} marla home in ${listing.sector} was scored on, and where it sits against your other matches.`,
  };
}

export default async function BreakdownPage(props: PageProps<"/breakdown/[id]">) {
  const { id } = await props.params;
  const listing = getListing(Number(id));
  if (!listing) notFound();

  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <BreakdownScreen listing={listing} />
      </main>
      <SiteFooter />
    </>
  );
}
