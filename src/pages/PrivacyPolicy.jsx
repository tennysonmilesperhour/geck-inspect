import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import Seo from '@/components/seo/Seo';
import PublicPageShell from '@/components/public/PublicPageShell';
import { breadcrumbSchema } from '@/lib/organization-schema';
import { SUPPORT_EMAIL, SUPPORT_EMAIL_URL } from '@/lib/supportContact';
import AnalyticsChoice from '@/components/shared/AnalyticsChoice';

const LAST_UPDATED = '2026-10-18';

const Section = ({ title, children }) => (
    <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        <div className="text-slate-400 text-sm leading-relaxed space-y-2">{children}</div>
    </div>
);

export default function PrivacyPolicy() {
    const jsonLd = [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': 'https://geckinspect.com/PrivacyPolicy#webpage',
        name: 'Geck Inspect Privacy Policy',
        url: 'https://geckinspect.com/PrivacyPolicy',
        description: 'Privacy policy for Geck Inspect describing what personal data we collect, how it is used, and your rights.',
        dateModified: LAST_UPDATED,
        isPartOf: { '@id': 'https://geckinspect.com/#website' },
      },
      breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Privacy Policy', path: '/PrivacyPolicy' },
      ]),
    ];
    return (
        <PublicPageShell>
            <Seo
              title="Privacy Policy"
              description="How Geck Inspect collects, uses, and protects your personal information when you use the crested gecko tracking and breeding platform."
              path="/PrivacyPolicy"
              type="article"
              modifiedTime={LAST_UPDATED}
              jsonLd={jsonLd}
            />
            <section className="max-w-3xl mx-auto px-6 pt-4 pb-16">
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                    <Link to="/" className="hover:text-slate-300">Home</Link>
                    <span>/</span>
                    <span className="text-slate-400">Privacy Policy</span>
                </div>

                <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 md:p-8 space-y-8">
                    <div className="flex items-center gap-3">
                        <Shield className="w-8 h-8 text-emerald-400 flex-shrink-0" />
                        <div>
                            <h1 className="text-2xl font-bold text-slate-100">Privacy Policy</h1>
                            <p className="text-slate-500 text-sm">Last updated: October 18, 2026</p>
                        </div>
                    </div>

                    <p className="text-slate-400 text-sm leading-relaxed">
                        This Privacy Policy describes how <strong className="text-slate-300">Geck Inspect</strong> ("we", "us", or "our") collects, uses, and protects your personal information when you use our gecko breeding and tracking platform (the "Service"). By using the Service, you agree to the practices described in this policy.
                    </p>

                    <Section title="1. Information We Collect">
                        <p><strong className="text-slate-300">Account Information:</strong> When you register, we collect your name and email address.</p>
                        <p><strong className="text-slate-300">Optional profile information:</strong> The phone number, business address, general location, website and social contact details you choose to add to your profile.</p>
                        <p><strong className="text-slate-300">Gecko & Breeding Data:</strong> Information you enter about your gecko collection, breeding plans, egg records, and related notes.</p>
                        <p><strong className="text-slate-300">Images:</strong> Photos you upload of your geckos or for morph identification purposes. In the iOS and Android apps you can take those photos with the device camera or choose them from the photo library. The camera is used only when you tap a photo button.</p>
                        <p><strong className="text-slate-300">Phone reminders:</strong> If you turn on phone reminders in the app, feeding and weigh-in times are scheduled on that device. Those reminders stay on the phone. They are not sent to a push service.</p>
                        <p><strong className="text-slate-300">Usage Data:</strong> We collect pages visited and features used, browser/device identifiers and general device information for analytics. Analytics providers may derive an approximate location from your network address. Error reports can contain the error message, stack trace, page, browser/device information and account email. These help us find and fix failures. We do not request GPS access.</p>
                        <p><strong className="text-slate-300">Communications:</strong> Messages you send to other users or to us via the platform.</p>
                        <p><strong className="text-slate-300">AI Consultant chats:</strong> The questions you ask the AI Breeder Consultant and its answers are saved to your account so you can reopen them. Only you can see them, and you can delete any chat at any time.</p>
                    </Section>

                    <Section title="2. How We Use Your Information">
                        <p>We use collected information to:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li>Provide and maintain the Service</li>
                            <li>Authenticate your account and keep it secure</li>
                            <li>Store and display your gecko collection and breeding records</li>
                            <li>Enable community features such as the forum, gallery, and marketplace</li>
                            <li>Send transactional emails (e.g., notifications you have opted into)</li>
                            <li>Send Weekly Gecko Notes, a short weekly email with one crested gecko care or record-keeping tip. It starts after your first two weeks and comes once a week until you stop it.</li>
                            <li>Improve and develop new features based on usage patterns</li>
                            <li>Respond to support requests</li>
                        </ul>
                        <p>We do <strong className="text-slate-300">not</strong> sell your personal data to third parties.</p>
                    </Section>

                    <Section title="3. Data Storage & Security">
                        <p>Your data is stored on secure cloud infrastructure. We take reasonable technical and organizational measures to protect your data against unauthorized access, alteration, or loss. However, no internet transmission is 100% secure.</p>
                        <p>Images you upload are stored on secure object storage. Breeding and gecko data is stored in a managed cloud database.</p>
                    </Section>

                    <Section title="4. Public vs. Private Data">
                        <p>Certain data you choose to make public (such as marketplace listings, public gallery images, or forum posts) will be visible to other users and potentially to the general public.</p>
                        <p>Your gecko collection, breeding plans, and weight records are private by default and visible only to you, unless you explicitly share them.</p>
                    </Section>

                    <Section title="5. Cookies & Local Storage">
                        <p>We use browser localStorage to store your authentication token and application preferences (such as sidebar scroll position and display settings), and your analytics choice if you make one. Google Analytics and PostHog set their own first-party cookies and localStorage entries to recognise a returning browser. No third-party advertising cookies are used.</p>
                        <p>If you visit from the European Economic Area or the United Kingdom, Google Analytics and PostHog do not load until you choose Accept on the analytics question at the bottom of the page. To know whether to ask, our server sets a small cookie that only says "ask" or "open" (it holds no identifier and lasts 30 days), based on the country your connection comes from, and the site also checks your browser's time zone. If either points to Europe, we ask. Anywhere else, Google Analytics and PostHog load unless your browser sends Do Not Track or Global Privacy Control.</p>
                        <AnalyticsChoice />
                        <p>That choice covers Google Analytics and PostHog only. Separately, Geck Inspect keeps its own simple count of which pages are visited and which features are used (for example, opening the Care Guide or adding a gecko), stored in our own database so we can see what keepers use and spot broken pages. Each record holds the page or feature, the time, a random code for this visit (kept in this browser tab's session storage until the tab closes) and, when you are signed in, your account email. It sets no cookie, it is not shared with Google, PostHog or any advertiser, and it runs whatever you choose above. Deleting your account deletes your records in it.</p>
                    </Section>

                    <Section title="6. Third-Party Services">
                        <p>Before an AI request, the app asks permission and names the provider and information being shared. Cancel stops that request before it reaches the AI provider. Permission is requested again for a later request; it is not stored as a permanent preference.</p>
                        <p>These are the services that receive some of your data in order to run Geck Inspect, and what each one gets:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li><strong className="text-slate-300">Supabase</strong> (database, authentication, file storage): your account, your collection, and the photos you upload.</li>
                            <li><strong className="text-slate-300">Vercel</strong> (hosting): standard web server logs, including IP address and browser type.</li>
                            <li><strong className="text-slate-300">Stripe</strong> (website payments): your email and payment details when you buy a membership on the website. Card numbers never touch our servers. The iOS and Android apps do not use Stripe to sell digital memberships.</li>
                            <li><strong className="text-slate-300">Apple</strong> and <strong className="text-slate-300">Google</strong> (in-app purchases): if you buy a membership inside the iOS or Android app, that purchase is billed by the App Store or Google Play.</li>
                            <li><strong className="text-slate-300">RevenueCat</strong> (subscription management): a subscriber identifier and your subscription status, so a store purchase unlocks the same plan on the website.</li>
                            <li><strong className="text-slate-300">Anthropic</strong> (AI): the photos, text and selected records you submit to morph identification, health screening, image-to-record import, the breeder consultant and social post generation.</li>
                            <li><strong className="text-slate-300">Replicate</strong> (visual comparison): when enabled, the gecko image or image URL used to generate visual embeddings for similarity search and morph reference retrieval.</li>
                            <li><strong className="text-slate-300">Govee</strong> (optional enclosure sensors): when you connect this integration, server-side requests use your Govee API credentials and device identifiers to retrieve sensor readings.</li>
                            <li><strong className="text-slate-300">Resend</strong> (email delivery): your email address and the content of emails we send you. Resend tells us whether each email was delivered, bounced or reported as spam and, when open and click tracking is turned on, whether it was opened and which link was clicked. We keep that record so we know our emails arrive.</li>
                            <li><strong className="text-slate-300">Google Analytics</strong> and <strong className="text-slate-300">PostHog</strong> (analytics): pages visited, features used, and general device information. Page addresses are cleaned before they are sent, so the private codes in sign-in, claim, invite, unsubscribe and waitlist links never reach them. When you are signed in, PostHog receives your account's random ID, your plan and your role, not your name or email address. PostHog is configured to mask the text on the page and does not record sessions. Neither loads when your browser sends Do Not Track or Global Privacy Control, or after you turn them off, and in the European Economic Area and the United Kingdom neither loads until you accept (see section 5).</li>
                        </ul>
                        <p>Each provider handles data under its own privacy policy and our agreement with it, and only for the purpose listed above.</p>
                    </Section>

                    <Section title="7. Your Rights (GDPR & CCPA)">
                        <p>Depending on your location, you may have the following rights regarding your personal data:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li><strong className="text-slate-300">Access:</strong> Request a copy of the data we hold about you</li>
                            <li><strong className="text-slate-300">Rectification:</strong> Correct inaccurate data</li>
                            <li><strong className="text-slate-300">Erasure:</strong> Request deletion of your account and associated data</li>
                            <li><strong className="text-slate-300">Portability:</strong> Request your data in a machine-readable format</li>
                            <li><strong className="text-slate-300">Objection:</strong> Object to certain types of processing</li>
                            <li><strong className="text-slate-300">Withdraw Consent:</strong> Withdraw consent at any time where processing is based on consent</li>
                        </ul>
                        <p>To exercise any of these rights, please contact us at the email below. We will respond within 30 days.</p>
                    </Section>

                    <Section title="8. Data Retention and account deletion">
                        <p>We retain your account data for as long as your account is active. Signed-in members can delete an account in Settings, on the website or in the iOS and Android apps. Deletion removes the login and personal records. Records other keepers still depend on (lineage, forum posts, and similar shared history) stay in anonymized form, under the name Former member.</p>
                        <p>A membership bought on the website is cancelled as part of that deletion when automatic deletion is available, so the card is not charged again. Deleting an account does not cancel an App Store or Google Play subscription. Cancel that in the store if you do not want it to renew.</p>
                        <p>If automatic deletion is unavailable, Settings records a request and we delete or anonymize the personal data within 30 days. We also keep records we are required to retain by law, such as payment amounts. Files that could not be removed automatically are cleared within 30 days.</p>
                        <p>Error reports (which can include your email address and the page you were on) and the log of visits from search engines and AI crawlers are deleted after 90 days. The copies of payment notifications that Stripe and RevenueCat (for App Store and Google Play purchases) send us are emptied after 90 days: we keep only the notification's reference, its type and whether we processed it, which our billing records need. Our own count of pages and features used (section 5) is not on this 90-day schedule: we keep it so we can compare use from month to month, and deleting your account deletes your records in it.</p>
                        <p>Deletion also removes your email address from our email delivery records, along with the details tied to it (a bounce message, or which link you clicked). What is left has no address and no details: technical references for each email, the kind of email, what happened to it (for example, delivered or opened) and when. That is enough to still count how many emails arrived.</p>
                        <p>For Weekly Gecko Notes we keep your email address, which email in the series we sent and when, and when we last checked whether one was due. Every weekly email has a link that stops only these emails, and Settings has a switch for them. Stopping them keeps your reminders and other email. Deleting your account erases these records.</p>
                        <p>One short list is kept on purpose. If an address bounced or its owner marked our email as spam, we keep that address on a do-not-email list so we never email it again, even after the account is deleted. It holds the address, the reason (a bounce or a spam report), when it was added and last changed, the reference our email service gave the email that caused it, and for a bounce, the kind of bounce and the short message the receiving mail server sent back, which can repeat the address. To ask for an address to be taken off it, contact us at the email below.</p>
                    </Section>

                    <Section title="9. Children's Privacy">
                        <p>The Service is not directed to children under the age of 13. We do not knowingly collect personal information from children. If you believe a child has provided us personal information, please contact us and we will delete it promptly.</p>
                    </Section>

                    <Section title="10. Changes to This Policy">
                        <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the new policy on this page with an updated date. Continued use of the Service after changes constitutes acceptance of the updated policy.</p>
                    </Section>

                    <Section title="11. Contact Us">
                        <p>If you have questions, requests, or concerns about this Privacy Policy or how we handle your data, please contact us at:</p>
                        <div className="bg-slate-800 rounded-lg p-4 mt-2">
                            <p className="text-slate-300 font-medium">Geck Inspect</p>
                            <a href={SUPPORT_EMAIL_URL} className="text-emerald-300 underline break-all">{SUPPORT_EMAIL}</a>
                            <p className="mt-2">You can email us without an account. Signed-in users delete an account in Settings. This page is the public description of that process for the App Store and Google Play account-deletion links: open Geck Inspect, sign in, go to Settings, and choose Delete my account.</p>
                        </div>
                    </Section>
                </div>
            </section>
        </PublicPageShell>
    );
}
