'use client';

import Image from 'next/image';
import { ImageProvider } from '@kunacademy/ui/image-slot';

/**
 * Provides next/image to the shared UI package's card components.
 * Wrap the app tree so all cards render optimized images.
 */
export function NextImageProvider({ children }: { children: React.ReactNode }) {
  return (
    <ImageProvider value={Image as any}>
      {children}
    </ImageProvider>
  );
}
