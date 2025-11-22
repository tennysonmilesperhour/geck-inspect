import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// Badge levels for different categories
const COLLECTION_LEVELS = [
  { geckos: 1, title: "New Collector", badge: "🥚" },
  { geckos: 2, title: "Gecko Keeper", badge: "🦎" },
  { geckos: 5, title: "Hobbyist", badge: "🌿" },
  { geckos: 10, title: "Enthusiast", badge: "⭐" },
  { geckos: 15, title: "Dedicated Keeper", badge: "🌱" },
  { geckos: 20, title: "Breeder", badge: "❤️‍🔥" },
  { geckos: 30, title: "Pro Breeder", badge: "🏆" },
  { geckos: 40, title: "Expert Breeder", badge: "🧬" },
  { geckos: 50, title: "Master Breeder", badge: "👑" },
  { geckos: 75, title: "Grandmaster", badge: "🌌" },
  { geckos: 100, title: "Living Legend", badge: "💫" },
  { geckos: 150, title: "Gecko Tycoon", badge: "💼" },
  { geckos: 200, title: "Scale Sovereign", badge: "🏰" },
  { geckos: 300, title: "Reptile Royalty", badge: "⚜️" },
  { geckos: 500, title: "Crested King", badge: "🦁" },
];

const AI_TRAINING_LEVELS = [
  { images: 1, title: "Gecko Spotter", badge: "🦎" },
  { images: 5, title: "Scale Whisperer", badge: "🔍" },
  { images: 15, title: "Tail Wagger", badge: "🌟" },
  { images: 30, title: "Morph Magician", badge: "🎭" },
  { images: 50, title: "Sticky Foot Sensei", badge: "🥷" },
  { images: 80, title: "Pattern Prophet", badge: "🔮" },
  { images: 120, title: "Gecko Guru", badge: "🧘" },
  { images: 175, title: "Chromatic Champion", badge: "🏆" },
  { images: 250, title: "Metamorphosis Master", badge: "🦋" },
  { images: 350, title: "Breed Baller", badge: "🏀" },
  { images: 500, title: "Reptilian Rockstar", badge: "🎸" },
  { images: 700, title: "Gecko Gladiator", badge: "⚔️" },
  { images: 1000, title: "Legendary Lizard Lord", badge: "👑" },
  { images: 1500, title: "Mythical Morph Maven", badge: "🌈" },
  { images: 2250, title: "Gecko Godfather", badge: "🎯" },
  { images: 3500, title: "Gecko Demigod", badge: "🔱" },
  { images: 5000, title: "Ultimate Gecko Overlord", badge: "🌌" },
  { images: 7000, title: "Tail Titan", badge: "💫" },
  { images: 8500, title: "Crested Crown", badge: "👑" },
  { images: 10000, title: "Gecko God", badge: "⚡" }
];

const COMMUNITY_LEVELS = [
  { contributions: 1, title: "Community Newcomer", badge: "👋" },
  { contributions: 5, title: "Friendly Helper", badge: "🤝" },
  { contributions: 15, title: "Active Member", badge: "💬" },
  { contributions: 30, title: "Community Supporter", badge: "💪" },
  { contributions: 50, title: "Forum Regular", badge: "📝" },
  { contributions: 100, title: "Community Contributor", badge: "🌱" },
  { contributions: 200, title: "Knowledge Sharer", badge: "📚" },
  { contributions: 400, title: "Community Leader", badge: "🎯" },
  { contributions: 750, title: "Forum Veteran", badge: "🎖️" },
  { contributions: 1500, title: "Community Champion", badge: "🏆" },
  { contributions: 3000, title: "Community Hero", badge: "🦸" },
  { contributions: 5000, title: "Community Legend", badge: "⭐" },
  { contributions: 7500, title: "Community Master", badge: "🧙" },
  { contributions: 10000, title: "Community God", badge: "👑" }
];

const BREEDING_LEVELS = [
  { achievements: 1, title: "First Timer", badge: "🥚" },
  { achievements: 3, title: "Pairing Rookie", badge: "💕" },
  { achievements: 5, title: "Nest Builder", badge: "🪺" },
  { achievements: 10, title: "Hatch Helper", badge: "🐣" },
  { achievements: 15, title: "Clutch Keeper", badge: "🤱" },
  { achievements: 25, title: "Breeding Enthusiast", badge: "💖" },
  { achievements: 40, title: "Genetics Guru", badge: "🧬" },
  { achievements: 60, title: "Lineage Master", badge: "📜" },
  { achievements: 85, title: "Breeding Virtuoso", badge: "🎭" },
  { achievements: 120, title: "Reproduction Royalty", badge: "👑" },
  { achievements: 160, title: "Dynasty Builder", badge: "🏛️" },
  { achievements: 200, title: "Breeding Legend", badge: "⭐" }
];

export default function UserBadge({ 
  user,
  geckoCount = 0, 
  imageCount = 0, 
  communityCount = 0,
  breedingCount = 0,
  isExpert = false, 
  isAdmin = false,
  size = "sm",
  showTooltip = false,
  showPublicTitle = false,
  clickable = true
}) {
  const badges = [];

  // Get highest earned badge from each category
  const collectionBadge = [...COLLECTION_LEVELS].reverse().find(l => geckoCount >= l.geckos);
  const aiTrainingBadge = [...AI_TRAINING_LEVELS].reverse().find(l => imageCount >= l.images);
  const communityBadge = [...COMMUNITY_LEVELS].reverse().find(l => communityCount >= l.contributions);
  const breedingBadge = [...BREEDING_LEVELS].reverse().find(l => breedingCount >= l.achievements);

  // Add badges in order of priority
  if (isAdmin) badges.push({ badge: "⚡", type: "admin", title: "Admin" });
  if (isExpert) badges.push({ badge: "🛡️", type: "expert", title: "Expert Verifier" });
  
  // Add achievement badges based on user preference or default
  if (user?.public_title_preference === 'collection' && collectionBadge) {
    badges.push({ badge: collectionBadge.badge, type: "collection", title: collectionBadge.title });
  }
  if (user?.public_title_preference === 'ai_training' && aiTrainingBadge) {
    badges.push({ badge: aiTrainingBadge.badge, type: "ai", title: aiTrainingBadge.title });
  }
  if (user?.public_title_preference === 'community' && communityBadge) {
    badges.push({ badge: communityBadge.badge, type: "community", title: communityBadge.title });
  }
  if (user?.public_title_preference === 'breeding' && breedingBadge) {
    badges.push({ badge: breedingBadge.badge, type: "breeding", title: breedingBadge.title });
  }

  // If no preference or 'none', add default collection badge
  if (!user?.public_title_preference || user.public_title_preference === 'none' || badges.length === 0) {
    if (collectionBadge && user?.public_title_preference !== 'none') {
      badges.push({ badge: collectionBadge.badge, type: "collection", title: collectionBadge.title });
    }
  }

  if (badges.length === 0 && !isAdmin && !isExpert) return null;

  const sizeClass = size === "xs" ? "text-xs" : size === "sm" ? "text-sm" : "text-base";
  
  const badgeContent = (
    <div className="inline-flex items-center gap-0.5 ml-1">
      {badges.slice(0, showPublicTitle ? 1 : 3).map((badgeData, index) => (
        <span key={index} className="inline-flex items-center gap-1">
          <span
            className={`${sizeClass} ${showTooltip ? 'cursor-help' : ''}`}
            title={showTooltip ? badgeData.title : undefined}
          >
            {badgeData.badge}
          </span>
          {showPublicTitle && (
            <span className={`${sizeClass} font-medium text-sage-700`}>
              {badgeData.title}
            </span>
          )}
        </span>
      ))}
      {!showPublicTitle && badges.length > 3 && (
        <span className={`${sizeClass} text-sage-500`}>+{badges.length - 3}</span>
      )}
    </div>
  );

  if (clickable && user?.email) {
    return (
      <Link to={createPageUrl(`PublicProfile?email=${encodeURIComponent(user.email)}`)} target="_blank">
        {badgeContent}
      </Link>
    );
  }

  return badgeContent;
}