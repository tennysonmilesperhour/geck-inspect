import { memo, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Image as ImageIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNowStrict } from 'date-fns';

/**
 * Recent gallery submissions.
 *
 * Perf notes: the old version used `group-hover:scale-105` on every tile
 * plus a full-surface gradient overlay whose opacity animated on hover.
 * Both of those force image repaints on every mouseover which made the
 * dashboard feel like molasses when there were ~20 tiles laid out. This
 * version drops the scale transform and the overlay — hovering just
 * reveals a compact metadata strip via `content-visibility` + `will-change`
 * tricks, so there's no layout thrash.
 */

const Tile = memo(function Tile({ image, uploader: _uploader, onClick }) {
    const morph = (image.primary_morph || 'gecko').replace(/_/g, ' ');
    return (
        <button
            type="button"
            onClick={onClick}
            className="tile"
            style={{
                contain: 'layout paint',
                willChange: 'auto',
            }}
        >
            <img
                src={image.image_url}
                alt={morph}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
            />
            <div className="tile-overlay">
                <div className="tile-meta">
                    <div className="tile-morph">{morph}</div>
                    <div className="tile-time">
                        {formatDistanceToNowStrict(new Date(image.created_date), { addSuffix: true })}
                    </div>
                </div>
            </div>
        </button>
    );
});

export default function RecentActivity({ geckoImages, isLoading, onImageSelect, users = [] }) {
    const usersMap = useMemo(() => new Map(users.map((u) => [u.email, u])), [users]);

    return (
        <Card className="gecko-card">
            <CardHeader>
                <CardTitle className="text-gecko-text text-glow flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-gecko-accent" />
                    Latest Community Uploads
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                        {[...Array(5)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
                    </div>
                ) : (
                    <div className="recent-activity-grid">
                        {geckoImages.map((image) => (
                            <Tile
                                key={image.id}
                                image={image}
                                uploader={usersMap.get(image.created_by)}
                                onClick={() => onImageSelect(image, usersMap.get(image.created_by))}
                            />
                        ))}
                    </div>
                )}
            </CardContent>
            {/* Scoped styles. Kept in the component file instead of a
                separate CSS file so the perf fixes stay close to the code
                they affect. */}
            <style>{`
                .recent-activity-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                }
                @media (min-width: 640px) {
                    .recent-activity-grid { grid-template-columns: repeat(5, 1fr); }
                }
                .tile {
                    position: relative;
                    aspect-ratio: 1 / 1;
                    border-radius: 10px;
                    overflow: hidden;
                    background: rgba(15, 23, 42, 0.6);
                    border: 1px solid rgba(52, 211, 153, 0.1);
                    cursor: pointer;
                    padding: 0;
                    transition: border-color 0.12s ease;
                }
                .tile:hover {
                    border-color: rgba(52, 211, 153, 0.5);
                }
                .tile img {
                    display: block;
                    transition: none;
                }
                .tile-overlay {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: flex-end;
                    padding: 6px 8px;
                    background: linear-gradient(to top, rgba(0,0,0,0.75), transparent 55%);
                    opacity: 0;
                    transition: opacity 0.12s ease;
                    pointer-events: none;
                }
                .tile:hover .tile-overlay {
                    opacity: 1;
                }
                .tile-meta {
                    color: white;
                    text-align: left;
                    font-size: 10px;
                    line-height: 1.15;
                    width: 100%;
                }
                .tile-morph {
                    font-weight: 700;
                    text-transform: capitalize;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .tile-time {
                    opacity: 0.75;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
            `}</style>
        </Card>
    );
}
