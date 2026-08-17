import Wordmark from "@/components/wordmark";

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-rule bg-sand/40">
      <div className="shell flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <Wordmark />
        <p className="text-xs text-ink-soft">
          Islamabad, Pakistan · Listing data scraped for demonstration
        </p>
      </div>
    </footer>
  );
}
