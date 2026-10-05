/**
 * Explicit page registry consumed by App.jsx. Add a component here, then check
 * route access in guestPages.js, feature flags, navigation and public SEO data.
 * Creating a file under pages/ does not register a route automatically.
 * mainPage must match a PAGES key. See docs/ENGINEERING.md for the full flow.
 */
// `lazy` here is our retry-wrapped version (resilient to transient chunk
// fetch failures + stale deploys), a drop-in for React's lazy. See
// src/lib/lazyWithRetry.js.
import { lazy } from '@/lib/lazyWithRetry';
// The signed-in shell (Layout) and its first pages are lazy too. Until
// October 2026 they were eager, so every visitor to the landing page, the
// Morph Guide or the Care Guide downloaded the sidebar, Dashboard and
// profile code they never use (about a third of the 1.22 MB main
// script). App.jsx prefetches Layout and Dashboard as soon as it knows
// the visitor is signed in or in the demo, so the signed-in first paint
// does not wait on an extra round trip.
const __Layout              = lazy(() => import('./Layout.jsx'));
const Home                  = lazy(() => import('./pages/Home'));
const MyProfile             = lazy(() => import('./pages/MyProfile'));
const Dashboard             = lazy(() => import('./pages/Dashboard'));

// Everything else is split into its own chunk and only downloaded
// when the user navigates to that route. Cuts ~MB off first paint.
const AdminPanel            = lazy(() => import('./pages/AdminPanel'));
const AuthPortal            = lazy(() => import('./pages/AuthPortal'));
const Breeder               = lazy(() => import('./pages/Breeder'));
const BreederConsultant     = lazy(() => import('./pages/BreederConsultant'));
const Breeding              = lazy(() => import('./pages/Breeding'));
const BreedingSeason        = lazy(() => import('./pages/BreedingSeason'));
const PairingPlanner        = lazy(() => import('./pages/PairingPlanner'));
const FieldMode             = lazy(() => import('./pages/FieldMode'));
const Portfolio             = lazy(() => import('./pages/Portfolio'));
const Market                = lazy(() => import('./pages/Market'));
const CareGuide             = lazy(() => import('./pages/CareGuide'));
const Forum                 = lazy(() => import('./pages/Forum'));
const ForumPost             = lazy(() => import('./pages/ForumPost'));
const Gallery               = lazy(() => import('./pages/Gallery'));
const GeckoDetail           = lazy(() => import('./pages/GeckoDetail'));
const GeneticCalculatorTool = lazy(() => import('./pages/GeneticCalculatorTool'));
const GeneticsGuide         = lazy(() => import('./pages/GeneticsGuide'));
const LikedGeckos           = lazy(() => import('./pages/LikedGeckos'));
const Lineage               = lazy(() => import('./pages/Lineage'));
const Marketplace           = lazy(() => import('./pages/Marketplace'));
const MarketplaceBuy        = lazy(() => import('./pages/MarketplaceBuy'));
const MarketplaceSalesStats = lazy(() => import('./pages/MarketplaceSalesStats'));
const MarketplaceSell       = lazy(() => import('./pages/MarketplaceSell'));
const MorphMarketExport     = lazy(() => import('./pages/MorphMarketExport'));
const Membership            = lazy(() => import('./pages/Membership'));
const Messages              = lazy(() => import('./pages/Messages'));
const MorphGuide            = lazy(() => import('./pages/MorphGuide'));
const MorphGuideSubmission  = lazy(() => import('./pages/MorphGuideSubmission'));
const MyGeckos              = lazy(() => import('./pages/MyGeckos'));
const MyListings            = lazy(() => import('./pages/MyListings'));
const MyStore               = lazy(() => import('./pages/MyStore'));
const Notifications         = lazy(() => import('./pages/Notifications'));
const OtherReptiles         = lazy(() => import('./pages/OtherReptiles'));
const Pedigree              = lazy(() => import('./pages/Pedigree'));
const PrivacyPolicy         = lazy(() => import('./pages/PrivacyPolicy'));
const ProjectManager        = lazy(() => import('./pages/ProjectManager'));
const PublicProfile         = lazy(() => import('./pages/PublicProfile'));
const Recognition           = lazy(() => import('./pages/Recognition'));
const Settings              = lazy(() => import('./pages/Settings'));
const Training              = lazy(() => import('./pages/Training'));

// P2 to P8 feature pages
const MarketPricing         = lazy(() => import('./pages/MarketPricing'));
const BreedingROI           = lazy(() => import('./pages/BreedingROI'));
const BatchHusbandry        = lazy(() => import('./pages/BatchHusbandry'));
const PrintableWorksheets   = lazy(() => import('./pages/PrintableWorksheets'));
const ImageImport           = lazy(() => import('./pages/ImageImport'));

// P11 Quality Scale: public rubric, also resolvable inside the auth shell.
const QualityScale          = lazy(() => import('./pages/QualityScale'));

// Social media manager
const Promote               = lazy(() => import('./pages/Promote'));


export const PAGES = {
    "AdminPanel": AdminPanel,
    "AuthPortal": AuthPortal,
    "Breeder": Breeder,
    "BreederConsultant": BreederConsultant,
    "Breeding": Breeding,
    "BreedingSeason": BreedingSeason,
    "PairingPlanner": PairingPlanner,
    "FieldMode": FieldMode,
    "Portfolio": Portfolio,
    "Market": Market,
    "CareGuide": CareGuide,
    "Dashboard": Dashboard,
    "Forum": Forum,
    "ForumPost": ForumPost,
    "Gallery": Gallery,
    "GeckoDetail": GeckoDetail,
    "GeneticCalculatorTool": GeneticCalculatorTool,
    "GeneticsGuide": GeneticsGuide,
    "Home": Home,
    "LikedGeckos": LikedGeckos,
    "Lineage": Lineage,
    "Marketplace": Marketplace,
    "MarketplaceBuy": MarketplaceBuy,
    "MarketplaceSalesStats": MarketplaceSalesStats,
    "MarketplaceSell": MarketplaceSell,
    "MorphMarketExport": MorphMarketExport,
    "Membership": Membership,
    "Messages": Messages,
    "MorphGuide": MorphGuide,
    "MorphGuideSubmission": MorphGuideSubmission,
    "MyGeckos": MyGeckos,
    "MyListings": MyListings,
    "MyProfile": MyProfile,
    "MyStore": MyStore,
    "Notifications": Notifications,
    "OtherReptiles": OtherReptiles,
    "Pedigree": Pedigree,
    "PrivacyPolicy": PrivacyPolicy,
    "ProjectManager": ProjectManager,
    "PublicProfile": PublicProfile,
    "Recognition": Recognition,
    "Settings": Settings,
    "Training": Training,
    // P2 to P8 feature pages
    "MarketPricing": MarketPricing,
    "BreedingROI": BreedingROI,
    "BatchHusbandry": BatchHusbandry,
    "PrintableWorksheets": PrintableWorksheets,
    "ImageImport": ImageImport,
    "QualityScale": QualityScale,
    // Social media manager
    "Promote": Promote,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};