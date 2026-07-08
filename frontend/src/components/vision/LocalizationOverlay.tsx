"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { uploadBase } from "@/features/api/client";
import type { VisionLocalization } from "@/features/types/api";

type HeatmapMode = "threshold" | "full" | "focus";

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
  const [mode, setMode] = useState<HeatmapMode>("threshold");
  const imageSize = localization?.imageSize;
  const heatmapModes = useMemo(() => availableModes(localization), [localization]);
  const selectedMode = heatmapModes.some((item) => item.mode === mode) ? mode : "threshold";
  const heatmapSrc = active ? heatmapSource(localization, selectedMode) : "";
  const imageWidth = imageSize?.width && imageSize.width > 0 ? imageSize.width : naturalSize.width;
  const imageHeight = imageSize?.height && imageSize.height > 0 ? imageSize.height : naturalSize.height;

  useEffect(() => {
    setMode("threshold");
  }, [localization]);

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
        {heatmapSrc ? <img className={`localization-heatmap ${selectedMode}`} src={heatmapSrc} alt="" aria-hidden="true" /> : null}
        {active && heatmapModes.length > 1 ? (
          <div className="localization-mode-toggle" aria-label="Heatmap display mode">
            {heatmapModes.map((item) => (
              <button
                key={item.mode}
                type="button"
                aria-pressed={selectedMode === item.mode}
                onClick={() => setMode(item.mode)}
                title={item.title}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function availableModes(localization?: VisionLocalization | null): Array<{ mode: HeatmapMode; label: string; title: string }> {
  if (!localization) {
    return [];
  }

  const modes: Array<{ mode: HeatmapMode; label: string; title: string }> = [];
  if (hasHeatmap(localization, "threshold")) {
    modes.push({ mode: "threshold", label: "기준", title: "Threshold 기준 heatmap" });
  }
  if (hasHeatmap(localization, "full")) {
    modes.push({ mode: "full", label: "전체", title: "전체 분포 heatmap" });
  }
  if (hasHeatmap(localization, "focus")) {
    modes.push({ mode: "focus", label: "강조", title: "이상 영역 강조" });
  }
  return modes;
}

function hasHeatmap(localization: VisionLocalization, mode: HeatmapMode) {
  const source = heatmapValue(localization, mode);
  return Boolean(source.url || source.base64);
}

function heatmapSource(localization?: VisionLocalization | null, mode: HeatmapMode = "threshold") {
  if (!localization) {
    return "";
  }

  const source = heatmapValue(localization, mode);
  if (source?.url) {
    return uploadBase(source.url);
  }
  if (source?.base64) {
    return source.base64.startsWith("data:")
      ? source.base64
      : `data:image/png;base64,${source.base64}`;
  }

  if (mode !== "threshold") {
    return heatmapSource(localization, "threshold");
  }
  return "";
}

function heatmapValue(localization: VisionLocalization, mode: HeatmapMode) {
  if (mode === "full") {
    return { url: localization.heatmapFullUrl, base64: localization.heatmapFullBase64 };
  }
  if (mode === "focus") {
    return { url: localization.heatmapFocusUrl, base64: localization.heatmapFocusBase64 };
  }
  return { url: localization.heatmapUrl, base64: localization.heatmapBase64 };
}
