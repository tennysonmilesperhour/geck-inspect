import { Navigate, useLocation } from 'react-router-dom';
import { breedingTabUrl } from './breedingTabs';

/**
 * Forwards an old planner address to its tab on the Breeding page, so
 * bookmarks, the quick search and links in older emails still land in
 * the right place. `replace` keeps Back from bouncing on the forward.
 */
export default function BreedingTabRedirect({ tab }) {
  const location = useLocation();
  return <Navigate to={breedingTabUrl(tab, location.search, location.hash)} replace />;
}
