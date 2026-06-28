"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { uploadBase } from "@/features/api/client";
import type { VisionLocalization } from "@/features/types/api";

type Props = {
  src: string;
  alt: string;
  localization?: VisionLocalization | null;
  active?: boolean;
};

export function LocalizationOverlay({ src, alt, localization, active = false }: Props) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 4, height: 3 });
  const imageSize = localization?.imageSize;
  const boxes = active ? localization?.boxes ?? [] : [];
  const heatmapSrc = active ? heatmapSource(localization) : "";
  const imageWidth = imageSize?.width && imageSize.width > 0 ? imageSize.width : naturalSize.width;
  const imageHeight = imageSize?.height && imageSize.height > 0 ? imageSize.height : naturalSize.height;

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return undefined;
    }

    const update = () => setFrameSize({ width: frame.clientWidth, height: frame.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const canvasStyle = useMemo(() => {
    const imageAspect = imageWidth / imageHeight;
    const frameAspect = frameSize.width && frameSize.height ? frameSize.width / frameSize.height : imageAspect;
    return frameAspect > imageAspect
      ? { height: "100%", width: "auto", aspectRatio: `${imageWidth} / ${imageHeight}` }
      : { width: "100%", height: "auto", aspectRatio: `${imageWidth} / ${imageHeight}` };
  }, [frameSize.height, frameSize.width, imageHeight, imageWidth]);

  return (
    <div className="localization-frame" ref={frameRef}>
      <div className="localization-canvas" style={canvasStyle}>
        <img
          className="localization-base"
          src={src}
          alt={alt}
          onLoad={(event) => {
            const target = event.currentTarget;
            if (target.naturalWidth > 0 && target.naturalHeight > 0) {
              setNaturalSize({ width: target.naturalWidth, height: target.naturalHeight });
            }
          }}
        />
        {heatmapSrc ? <img className="localization-heatmap" src={heatmapSrc} alt="" aria-hidden="true" /> : null}
        {boxes.map((box, index) => (
          <span
            className="localization-box"
            key={`${box.x}-${box.y}-${box.width}-${box.height}-${index}`}
            style={{
              left: `${(box.x / imageWidth) * 100}%`,
              top: `${(box.y / imageHeight) * 100}%`,
              width: `${(box.width / imageWidth) * 100}%`,
              height: `${(box.height / imageHeight) * 100}%`
            }}
          >
            <em>{Math.round(box.score * 100)}%</em>
          </span>
        ))}
      </div>
    </div>
  );
}

function heatmapSource(localization?: VisionLocalization | null) {
  if (!localization) {
    return "";
  }
  if (localization.heatmapUrl) {
    return uploadBase(localization.heatmapUrl);
  }
  if (localization.heatmapBase64) {
    return localization.heatmapBase64.startsWith("data:")
      ? localization.heatmapBase64
      : `data:image/png;base64,${localization.heatmapBase64}`;
  }
  return "";
}
