import Image from "next/image";
import Link from "next/link";

import Reveal from "@/components/reveal";
import { HeroSearch } from "@/components/search-entry";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import { EDITORIAL_PHOTO, HERO_PHOTO, REASONING_PHOTO, TOTAL_LISTINGS } from "@/lib/listings";

const STEPS = [
  {
    n: "01",
    title: "Say it the way you'd say it out loud",
    body: "No dropdowns, no price sliders. Write a sentence about your household, your budget and the parts of town you'd actually live in. Mayaar reads the requirements and the things you only implied.",
  },
  {
    n: "02",
    title: "Every listing gets measured against you",
    body: `All ${TOTAL_LISTINGS} Islamabad listings are narrowed against your hard requirements first, then ranked on how well they answer what you care about. You get five, not five hundred.`,
  },
  {
    n: "03",
    title: "Read the reasoning, then push back",
    body: "Each home comes with what fits, what doesn't, and what the data can't confirm. Disagree in a sentence and the shortlist re-ranks in front of you.",
  },
];

const REASONING_POINTS = [
  {
    title: "Checkable, not just plausible",
    body: "Budget, bedrooms, plot size and location are scored from the listing's own fields. You can verify every bar against the data.",
  },
  {
    title: "Honest about the gaps",
    body: "Where a home falls short, it says so — and where the dataset simply doesn't record something, it says that instead of guessing.",
  },
  {
    title: "Reasoning kept separate",
    body: "The written read on each home is labelled as the model's, sitting beside the computed numbers rather than dressed up as them.",
  },
];

export default function LandingPage() {
  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* ------------------------------------------------------------ hero */}
        <section className="shell-hero relative pt-10 pb-16 md:pt-16 md:pb-24">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-20">
            <Reveal>
              <span className="eyebrow">Islamabad · {TOTAL_LISTINGS} listings</span>

              <h1 className="font-heading mt-5 text-[2.5rem] leading-[1.02] font-medium text-balance sm:text-[3.25rem] lg:text-[3.75rem]">
                Describe the home you want.
                <span className="block text-forest italic">In your own words.</span>
              </h1>

              <p className="mt-6 max-w-xl text-[1.0625rem] leading-relaxed text-ink-soft">
                Mayaar reads what you actually meant, ranks every listing in the
                city against it, and shows its working — what fits, what
                doesn&apos;t, and what it couldn&apos;t verify.
              </p>

              <div className="mt-9">
                <HeroSearch />
              </div>
            </Reveal>

            <Reveal delay={120} className="relative">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] border border-rule bg-sand lg:aspect-[5/4] lg:rounded-none lg:border-0">
                <Image
                  src={HERO_PHOTO}
                  alt="A warmly lit living room opening onto a dining area"
                  fill
                  priority
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
                {/* Softens the edge where the bled image meets the text
                    column. Only from lg, where the two columns sit side by
                    side. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 hidden w-2/5 bg-gradient-to-r from-background via-background/45 to-transparent lg:block"
                />
              </div>

              {/* A real extract from the product, not a decorative caption. */}
              <div className="absolute -bottom-6 -left-4 w-[15.5rem] rounded-2xl border border-rule bg-paper p-4 shadow-[0_12px_32px_-12px_rgb(28_26_23/18%)] sm:-left-8">
                <span className="eyebrow">Rank 01 · 92% fit</span>
                <p className="mt-2 text-[0.8125rem] leading-snug text-ink">
                  10 marla, DHA Phase 2 — inside your range with room to spare.
                </p>
                <div className="mt-3 space-y-1.5">
                  {[
                    ["Budget", 96],
                    ["Location", 100],
                    ["Bedrooms", 88],
                  ].map(([label, score]) => (
                    <div key={label as string} className="flex items-center gap-2">
                      <span className="w-16 shrink-0 text-[0.625rem] tracking-wide text-ink-soft uppercase">
                        {label}
                      </span>
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-sand-deep">
                        <span
                          className="block h-full origin-left rounded-full bg-forest animate-bar"
                          style={{ width: `${score as number}%` }}
                        />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ----------------------------------------------------------- proof */}
        <section className="border-y border-rule bg-sand/50">
          <div className="shell grid grid-cols-2 divide-rule py-8 sm:grid-cols-4 sm:divide-x">
            {[
              [TOTAL_LISTINGS.toString(), "Islamabad listings, geocoded"],
              ["5", "ranked homes per search"],
              ["6", "scored dimensions per home"],
              ["0", "filters you have to fill in"],
            ].map(([value, label], index) => (
              <Reveal
                key={label}
                delay={index * 70}
                className="px-2 py-3 sm:px-6 sm:first:pl-0 sm:last:pr-0"
              >
                <p className="font-heading text-3xl font-medium text-forest">{value}</p>
                <p className="mt-1.5 text-[0.8125rem] leading-snug text-ink-soft">{label}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* --------------------------------------------------- how it works */}
        <section id="how-it-works" className="shell scroll-mt-24 py-20 md:py-28">
          <Reveal className="max-w-2xl">
            <span className="eyebrow">How it works</span>
            <h2 className="font-heading mt-4 text-[2rem] leading-tight font-medium text-balance sm:text-[2.5rem]">
              Three steps, and none of them are a filter form.
            </h2>
          </Reveal>

          <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            {STEPS.map((step, index) => (
              <Reveal as="li" key={step.n} delay={index * 90}>
                <span className="font-heading block text-[0.9375rem] font-medium text-sage">
                  {step.n}
                </span>
                <div className="mt-3 h-px w-full bg-rule" />
                <h3 className="font-heading mt-5 text-xl leading-snug font-medium">
                  {step.title}
                </h3>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
                  {step.body}
                </p>
              </Reveal>
            ))}
          </ol>
        </section>

        {/* ------------------------------------------------------- reasoning */}
        <section id="reasoning" className="scroll-mt-24 border-y border-rule bg-paper">
          <div className="shell grid items-center gap-14 py-20 md:py-28 lg:grid-cols-2 lg:gap-20">
            <Reveal className="order-2 lg:order-1">
              <div className="relative aspect-[5/4] overflow-hidden rounded-[1.75rem] border border-rule bg-sand">
                <Image
                  src={REASONING_PHOTO}
                  alt="A modern two-storey villa with a lawn"
                  fill
                  sizes="(min-width: 1024px) 46vw, 100vw"
                  className="object-cover"
                />
              </div>
            </Reveal>

            <Reveal delay={100} className="order-1 lg:order-2">
              <span className="eyebrow">The reasoning</span>
              <h2 className="font-heading mt-4 text-[2rem] leading-tight font-medium text-balance sm:text-[2.5rem]">
                A ranking you can argue with.
              </h2>
              <p className="mt-5 max-w-lg text-[1.0625rem] leading-relaxed text-ink-soft">
                Anything can hand you five homes. The useful part is knowing why
                they&apos;re those five — and what each one costs you.
              </p>

              <dl className="mt-9 max-w-[40rem] space-y-7">
                {REASONING_POINTS.map((point) => (
                  <div key={point.title} className="border-t border-rule pt-5">
                    <dt className="font-heading text-[1.0625rem] font-medium">
                      {point.title}
                    </dt>
                    <dd className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
                      {point.body}
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </section>

        {/* ------------------------------------------------------ for agents */}
        <section id="for-agents" className="shell scroll-mt-24 py-20 md:py-28">
          <Reveal className="overflow-hidden rounded-[1.75rem] border border-rule bg-forest text-primary-foreground">
            <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="px-8 py-12 sm:px-12 lg:py-16">
                <span className="text-[0.6875rem] font-semibold tracking-[0.16em] text-primary-foreground/60 uppercase">
                  For agents
                </span>
                <h2 className="font-heading mt-4 max-w-[36rem] text-[1.875rem] leading-tight font-medium text-balance sm:text-[2.25rem]">
                  Spend your time on buyers who already know what they want.
                </h2>
                <p className="mt-5 max-w-lg text-[0.9375rem] leading-relaxed text-primary-foreground/75">
                  Buyers arrive having read the trade-offs on every home in their
                  shortlist — including the ones that don&apos;t fit. Fewer
                  viewings, better ones.
                </p>
                <Link
                  href="/describe"
                  className="mt-9 inline-flex h-11 items-center rounded-md bg-paper px-6 text-[0.875rem] font-medium text-forest transition-opacity hover:opacity-90"
                >
                  Try a search
                </Link>
              </div>

              <div className="relative hidden aspect-[4/3] h-full lg:block">
                <Image
                  src={EDITORIAL_PHOTO}
                  alt="A warm living room with full-height glazing"
                  fill
                  sizes="40vw"
                  className="object-cover"
                />
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
