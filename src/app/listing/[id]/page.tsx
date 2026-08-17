import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ListingDetail from "@/components/listing-detail";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import { LISTINGS, getListing } from "@/lib/listings";

export function generateStaticParams() {
  return LISTINGS.map((listing) => ({ id: String(listing.id) }));
}

export async function generateMetadata(
  props: PageProps<"/listing/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const listing = getListing(Number(id));
  if (!listing) return { title: "Listing not found · Mayaar" };
  return {
    title: `${listing.title} · Mayaar`,
    description: `${listing.marla} marla in ${listing.sector}, ${listing.price_display} — scored against what you described.`,
  };
}

export default async function ListingPage(props: PageProps<"/listing/[id]">) {
  const { id } = await props.params;
  const listing = getListing(Number(id));
  if (!listing) notFound();

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <ListingDetail listing={listing} />
      </main>
      <SiteFooter />
    </>
  );
}
