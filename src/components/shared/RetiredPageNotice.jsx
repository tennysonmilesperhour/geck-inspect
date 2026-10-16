import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { retiredPageEntry } from '@/lib/retiredPages';

/**
 * A short note after a retired page's redirect (src/lib/retiredPages.js).
 *
 * A retired page's redirect target carries ?retired=<page>, both in the
 * app and in the 301 at the edge. This reads it once, shows the page's
 * note as a toast ("Promote is switched off ..."), and takes the
 * parameter out of the address so a reload or a shared link does not
 * show it again. Renders nothing.
 */
export function retiredNoticeFor(search) {
  const params = new URLSearchParams(search || '');
  const page = params.get('retired');
  if (!page) return null;
  params.delete('retired');
  const rest = params.toString();
  const entry = retiredPageEntry(page);
  return {
    search: rest ? `?${rest}` : '',
    toast: entry?.note ? { title: entry.title || 'This page is switched off', description: entry.note } : null,
  };
}

export default function RetiredPageNotice() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const notice = retiredNoticeFor(location.search);
    if (!notice) return;
    navigate(
      { pathname: location.pathname, search: notice.search, hash: location.hash },
      { replace: true, state: location.state },
    );
    if (notice.toast) toast(notice.toast);
  }, [location.search]);

  return null;
}
