import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { createPageUrl } from '@/utils';

const Section = ({ title, children }) => (
    <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        <div className="text-slate-400 text-sm leading-relaxed space-y-2">{children}</div>
    </div>
);

export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-slate-950 py-10 px-4">
            <div className="max-w-3xl mx-auto">
                <Link to={createPageUrl('Dashboard')} className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm mb-8 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to App
                </Link>

                <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 space-y-8">
                    <div className="flex items-center gap-3">
                        <Shield className="w-8 h-8 text-emerald-400 flex-shrink-0" />
                        <div>
                            <h1 className="text-2xl font-bold text-slate-100">Privacy Policy</h1>
                            <p className="text-slate-500 text-sm">Last updated: April 5, 2026</p>
                        </div>
                    </div>

                    <p className="text-slate-400 text-sm leading-relaxed">
                        This Privacy Policy describes how <strong className="text-slate-300">Geck Inspect</strong> ("we", "us", or "our") collects, uses, and protects your personal information when you use our gecko breeding and tracking platform (the "Service"). By using the Service, you agree to the practices described in this policy.
                    </p>

                    <Section title="1. Information We Collect">
                        <p><strong className="text-slate-300">Account Information:</strong> When you register, we collect your name and email address.</p>
                        <p><strong className="text-slate-300">Gecko & Breeding Data:</strong> Information you enter about your gecko collection, breeding plans, egg records, and related notes.</p>
                        <p><strong className="text-slate-300">Images:</strong> Photos you upload of your geckos or for morph identification purposes.</p>
                        <p><strong className="text-slate-300">Usage Data:</strong> We may collect basic analytics such as pages visited and features used to improve the Service.</p>
                        <p><strong className="text-slate-300">Communications:</strong> Messages you send to other users or to us via the platform.</p>
                    </Section>

                    <Section title="2. How We Use Your Information">
                        <p>We use collected information to:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li>Provide and maintain the Service</li>
                            <li>Authenticate your account and keep it secure</li>
                            <li>Store and display your gecko collection and breeding records</li>
                            <li>Enable community features such as the forum, gallery, and marketplace</li>
                            <li>Send transactional emails (e.g., notifications you have opted into)</li>
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
                        <p>We use browser localStorage to store your authentication token and application preferences (such as sidebar scroll position and display settings). No third-party advertising cookies are used.</p>
                    </Section>

                    <Section title="6. Third-Party Services">
                        <p>We may use the following third-party services to operate the platform:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li><strong className="text-slate-300">Cloud Infrastructure:</strong> For hosting, storage, and database services</li>
                            <li><strong className="text-slate-300">AI Services:</strong> Morph identification and AI consultant features process gecko images and prompts via third-party AI providers</li>
                            <li><strong className="text-slate-300">Analytics:</strong> Basic usage analytics to improve the product</li>
                        </ul>
                        <p>These providers are contractually obligated to handle your data securely and only for the purposes we specify.</p>
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

                    <Section title="8. Data Retention">
                        <p>We retain your account data for as long as your account is active. If you delete your account, we will delete or anonymize your personal data within 30 days, except where we are required to retain it by law.</p>
                        <p>Public content you have posted (forum posts, gallery images) may be retained in anonymized form after account deletion.</p>
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
                        </div>
                    </Section>
                </div>
            </div>
        </div>
    );
}