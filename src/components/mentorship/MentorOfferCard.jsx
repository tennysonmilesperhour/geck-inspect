import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { initialsAvatarUrl } from '@/components/shared/InitialsAvatar';
import { getDisplayName } from '@/utils';
import {
    Mail,
    Pencil,
    GraduationCap,
    MessageSquare,
    BookOpen,
    Award,
    Clock,
    Power,
} from 'lucide-react';

// Visual treatment per offer type. Stays inside the dark slate/emerald
// palette: emerald for ongoing mentorship, teal for one-off consults,
// amber as the single accent for structured courses.
const TYPE_META = {
    mentorship: {
        label: 'Mentorship',
        icon: GraduationCap,
        badgeClass: 'bg-emerald-900/60 text-emerald-300 border-emerald-700',
    },
    consult: {
        label: 'Consult',
        icon: MessageSquare,
        badgeClass: 'bg-teal-900/60 text-teal-300 border-teal-700',
    },
    course: {
        label: 'Course',
        icon: BookOpen,
        badgeClass: 'bg-amber-900/50 text-amber-300 border-amber-700',
    },
};

// "$60 / 45 min" when both numbers exist, "$60" when only a price,
// otherwise fall back to the freeform price note.
export function formatOfferPrice(offer) {
    const price = Number(offer?.price_usd);
    const duration = Number(offer?.duration_minutes);
    if (Number.isFinite(price) && price > 0) {
        const dollars = Number.isInteger(price) ? `$${price}` : `$${price.toFixed(2)}`;
        if (Number.isFinite(duration) && duration > 0) {
            return `${dollars} / ${duration} min`;
        }
        return dollars;
    }
    if (offer?.price_note) return offer.price_note;
    return 'Ask about pricing';
}

/**
 * One mentorship/consult/course offer in the marketplace grid.
 *
 * `profile` is the public profiles row for offer.owner_email (resolved by
 * the page in one batched query, same pattern as Messages). `isOwner`
 * swaps the Message CTA for Edit / Deactivate controls.
 */
export default function MentorOfferCard({
    offer,
    profile,
    currentUserEmail,
    isOwner = false,
    onEdit,
    onToggleActive,
}) {
    const typeMeta = TYPE_META[offer.offer_type] || TYPE_META.mentorship;
    const TypeIcon = typeMeta.icon;

    const displayName = getDisplayName(
        profile || { email: offer.owner_email }
    );
    const avatarUrl =
        profile?.profile_image_url || initialsAvatarUrl(displayName, 64);
    const profileUrl = `/PublicProfile?email=${encodeURIComponent(offer.owner_email)}`;

    const priceLabel = formatOfferPrice(offer);
    const hasPriceNote =
        Boolean(offer.price_note) && priceLabel !== offer.price_note;
    const specialties = Array.isArray(offer.specialties)
        ? offer.specialties.filter(Boolean)
        : [];
    const years = Number(offer.years_experience);

    // Owners see their own cards in the "Your offers" section; everyone
    // else gets a Message CTA. Signed-out visitors are routed to sign in
    // first because /Messages needs a session.
    const messageHref = currentUserEmail
        ? `/Messages?recipient=${encodeURIComponent(offer.owner_email)}`
        : '/AuthPortal';
    const isSelf = currentUserEmail && currentUserEmail === offer.owner_email;

    return (
        <Card
            className={`bg-slate-900 border-slate-800 flex flex-col ${
                isOwner && !offer.is_active ? 'opacity-70' : ''
            }`}
        >
            <CardContent className="p-5 flex flex-col flex-1">
                {/* Breeder identity */}
                <div className="flex items-start justify-between gap-3 mb-4">
                    <Link
                        to={profileUrl}
                        className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity"
                    >
                        <img
                            src={avatarUrl}
                            alt=""
                            className="w-11 h-11 rounded-full object-cover bg-slate-800 shrink-0"
                            loading="lazy"
                        />
                        <div className="min-w-0">
                            <div className="font-semibold text-slate-100 truncate">
                                {displayName}
                            </div>
                            {Number.isFinite(years) && years > 0 && (
                                <div className="flex items-center gap-1 text-xs text-slate-400">
                                    <Award className="w-3 h-3 text-emerald-400 shrink-0" />
                                    {years} {years === 1 ? 'year' : 'years'} breeding
                                </div>
                            )}
                        </div>
                    </Link>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant="outline" className={`text-[11px] ${typeMeta.badgeClass}`}>
                            <TypeIcon className="w-3 h-3 mr-1" />
                            {typeMeta.label}
                        </Badge>
                        {isOwner && !offer.is_active && (
                            <Badge variant="outline" className="text-[10px] bg-slate-800 text-slate-400 border-slate-700">
                                Inactive
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Headline + bio preview */}
                <h3 className="text-lg font-semibold text-slate-100 leading-snug mb-2">
                    {offer.headline}
                </h3>
                {offer.bio_md && (
                    <p className="text-sm text-slate-400 line-clamp-3 mb-3">
                        {offer.bio_md.replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim()}
                    </p>
                )}

                {/* Specialties */}
                {specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                        {specialties.map((s) => (
                            <Badge
                                key={s}
                                variant="secondary"
                                className="text-[11px] bg-slate-800 text-slate-300 border-slate-700"
                            >
                                {s}
                            </Badge>
                        ))}
                    </div>
                )}

                <div className="mt-auto space-y-3">
                    {/* Price + availability */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <div className="text-emerald-400 font-semibold">
                                {priceLabel}
                            </div>
                            {hasPriceNote && (
                                <div className="text-xs text-slate-500 truncate">
                                    {offer.price_note}
                                </div>
                            )}
                        </div>
                        {offer.availability_note && (
                            <div className="flex items-center gap-1 text-xs text-slate-400 text-right min-w-0">
                                <Clock className="w-3 h-3 shrink-0" />
                                <span className="truncate">{offer.availability_note}</span>
                            </div>
                        )}
                    </div>

                    {/* CTA */}
                    {isOwner ? (
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onEdit?.(offer)}
                                className="flex-1 border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                            >
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onToggleActive?.(offer)}
                                className={`flex-1 border-slate-700 bg-slate-800 hover:bg-slate-700 ${
                                    offer.is_active ? 'text-amber-300' : 'text-emerald-300'
                                }`}
                            >
                                <Power className="w-4 h-4 mr-2" />
                                {offer.is_active ? 'Deactivate' : 'Reactivate'}
                            </Button>
                        </div>
                    ) : isSelf ? (
                        <Button
                            size="sm"
                            disabled
                            className="w-full bg-slate-800 text-slate-500"
                        >
                            This is your offer
                        </Button>
                    ) : (
                        <Button
                            asChild
                            size="sm"
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
                        >
                            <Link to={messageHref}>
                                <Mail className="w-4 h-4 mr-2" />
                                Message {displayName.split(' ')[0]}
                            </Link>
                        </Button>
                    )}

                    <p className="text-[11px] text-slate-500 leading-snug">
                        Sessions and payment are arranged directly between you and
                        the mentor. Geck Inspect does not process mentorship
                        payments yet.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
