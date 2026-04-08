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
import AdminPanel from './pages/AdminPanel';
import AuthPortal from './pages/AuthPortal';
import Breeding from './pages/Breeding';
import BreedingPairs from './pages/BreedingPairs';
import CommunityConnect from './pages/CommunityConnect';

import Forum from './pages/Forum';
import ForumPost from './pages/ForumPost';
import Gallery from './pages/Gallery';
import GeckoDetail from './pages/GeckoDetail';
import GeneticCalculatorTool from './pages/GeneticCalculatorTool';
import Home from './pages/Home';
import LikedGeckos from './pages/LikedGeckos';
import Lineage from './pages/Lineage';
import MarketplaceBuy from './pages/MarketplaceBuy';
import Messages from './pages/Messages';
import MorphGuideSubmission from './pages/MorphGuideSubmission';
import MyGeckos from './pages/MyGeckos';
import MyListings from './pages/MyListings';
import MyProfile from './pages/MyProfile';
import Notifications from './pages/Notifications';
import OtherReptiles from './pages/OtherReptiles';
import ProjectManager from './pages/ProjectManager';
import PublicProfile from './pages/PublicProfile';
import Settings from './pages/Settings';
import Subscription from './pages/Subscription';
import TrainModel from './pages/TrainModel';
import __Layout from './Layout.jsx';

// Lazy-loaded pages — JS only downloads when the user navigates to that route
const BreederConsultant = lazy(() => import('./pages/BreederConsultant'));
const CareGuide         = lazy(() => import('./pages/CareGuide'));
const Dashboard         = lazy(() => import('./pages/Dashboard'));
const GeneticsGuide     = lazy(() => import('./pages/GeneticsGuide'));
const MarketplaceSell   = lazy(() => import('./pages/MarketplaceSell'));
const MorphGuide        = lazy(() => import('./pages/MorphGuide'));
const MorphVisualizer   = lazy(() => import('./pages/MorphVisualizer'));
const Recognition       = lazy(() => import('./pages/Recognition'));
const Training          = lazy(() => import('./pages/Training'));


export const PAGES = {
    "AdminPanel": AdminPanel,
    "AuthPortal": AuthPortal,
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
    "Home": Home,
    "LikedGeckos": LikedGeckos,
    "Lineage": Lineage,
    "MarketplaceBuy": MarketplaceBuy,
    "MarketplaceSell": MarketplaceSell,
    "Messages": Messages,
    "MorphGuide": MorphGuide,
    "MorphGuideSubmission": MorphGuideSubmission,
    "MorphVisualizer": MorphVisualizer,
    "MyGeckos": MyGeckos,
    "MyListings": MyListings,
    "MyProfile": MyProfile,
    "Notifications": Notifications,
    "OtherReptiles": OtherReptiles,
    "ProjectManager": ProjectManager,
    "PublicProfile": PublicProfile,
    "Recognition": Recognition,
    "Settings": Settings,
    "Subscription": Subscription,
    "TrainModel": TrainModel,
    "Training": Training,
}

export const pagesConfig = {
    mainPage: "MyProfile",
    Pages: PAGES,
    Layout: __Layout,
};