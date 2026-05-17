import { APP_LOGO_URL } from "@/lib/constants";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import {
  Truck,
  Thermometer,
  ShieldCheck,
  PackageCheck,
  ArrowRight,
  ArrowLeft,
  Clock,
  ExternalLink,
  Snowflake,
} from 'lucide-react';
import Seo from '@/components/seo/Seo';

const LOGO_URL =
  APP_LOGO_URL;

const ZERO_SHIPPING_URL = 'https://www.zerosgeckos.com/shippingproject';

const FEATURES = [
  {
    icon: Thermometer,
    title: 'Temperature-controlled transit',
    desc: "Reptile-specific carriers with heat packs, cold packs, and insulated foam. Every box is built for the conditions your geckos actually need ,  not a one-size-fits-all courier bag.",
  },
  {
    icon: PackageCheck,
    title: 'Live arrival guarantee',
    desc: "Full live arrival guarantee on every shipment through the partner network. If anything goes wrong in transit, the claim is handled by people who actually work with reptiles.",
  },
  {
    icon: ShieldCheck,
    title: 'Tracked and insured',
    desc: "Every box gets a tracking number, a published transit window, and insurance baked in. Your buyer knows what's happening; you don't spend the day refreshing a FedEx page.",
  },
  {
    icon: Clock,
    title: 'Overnight or express',
    desc: "Overnight and express options nationwide, with regional hub drop-off partners for breeders who ship in volume.",
  },
];

const SHIPPING_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Geck Inspect Shipping',
  provider: {
    '@type': 'Organization',
    name: 'Geck Inspect',
    url: 'https://geckinspect.com/',
  },
  serviceType: 'Live reptile shipping',
  description:
    'Geck Inspect integrates Zero\u2019s Geckos Shipping Project so breeders can book live-arrival-guaranteed, temperature-controlled shipping for crested geckos right from their collection. Booking through Geck Inspect is the same as booking directly on zerosgeckos.com.',
  areaServed: 'US',
};

export default function Shipping() {
  return (
    <>
      <Seo
        title="Shipping ,  Live Arrival Guaranteed"
        description="Geck Inspect integrates Zero's Geckos Shipping Project so breeders can book reptile-safe, live-arrival-guaranteed shipping from inside their collection. Same service as zerosgeckos.com, just easier to use alongside your geckos."
        path="/Shipping"
        jsonLd={SHIPPING_JSON_LD}
      />

      <div className="min-h-screen bg-slate-950 text-slate-100">
        {/* Top nav */}
        <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <img src={LOGO_URL} alt="Geck Inspect" className="h-10 w-10 rounded-xl" />
            <span className="text-xl font-bold tracking-tight">Geck Inspect</span>
          </Link>
          <Link to={createPageUrl('AuthPortal')}>
            <Button className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold">
              Sign In
            </Button>
          </Link>
        </header>

        {/* Hero */}
        <section className="max-w-5xl mx-auto px-6 pt-10 pb-16">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 mb-6"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Geck Inspect
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 mb-5">
            <Truck className="w-3.5 h-3.5" />
            Shipping on Geck Inspect
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-6 bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-transparent">
            Live arrival, guaranteed.
          </h1>

          <p className="text-lg md:text-xl text-slate-300 max-w-2xl leading-relaxed mb-8">
            Geck Inspect integrates{' '}
            <a
              href={ZERO_SHIPPING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
            >
              Zero&rsquo;s Geckos Shipping Project
            </a>{' '}
            so you can book reptile-safe overnight shipping right from your collection. There&rsquo;s no
            exclusive partnership; booking here is the same service, same pricing, and same live
            arrival guarantee as going to zerosgeckos.com directly. We built the integration to make
            their service easier to reach inside the tools you&rsquo;re already using.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <a href={ZERO_SHIPPING_URL} target="_blank" rel="noopener noreferrer">
              <Button
                size="lg"
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-base px-8 py-6 shadow-lg shadow-emerald-500/30"
              >
                Visit Zero&rsquo;s Shipping Project
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </a>
            <Link to={createPageUrl('Marketplace')}>
              <Button
                size="lg"
                variant="outline"
                className="bg-white text-slate-900 hover:bg-slate-100 hover:text-slate-900 border-white/40 font-semibold text-base px-8 py-6"
              >
                Browse the marketplace
              </Button>
            </Link>
          </div>
        </section>

        {/* Feature grid */}
        <section className="max-w-6xl mx-auto px-6 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* How it will work */}
        <section className="max-w-4xl mx-auto px-6 pb-20">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 md:p-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-6">How it will work</h2>
            <ol className="space-y-5">
              <li className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold text-sm">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">List a gecko for sale</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Use the Geck Inspect marketplace to list any gecko in your collection. All
                    lineage, weight history, and photos auto-attach to the listing.
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold text-sm">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Buyer selects shipping at checkout</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    The buyer picks their preferred transit window and location during checkout.
                    Real-time quotes come from the Zero&rsquo;s Geckos integration so you
                    don&rsquo;t have to guess at pricing.
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold text-sm">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Ship with confidence</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Print the shipping label from inside Geck Inspect, drop off at the nearest
                    hub, and the buyer gets live tracking + arrival notifications automatically.
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold text-sm">
                  4
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Live arrival confirmed</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Once the buyer confirms delivery, the transaction closes and the listing
                    updates automatically. If something goes wrong, the live arrival guarantee
                    kicks in.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        {/* Breeder dashboard CTA */}
        <section className="max-w-4xl mx-auto px-6 pb-10 text-center">
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900/60 to-slate-900/40 p-8 md:p-10">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              Already a Breeder member?
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto mb-6">
              Access the full shipping dashboard ,  get quotes, book shipments, print labels, and
              track packages all from inside Geck Inspect.
            </p>
            <Link to={createPageUrl('BreederShipping')}>
              <Button
                size="lg"
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-base px-8 py-6 shadow-lg shadow-emerald-500/30"
              >
                Open shipping dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </section>

        {/* About Zero's Geckos */}
        <section className="max-w-4xl mx-auto px-6 pb-16">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 md:p-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">About Zero&rsquo;s Geckos Shipping</h2>
            <p className="text-slate-300 leading-relaxed mb-4">
              Zero&rsquo;s Geckos Shipping Project is an independent service run by a keeper who built
              the reptile shipping flow he wished existed. It&rsquo;s become one of the most reliable
              ways to ship live animals in the hobby, and we wanted to make it easier for crested
              gecko folks to reach.
            </p>
            <p className="text-slate-300 leading-relaxed mb-4">
              Geck Inspect is not formally partnered with Zero&rsquo;s Geckos and we don&rsquo;t take
              a cut of bookings. The integration exists because we think their service is worth
              promoting. Whether you book through Geck Inspect or directly on{' '}
              <a
                href={ZERO_SHIPPING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
              >
                zerosgeckos.com
              </a>
              , you get the exact same service, pricing, and live arrival guarantee.
            </p>
            <p className="text-slate-400 text-sm leading-relaxed">
              If you ship live animals, support their work. They&rsquo;re solving a real problem for
              the community.
            </p>
          </div>
        </section>

        {/* Status / CTA */}
        <section className="max-w-4xl mx-auto px-6 pb-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 border border-amber-500/30 px-4 py-1.5 text-xs font-semibold text-amber-300 mb-5">
            <Snowflake className="w-3.5 h-3.5" />
            Integration in progress
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            Want a heads-up when booking goes live?
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto mb-8">
            The booking flow inside Geck Inspect is wired up and ready; we&rsquo;re waiting on the
            live API connection to Zero&rsquo;s Geckos. Create an account and you&rsquo;ll get a note
            the moment booked shipping goes live in the marketplace.
          </p>
          <Link to={createPageUrl('AuthPortal')}>
            <Button
              size="lg"
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-base px-8 py-6 shadow-lg shadow-emerald-500/30"
            >
              Create a free account
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-800/50">
          <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-3">
              <img src={LOGO_URL} alt="Geck Inspect" className="h-6 w-6 rounded" />
              <span>© {new Date().getFullYear()} Geck Inspect · geckOS</span>
            </div>
            <div className="flex items-center gap-5">
              <Link to="/" className="hover:text-slate-300">Home</Link>
              <Link to={createPageUrl('Marketplace')} className="hover:text-slate-300">
                Marketplace
              </Link>
              <a
                href={ZERO_SHIPPING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-300 inline-flex items-center gap-1"
              >
                Zero&rsquo;s Geckos
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
