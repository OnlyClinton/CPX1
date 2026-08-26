"use client";

import type { AnimationEvent, CSSProperties, RefObject, SyntheticEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WdccWebGpuIntro from "./WdccWebGpuIntro";

type IntroPhase = "loading" | "reveal" | "dock";
type RenderPath = "pending" | "gpu" | "css";
type IntroAsset = "skyline" | "car" | "logo";

type WdccIntroProps = {
  logoTargetRef: RefObject<HTMLAnchorElement | null>;
  onComplete: () => void;
};

const SKYLINE = "/wdcc-intro-tampa-skyline-v1.webp";
const CHALLENGER = "/wdcc-intro-challenger-v1.webp";
const HERO_FALLBACK = "/wdcc-hero-2vfd-1d7a0e4f.webp";
const LOGO = "/wdcc-logo-2vfd-7f10e192.webp";

export default function WdccIntro({ logoTargetRef, onComplete }: WdccIntroProps) {
  const [phase, setPhase] = useState<IntroPhase>("loading");
  const [renderPath, setRenderPath] = useState<RenderPath>("pending");
  const [renderBackend, setRenderBackend] = useState("initializing");
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  const [compositeFallback, setCompositeFallback] = useState(false);
  const [assets, setAssets] = useState<Record<IntroAsset, boolean>>({
    skyline: false,
    car: false,
    logo: false,
  });
  const [dockVars, setDockVars] = useState<CSSProperties>({});

  const badgeRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const skylineRef = useRef<HTMLImageElement>(null);
  const carRef = useRef<HTMLImageElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);
  const phaseRef = useRef<IntroPhase>("loading");
  const renderPathRef = useRef<RenderPath>("pending");
  const dockRequestedRef = useRef(false);
  const completeRef = useRef(false);

  const assetsReady = useMemo(
    () => assets.skyline && assets.car && assets.logo,
    [assets],
  );

  const markAsset = useCallback((asset: IntroAsset) => {
    setAssets((current) => current[asset] ? current : { ...current, [asset]: true });
  }, []);

  const finish = useCallback(() => {
    if (completeRef.current) return;
    completeRef.current = true;
    onComplete();
  }, [onComplete]);

  const requestDock = useCallback(() => {
    if (dockRequestedRef.current || phaseRef.current !== "reveal") return;
    dockRequestedRef.current = true;

    const target = logoTargetRef.current?.getBoundingClientRect();
    const badge = badgeRef.current?.getBoundingClientRect();

    if (target && badge) {
      const size = Math.min(target.width, target.height);
      setDockVars({
        "--intro-dock-top": `${target.top + (target.height - size) / 2}px`,
        "--intro-dock-left": `${target.left + (target.width - size) / 2}px`,
        "--intro-dock-size": `${size}px`,
      } as CSSProperties);
    }

    setPhase("dock");
  }, [logoTargetRef]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (compositeFallback) markAsset("car");
  }, [compositeFallback, markAsset]);

  useEffect(() => {
    const cachedAssets: Array<[IntroAsset, HTMLImageElement | null]> = [
      ["skyline", skylineRef.current],
      ["car", carRef.current],
      ["logo", logoRef.current],
    ];

    cachedAssets.forEach(([asset, image]) => {
      if (image?.complete && image.naturalWidth > 0) markAsset(asset);
    });
  }, [compositeFallback, markAsset]);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setReducedMotion(preference.matches);
    syncPreference();
    preference.addEventListener("change", syncPreference);
    return () => preference.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    if (reducedMotion === null) return;
    if (reducedMotion) {
      renderPathRef.current = "css";
      setRenderBackend("static-reduced-motion");
      setRenderPath("css");
      return;
    }

    if (renderPathRef.current !== "pending") return;
    const gpuWatchdog = window.setTimeout(() => {
      if (renderPathRef.current !== "pending") return;
      renderPathRef.current = "css";
      setRenderBackend("css-timeout-fallback");
      setRenderPath("css");
    }, 5000);
    return () => window.clearTimeout(gpuWatchdog);
  }, [reducedMotion, renderPath]);

  useEffect(() => {
    if (phase !== "loading" || !assetsReady || renderPath === "pending") return;

    let frameTwo = 0;
    const startWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      const frameOne = window.requestAnimationFrame(() => {
        frameTwo = window.requestAnimationFrame(() => setPhase("reveal"));
      });
      return () => window.cancelAnimationFrame(frameOne);
    };

    const cancelFrameOne = startWhenVisible();
    document.addEventListener("visibilitychange", startWhenVisible, { once: true });
    return () => {
      cancelFrameOne?.();
      window.cancelAnimationFrame(frameTwo);
      document.removeEventListener("visibilitychange", startWhenVisible);
    };
  }, [assetsReady, phase, renderPath]);

  useEffect(() => {
    if (phase !== "loading") return;
    const assetWatchdog = window.setTimeout(() => {
      setCompositeFallback(true);
      renderPathRef.current = "css";
      setRenderBackend("css-asset-fallback");
      setRenderPath("css");
      setAssets({ skyline: true, car: true, logo: true });
    }, 8000);
    return () => window.clearTimeout(assetWatchdog);
  }, [phase]);

  useEffect(() => {
    if (phase !== "reveal") return;
    const revealWatchdog = window.setTimeout(
      requestDock,
      reducedMotion ? 1100 : 2800,
    );
    return () => window.clearTimeout(revealWatchdog);
  }, [phase, reducedMotion, requestDock]);

  useEffect(() => {
    if (phase !== "dock") return;
    const dockWatchdog = window.setTimeout(finish, reducedMotion ? 500 : 980);
    return () => window.clearTimeout(dockWatchdog);
  }, [finish, phase, reducedMotion]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      skipRef.current?.focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
      if (event.key === "Tab") {
        event.preventDefault();
        skipRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [finish]);

  const handleSkylineError = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (image.src.endsWith(HERO_FALLBACK)) {
      markAsset("skyline");
      return;
    }
    setCompositeFallback(true);
    image.src = HERO_FALLBACK;
  };

  const handleCarError = () => {
    setCompositeFallback(true);
    setAssets((current) => ({ ...current, skyline: false, car: true }));
  };

  const handleLogoError = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (image.src.endsWith("/wdcc-logo-transparent.webp")) {
      markAsset("logo");
      return;
    }
    image.src = "/wdcc-logo-transparent.webp";
  };

  const handleCssCarAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (
      event.target === event.currentTarget
      && event.animationName === "wdccCarEnter"
      && renderPath === "css"
    ) {
      requestDock();
    }
  };

  const pathClass = `intro-path-${renderPath}`;

  return (
    <div
      className={`intro-sequence intro-${phase} ${pathClass}${assetsReady ? " intro-assets-ready" : ""}`}
      style={dockVars}
      data-renderer={renderBackend}
      role="dialog"
      aria-modal="true"
      aria-label="WDCC opening animation"
      aria-busy={phase === "loading"}
    >
      {reducedMotion === false && (
        <WdccWebGpuIntro
          enabled={renderPath !== "css"}
          playing={phase === "reveal" && renderPath === "gpu"}
          reducedMotion={false}
          onReady={(backend) => {
            if (
              phaseRef.current !== "loading"
              || renderPathRef.current !== "pending"
            ) return;
            renderPathRef.current = "gpu";
            setRenderBackend(backend);
            setRenderPath("gpu");
          }}
          onDriveComplete={requestDock}
          onFailure={() => {
            if (
              phaseRef.current === "dock"
              || renderPathRef.current === "css"
            ) return;
            renderPathRef.current = "css";
            setRenderBackend("css-renderer-fallback");
            setRenderPath("css");
          }}
        />
      )}

      <div className="intro-fallback" aria-hidden="true">
        <div className="intro-skyline-stage">
          <img
            ref={skylineRef}
            className="intro-skyline"
            src={compositeFallback ? HERO_FALLBACK : SKYLINE}
            alt=""
            width="1672"
            height="941"
            fetchPriority="high"
            decoding="async"
            onLoad={() => markAsset("skyline")}
            onError={handleSkylineError}
          />
        </div>
        {!compositeFallback && (
          <div className="intro-car-stage" onAnimationEnd={handleCssCarAnimationEnd}>
            <img
              ref={carRef}
              className="intro-car"
              src={CHALLENGER}
              alt=""
              width="1672"
              height="941"
              fetchPriority="high"
              decoding="async"
              onLoad={() => markAsset("car")}
              onError={handleCarError}
            />
          </div>
        )}
        <div className="intro-headlight-sweep" />
        <div className="intro-smoke smoke-one" />
        <div className="intro-smoke smoke-two" />
      </div>

      <div className="intro-badge" ref={badgeRef}>
        <img
          ref={logoRef}
          src={LOGO}
          alt="We Don't Care Cars"
          width="512"
          height="512"
          fetchPriority="high"
          decoding="async"
          onLoad={() => markAsset("logo")}
          onError={handleLogoError}
        />
      </div>
      <p className="intro-tagline">Tampa Bay · Drive today</p>
      <button ref={skipRef} className="intro-skip" type="button" onClick={finish}>Skip intro</button>
    </div>
  );
}
