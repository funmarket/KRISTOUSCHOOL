import React, { useState } from 'react';
import { getChildAvatarInitials } from '../../../lib/domains/pickup.ts';

export interface PickupChildAvatarProps {
  photoUrl?: string | null;
  fullName: string;
}

export const PickupChildAvatar: React.FC<PickupChildAvatarProps> = ({ photoUrl, fullName }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const trimmedUrl = typeof photoUrl === 'string' ? photoUrl.trim() : '';
  const showImage = trimmedUrl.length > 0 && !imageFailed;

  if (showImage) {
    return (
      <img
        src={trimmedUrl}
        alt={fullName}
        onError={() => setImageFailed(true)}
        className="w-14 h-14 rounded-2xl object-cover border border-gray-200 dark:border-gray-700 shrink-0"
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={fullName}
      data-testid="pickup-avatar-fallback"
      className="w-14 h-14 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-extrabold text-sm flex items-center justify-center shrink-0 select-none"
    >
      {getChildAvatarInitials(fullName)}
    </div>
  );
};
