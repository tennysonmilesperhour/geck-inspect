import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

/**
 * Breeding ROI was retired: each plan's pairing value box on Breeding and
 * Business Tools' profit per pairing replaced it, and its own projects
 * table (breeding_projects) never held a row. The route stays so old links
 * and bookmarks land on Breeding instead of a page that said it was gone
 * but still offered the old wizard.
 */
export default function BreedingROI() {
  return <Navigate to={createPageUrl('Breeding')} replace />;
}
