'use client';

import * as React from 'react';

interface ImageSlotProps {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
  width?: number;
  height?: number;
}

/** Default: plain <img>. Override at app level with next/image via ImageProvider. */
const ImageContext = React.createContext<React.ComponentType<ImageSlotProps>>(
  ({ src, alt, className }: ImageSlotProps) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  )
);

export const ImageProvider = ImageContext.Provider;
export function useImageComponent() { return React.useContext(ImageContext); }
export type { ImageSlotProps };
