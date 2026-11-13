import { Link } from 'react-router-dom';
import { DollarSign, MapPin, User as UserIcon } from 'lucide-react';
import { api } from '@/api/appClient';
import { createPageUrl } from '@/utils';
import { initialsAvatarUrl } from '@/components/shared/InitialsAvatar';
import MessageUserButton from '@/components/ui/MessageUserButton';
import ReportContent from '@/components/support/ReportContent';
import RecordCard from './RecordCard';

// Only people outside the gecko's collection see this part, so it is its
// own file: opening a record from My Geckos never downloads the message
// and report tools.

/** For anyone who is not the keeper: the asking price and who to contact. */
export default function VisitorAside({ gecko, owner, currentUser, headingAs }) {
  const asking = Number(gecko.asking_price) > 0 ? Number(gecko.asking_price) : null;
  if (!asking && !owner) {
    return (
      <div className="flex justify-end">
        <ReportContent
          targetType="gecko"
          targetId={gecko.id}
          authorProfileId={gecko.owner_profile_id}
          excerpt={[gecko.name, gecko.morphs_traits, gecko.marketplace_description].filter(Boolean).join('\n')}
        />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {asking && (
        <RecordCard id="price" icon={DollarSign} title="Asking price" headingAs={headingAs}>
          <p className="text-2xl font-bold text-yellow-400">${asking.toLocaleString()}</p>
        </RecordCard>
      )}
      {owner && (
        <RecordCard id="breeder" icon={UserIcon} title="Breeder" headingAs={headingAs} contentClassName="space-y-3">
          <Link to={createPageUrl(`PublicProfile?userId=${owner.id}`)} className="touch:min-h-11 flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img
              src={owner.profile_image_url || initialsAvatarUrl(owner.full_name || 'B')}
              alt=""
              className="w-10 h-10 rounded-full object-cover"
            />
            <div className="min-w-0">
              <p className="text-slate-100 font-medium truncate">{owner.full_name}</p>
              {owner.location && (
                <p className="text-slate-400 text-xs flex items-center gap-1"><MapPin className="w-3 h-3" />{owner.location}</p>
              )}
            </div>
          </Link>
          {/* Members cannot read another member's address (decision E16),
              so the first message goes by the owner's profile id. */}
          {currentUser && !currentUser.is_guest ? (
            <MessageUserButton
              recipientEmail={owner.email || null}
              recipientProfileId={gecko.owner_profile_id || owner.id}
              recipientName={owner.full_name}
              variant="outline"
              size="sm"
              className="w-full border-emerald-700 text-emerald-400 hover:bg-emerald-900/30"
            />
          ) : (
            <p className="text-xs text-slate-400 text-center">
              <button type="button" onClick={() => api.auth.redirectToLogin()} className="text-emerald-400 hover:underline touch:min-h-11">Log in</button> to contact this breeder
            </p>
          )}
          <ReportContent
            targetType="gecko"
            targetId={gecko.id}
            authorProfileId={gecko.owner_profile_id}
            excerpt={[gecko.name, gecko.morphs_traits, gecko.marketplace_description].filter(Boolean).join('\n')}
          />
        </RecordCard>
      )}
    </div>
  );
}
