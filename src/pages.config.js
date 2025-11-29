import Dashboard from './pages/Dashboard';
import Recognition from './pages/Recognition';
import Gallery from './pages/Gallery';
import GeckoDetail from './pages/GeckoDetail';
import BreedingPairs from './pages/BreedingPairs';
import MorphVisualizer from './pages/MorphVisualizer';
import MorphGuide from './pages/MorphGuide';
import MyProfile from './pages/MyProfile';
import Settings from './pages/Settings';
import PublicProfile from './pages/PublicProfile';
import AdminPanel from './pages/AdminPanel';
import Forum from './pages/Forum';
import ForumPost from './pages/ForumPost';
import Notifications from './pages/Notifications';
import Messages from './pages/Messages';
import Donations from './pages/Donations';
import CareGuide from './pages/CareGuide';
import MorphGuideSubmission from './pages/MorphGuideSubmission';
import MarketplaceBuy from './pages/MarketplaceBuy';
import MarketplaceSell from './pages/MarketplaceSell';
import MyListings from './pages/MyListings';
import MyGeckos from './pages/MyGeckos';
import Breeding from './pages/Breeding';
import Lineage from './pages/Lineage';
import TrainModel from './pages/TrainModel';
import Training from './pages/Training';
import BreederConsultant from './pages/BreederConsultant';
import AuthPortal from './pages/AuthPortal';
import OtherReptiles from './pages/OtherReptiles';
import CommunityConnect from './pages/CommunityConnect';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Recognition": Recognition,
    "Gallery": Gallery,
    "GeckoDetail": GeckoDetail,
    "BreedingPairs": BreedingPairs,
    "MorphVisualizer": MorphVisualizer,
    "MorphGuide": MorphGuide,
    "MyProfile": MyProfile,
    "Settings": Settings,
    "PublicProfile": PublicProfile,
    "AdminPanel": AdminPanel,
    "Forum": Forum,
    "ForumPost": ForumPost,
    "Notifications": Notifications,
    "Messages": Messages,
    "Donations": Donations,
    "CareGuide": CareGuide,
    "MorphGuideSubmission": MorphGuideSubmission,
    "MarketplaceBuy": MarketplaceBuy,
    "MarketplaceSell": MarketplaceSell,
    "MyListings": MyListings,
    "MyGeckos": MyGeckos,
    "Breeding": Breeding,
    "Lineage": Lineage,
    "TrainModel": TrainModel,
    "Training": Training,
    "BreederConsultant": BreederConsultant,
    "AuthPortal": AuthPortal,
    "OtherReptiles": OtherReptiles,
    "CommunityConnect": CommunityConnect,
}

export const pagesConfig = {
    mainPage: "MyProfile",
    Pages: PAGES,
    Layout: __Layout,
};