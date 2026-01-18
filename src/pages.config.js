import AdminPanel from './pages/AdminPanel';
import AuthPortal from './pages/AuthPortal';
import BreederConsultant from './pages/BreederConsultant';
import Breeding from './pages/Breeding';
import BreedingPairs from './pages/BreedingPairs';
import CareGuide from './pages/CareGuide';
import CommunityConnect from './pages/CommunityConnect';
import Dashboard from './pages/Dashboard';
import Donations from './pages/Donations';
import Forum from './pages/Forum';
import ForumPost from './pages/ForumPost';
import Gallery from './pages/Gallery';
import GeckoDetail from './pages/GeckoDetail';
import Home from './pages/Home';
import LikedGeckos from './pages/LikedGeckos';
import Lineage from './pages/Lineage';
import MarketplaceBuy from './pages/MarketplaceBuy';
import MarketplaceSell from './pages/MarketplaceSell';
import Messages from './pages/Messages';
import MorphGuide from './pages/MorphGuide';
import MorphGuideSubmission from './pages/MorphGuideSubmission';
import MorphVisualizer from './pages/MorphVisualizer';
import MyGeckos from './pages/MyGeckos';
import MyListings from './pages/MyListings';
import MyProfile from './pages/MyProfile';
import Notifications from './pages/Notifications';
import OtherReptiles from './pages/OtherReptiles';
import ProjectManager from './pages/ProjectManager';
import PublicProfile from './pages/PublicProfile';
import Recognition from './pages/Recognition';
import Settings from './pages/Settings';
import Subscription from './pages/Subscription';
import TrainModel from './pages/TrainModel';
import Training from './pages/Training';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminPanel": AdminPanel,
    "AuthPortal": AuthPortal,
    "BreederConsultant": BreederConsultant,
    "Breeding": Breeding,
    "BreedingPairs": BreedingPairs,
    "CareGuide": CareGuide,
    "CommunityConnect": CommunityConnect,
    "Dashboard": Dashboard,
    "Donations": Donations,
    "Forum": Forum,
    "ForumPost": ForumPost,
    "Gallery": Gallery,
    "GeckoDetail": GeckoDetail,
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