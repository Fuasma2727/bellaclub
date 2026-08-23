"use client";

import { useState, type VideoHTMLAttributes } from "react";

type PlayableVideoProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, "src"> & {
  src: string;
  videoClassName?: string;
  showErrorOverlay?: boolean;
  errorTitle?: string;
  errorDescription?: string;
};

export default function PlayableVideo({
  src,
  className = "",
  videoClassName = "",
  showErrorOverlay = true,
  errorTitle = "Video no compatible",
  errorDescription = "Este video debe volver a subirse como MP4 H.264/AAC. Si fue grabado en HEVC/H.265, hay que convertirlo y subirlo de nuevo.",
  onError,
  children,
  ...props
}: PlayableVideoProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const hasError = failedSrc === src;

  return (
    <div className={`relative ${className}`}>
      <video
        {...props}
        className={videoClassName}
        onError={(event) => {
          setFailedSrc(src);
          onError?.(event);
        }}
      >
        <source src={src} type="video/mp4" />
        {children}
      </video>

      {showErrorOverlay && hasError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/90 px-5 text-center text-white">
          <div className="max-w-sm rounded-lg border border-white/10 bg-white/[0.05] px-5 py-4 shadow-2xl shadow-black/60">
            <p className="text-sm font-semibold">{errorTitle}</p>
            <p className="mt-2 text-xs leading-5 text-neutral-300">
              {errorDescription}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
