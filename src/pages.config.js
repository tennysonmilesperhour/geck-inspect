/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import { lazy } from 'react';
import __Layout from './Layout.jsx';

// Eagerly loaded: the pages a signed-in user is most likely to hit first.
// Keeping these in the main bundle avoids a blank flash on the common path.
// Dashboard is the authenticated landing page so it MUST be eager.
import Home from './pages/Home';
import MyProfile from './pages/MyProfile';
import Dashboard from './pages/Dashboard';

// Everything else is split into its own chunk and only downloaded
// when the user navigates to that route. Cuts ~MB off first paint.
const AdminPanel            = lazy(() => import('./pages/AdminPanel'));
const AuthPortal            = lazy(() => import('./pages/AuthPortal'));
const Breeder               = lazy(() => import('./pages/Breeder'));
const BreederConsultant     = lazy(() => import('./pages/BreederConsultant'));
const Breeding              = lazy(() => import('./pages/Breeding'));
const BreedingPairs         = lazy(() => import('./pages/BreedingPairs'));
const CareGuide             = lazy(() => import('./pages/CareGuide'));
const CommunityConnect      = lazy(() => import('./pages/CommunityConnect'));
const Forum                 = lazy(() => import('./pages/Forum'));
const ForumPost             = lazy(() => import('./pages/ForumPost'));
const Gallery               = lazy(() => import('./pages/Gallery'));
const GeckoDetail           = lazy(() => import('./pages/GeckoDetail'));
const GeneticCalculatorTool = lazy(() => import('./pages/GeneticCalculatorTool'));
const GeneticsGuide         = lazy(() => import('./pages/GeneticsGuide'));
const Giveaways             = lazy(() => import('./pages/Giveaways'));
const LikedGeckos           = lazy(() => import('./pages/LikedGeckos'));
const Lineage               = lazy(() => import('./pages/Lineage'));
const Marketplace           = lazy(() => import('./pages/Marketplace'));
const MarketplaceBuy        = lazy(() => import('./pages/MarketplaceBuy'));
const MarketplaceSalesStats = lazy(() => import('./pages/MarketplaceSalesStats'));
const MarketplaceSell       = lazy(() => import('./pages/MarketplaceSell'));
const Membership            = lazy(() => import('./pages/Membership'));
const Messages              = lazy(() => import('./pages/Messages'));
const MorphGuide            = lazy(() => import('./pages/MorphGuide'));
const MorphGuideSubmission  = lazy(() => import('./pages/MorphGuideSubmission'));
const MorphVisualizer       = lazy(() => import('./pages/MorphVisualizer'));
const MyGeckos              = lazy(() => import('./pages/MyGeckos'));
const MyListings            = lazy(() => import('./pages/MyListings'));
const Notifications         = lazy(() => import('./pages/Notifications'));
const OtherReptiles         = lazy(() => import('./pages/OtherReptiles'));
const Pedigree              = lazy(() => import('./pages/Pedigree'));
const PrivacyPolicy         = lazy(() => import('./pages/PrivacyPolicy'));
const ProjectManager        = lazy(() => import('./pages/ProjectManager'));
const PublicProfile         = lazy(() => import('./pages/PublicProfile'));
const Recognition           = lazy(() => import('./pages/Recognition'));
const Settings              = lazy(() => import('./pages/Settings'));
const Shipping              = lazy(() => import('./pages/Shipping'));
const Subscription          = lazy(() => import('./pages/Subscription'));
const TrainModel            = lazy(() => import('./pages/TrainModel'));
const Training              = lazy(() => import('./pages/Training'));

// P2–P8 Feature pages
const MarketPricing         = lazy(() => import('./pages/MarketPricing'));
const BreedingROI           = lazy(() => import('./pages/BreedingROI'));
const BreedingLoans         = lazy(() => import('./pages/BreedingLoans'));
const GeckAnswers           = lazy(() => import('./pages/GeckAnswers'));
const BatchHusbandry        = lazy(() => import('./pages/BatchHusbandry'));
const PrintableWorksheets   = lazy(() => import('./pages/PrintableWorksheets'));
const BreederStorefront     = lazy(() => import('./pages/BreederStorefront'));
const BreederShipping       = lazy(() => import('./pages/BreederShipping'));
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
    "BreedingPairs": BreedingPairs,
    "CareGuide": CareGuide,
    "CommunityConnect": CommunityConnect,
    "Dashboard": Dashboard,
    "Forum": Forum,
    "ForumPost": ForumPost,
    "Gallery": Gallery,
    "GeckoDetail": GeckoDetail,
    "GeneticCalculatorTool": GeneticCalculatorTool,
    "GeneticsGuide": GeneticsGuide,
    "Giveaways": Giveaways,
    "Home": Home,
    "LikedGeckos": LikedGeckos,
    "Lineage": Lineage,
    "Marketplace": Marketplace,
    "MarketplaceBuy": MarketplaceBuy,
    "MarketplaceSalesStats": MarketplaceSalesStats,
    "MarketplaceSell": MarketplaceSell,
    "Membership": Membership,
    "Messages": Messages,
    "MorphGuide": MorphGuide,
    "MorphGuideSubmission": MorphGuideSubmission,
    "MorphVisualizer": MorphVisualizer,
    "MyGeckos": MyGeckos,
    "MyListings": MyListings,
    "MyProfile": MyProfile,
    "Notifications": Notifications,
    "OtherReptiles": OtherReptiles,
    "Pedigree": Pedigree,
    "PrivacyPolicy": PrivacyPolicy,
    "ProjectManager": ProjectManager,
    "PublicProfile": PublicProfile,
    "Recognition": Recognition,
    "Settings": Settings,
    "Shipping": Shipping,
    "Subscription": Subscription,
    "TrainModel": TrainModel,
    "Training": Training,
    // P2–P8 Feature pages
    "MarketPricing": MarketPricing,
    "BreedingROI": BreedingROI,
    "BreedingLoans": BreedingLoans,
    "GeckAnswers": GeckAnswers,
    "BatchHusbandry": BatchHusbandry,
    "PrintableWorksheets": PrintableWorksheets,
    "BreederStorefront": BreederStorefront,
    "BreederShipping": BreederShipping,
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