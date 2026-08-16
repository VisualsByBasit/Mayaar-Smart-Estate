import ListingExplorer from "@/components/listing-explorer";
import listings from "@/data/listings.json";

export default function Home() {
  return <ListingExplorer listings={listings} />;
}
