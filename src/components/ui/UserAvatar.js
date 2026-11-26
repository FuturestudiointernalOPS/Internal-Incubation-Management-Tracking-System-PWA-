"use client";

import { useState } from "react";
import AppImage from "@/components/ui/AppImage";

/**
 * UserAvatar — a person's photo, or their initial when there is none or the
 * photo cannot be loaded.
 */
export default function UserAvatar({ name, image }) {
  // Remembers WHICH photo failed, so a newly uploaded one gets its own chance.
  const [failedImage, setFailedImage] = useState(null);
  const showImage = Boolean(image) && image !== failedImage;

  return (
    <div className="w-8 h-8 rounded overflow-hidden bg-primary border border-[var(--border-primary)] flex items-center justify-center font-bold text-xs">
      {showImage ? (
        <AppImage
          src={image}
          alt={name || ""}
          className="w-full h-full object-cover"
          onError={() => setFailedImage(image)}
        />
      ) : (
        String(name || "U").charAt(0)
      )}
    </div>
  );
}
