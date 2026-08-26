"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";

export type WdccWebGpuBackend = "webgpu" | "webgl2";

export type WdccWebGpuIntroProps = {
  enabled: boolean;
  playing: boolean;
  reducedMotion: boolean;
  onReady: (backend: WdccWebGpuBackend) => void;
  onDriveComplete: () => void;
  onFailure: (error: unknown) => void;
};

type Disposable = { dispose: () => void };

type SmokeParticle = {
  sprite: import("three/webgpu").Sprite;
  material: import("three/webgpu").SpriteMaterial;
  delay: number;
  lifetime: number;
  drift: number;
  lift: number;
  baseScale: number;
  phase: number;
};

const HOST_STYLE: CSSProperties = {
  position: "fixed",
  inset: 0,
  width: "100vw",
  height: "100dvh",
  overflow: "hidden",
  pointerEvents: "none",
  userSelect: "none",
  touchAction: "none",
};

const SKYLINE_URL = "/wdcc-intro-tampa-skyline-v1.webp";
const CHALLENGER_URL = "/wdcc-intro-challenger-v1.webp";
const WORLD_HEIGHT = 100;
const DRIVE_DURATION_MS = 2_050;
const EFFECT_DURATION_MS = 2_700;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const progress = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return progress * progress * (3 - 2 * progress);
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - clamp(value, 0, 1), 3);
}

function settleProgress(value: number) {
  const progress = clamp(value, 0, 1);
  if (progress === 1) return 1;

  // A critically damped-looking arrival with one restrained overshoot.
  return clamp(
    1
      - Math.exp(-6.6 * progress)
        * (Math.cos(10.5 * progress) + 0.18 * Math.sin(10.5 * progress)),
    -0.04,
    1.08,
  );
}

function getImageSize(texture: import("three/webgpu").Texture) {
  const image = texture.image as {
    naturalWidth?: number;
    naturalHeight?: number;
    videoWidth?: number;
    videoHeight?: number;
    width?: number;
    height?: number;
  } | null;

  const width = Number(
    image?.naturalWidth ?? image?.videoWidth ?? image?.width ?? 1,
  );
  const height = Number(
    image?.naturalHeight ?? image?.videoHeight ?? image?.height ?? 1,
  );

  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

function makeSmokeTexture(THREE: typeof import("three/webgpu")) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("WDCC intro could not create its smoke texture.");

  const gradient = context.createRadialGradient(64, 64, 3, 64, 64, 62);
  gradient.addColorStop(0, "rgba(235,242,247,0.72)");
  gradient.addColorStop(0.24, "rgba(186,199,208,0.42)");
  gradient.addColorStop(0.58, "rgba(97,112,123,0.16)");
  gradient.addColorStop(1, "rgba(18,25,31,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function invokeSafely(callback: (() => void) | undefined) {
  try {
    callback?.();
  } catch {
    // Consumer callback failures must not take down the rendering loop.
  }
}

export default function WdccWebGpuIntro({
  enabled,
  playing,
  reducedMotion,
  onReady,
  onDriveComplete,
  onFailure,
}: WdccWebGpuIntroProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ onReady, onDriveComplete, onFailure });
  const playingRef = useRef(playing);
  const beginPlaybackRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    callbacksRef.current = { onReady, onDriveComplete, onFailure };
  }, [onReady, onDriveComplete, onFailure]);

  useEffect(() => {
    playingRef.current = playing;
    if (playing) beginPlaybackRef.current?.();
  }, [playing]);

  useEffect(() => {
    if (!enabled) return;

    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let failed = false;
    let rendererDisposed = false;
    let animationFrame = 0;
    let resizeObserver: ResizeObserver | null = null;
    let renderer: import("three/webgpu").WebGPURenderer | null = null;
    let rendererCanvas: HTMLCanvasElement | null = null;
    const resources: Disposable[] = [];

    const disposeRenderer = () => {
      if (!renderer || rendererDisposed) return;
      rendererDisposed = true;
      renderer.dispose();
    };

    const disposeResources = () => {
      while (resources.length) {
        try {
          resources.pop()?.dispose();
        } catch {
          // Continue releasing the rest of the GPU resources.
        }
      }
    };

    const reportFailure = (error: unknown) => {
      if (failed || disposed) return;
      failed = true;
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      beginPlaybackRef.current = null;
      rendererCanvas?.remove();
      disposeResources();
      disposeRenderer();
      try {
        callbacksRef.current.onFailure(error);
      } catch {
        // The existing non-GPU intro remains responsible for visual fallback.
      }
    };

    const start = async () => {
      try {
        const THREE = await import("three/webgpu");
        if (disposed) return;

        renderer = new THREE.WebGPURenderer({
          alpha: true,
          antialias: true,
          depth: true,
          powerPreference: "high-performance",
        });
        await renderer.init();
        if (disposed) {
          disposeRenderer();
          return;
        }

        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.setClearColor(0x02070d, 0);

        const textureLoader = new THREE.TextureLoader();
        const [skylineTexture, challengerTexture] = await Promise.all([
          textureLoader.loadAsync(SKYLINE_URL),
          textureLoader.loadAsync(CHALLENGER_URL),
        ]);
        resources.push(skylineTexture, challengerTexture);

        if (disposed) {
          disposeResources();
          disposeRenderer();
          return;
        }

        skylineTexture.colorSpace = THREE.SRGBColorSpace;
        skylineTexture.minFilter = THREE.LinearFilter;
        skylineTexture.magFilter = THREE.LinearFilter;

        challengerTexture.colorSpace = THREE.SRGBColorSpace;
        challengerTexture.minFilter = THREE.LinearFilter;
        challengerTexture.magFilter = THREE.LinearFilter;
        challengerTexture.premultiplyAlpha = true;

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-50, 50, 50, -50, 0.1, 100);
        camera.position.set(0, 0, 12);
        camera.lookAt(0, 0, 0);

        const skylineGeometry = new THREE.PlaneGeometry(1, 1);
        const skylineMaterial = new THREE.MeshBasicMaterial({
          map: skylineTexture,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
        });
        const skyline = new THREE.Mesh(skylineGeometry, skylineMaterial);
        skyline.position.z = -4;
        skyline.renderOrder = 0;
        scene.add(skyline);
        resources.push(skylineGeometry, skylineMaterial);

        const carGeometry = new THREE.PlaneGeometry(1, 1);
        const carMaterial = new THREE.MeshBasicMaterial({
          map: challengerTexture,
          transparent: true,
          alphaTest: 0.008,
          depthTest: false,
          depthWrite: false,
          premultipliedAlpha: true,
          toneMapped: false,
        });
        const car = new THREE.Mesh(carGeometry, carMaterial);
        car.position.z = 1;
        car.renderOrder = 3;
        scene.add(car);
        resources.push(carGeometry, carMaterial);

        const smokeTexture = makeSmokeTexture(THREE);
        resources.push(smokeTexture);

        const smokeGroup = new THREE.Group();
        smokeGroup.position.z = 0.5;
        smokeGroup.renderOrder = 2;
        scene.add(smokeGroup);

        const smoke: SmokeParticle[] = [];
        for (let index = 0; index < 18; index += 1) {
          const material = new THREE.SpriteMaterial({
            map: smokeTexture,
            color: index % 3 === 0 ? 0xcbd4da : 0x87949d,
            transparent: true,
            opacity: 0,
            depthTest: false,
            depthWrite: false,
            blending: THREE.NormalBlending,
            toneMapped: false,
          });
          material.rotation = ((index * 1.93) % Math.PI) - Math.PI / 2;

          const sprite = new THREE.Sprite(material);
          sprite.renderOrder = 2;
          smokeGroup.add(sprite);
          resources.push(material);

          smoke.push({
            sprite,
            material,
            delay: (index % 6) * 0.09 + Math.floor(index / 6) * 0.17,
            lifetime: 0.72 + (index % 5) * 0.075,
            drift: ((index * 37) % 11) / 10 - 0.5,
            lift: 0.66 + ((index * 17) % 8) / 10,
            baseScale: 3.4 + ((index * 23) % 9) * 0.42,
            phase: index * 1.87,
          });
        }

        const skylineImage = getImageSize(skylineTexture);
        const skylineAspect = skylineImage.width / skylineImage.height;

        let worldWidth = WORLD_HEIGHT;
        let skylineBaseX = 0;
        let carStartX = 0;
        let carTargetX = 0;
        let carTargetY = 0;
        let carWorldWidth = WORLD_HEIGHT;
        let carWorldHeight = WORLD_HEIGHT / skylineAspect;
        let lastDriveProgress = reducedMotion ? 1 : 0;

        const applyLayout = () => {
          const bounds = host.getBoundingClientRect();
          const width = Math.max(1, Math.round(bounds.width || window.innerWidth));
          const height = Math.max(1, Math.round(bounds.height || window.innerHeight));
          const aspect = width / height;
          const compact = aspect < 0.82;

          worldWidth = WORLD_HEIGHT * aspect;

          camera.left = -worldWidth / 2;
          camera.right = worldWidth / 2;
          camera.top = WORLD_HEIGHT / 2;
          camera.bottom = -WORLD_HEIGHT / 2;
          camera.updateProjectionMatrix();

          const dprCap = compact ? 1.45 : 1.75;
          renderer?.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
          renderer?.setSize(width, height, false);

          const skylineWidthFromHeight = WORLD_HEIGHT * skylineAspect;
          const coverByHeight = skylineWidthFromHeight >= worldWidth;
          const skylineWorldWidth = coverByHeight
            ? skylineWidthFromHeight
            : worldWidth;
          const skylineWorldHeight = coverByHeight
            ? WORLD_HEIGHT
            : worldWidth / skylineAspect;

          // Keep downtown Tampa and the waterfront in frame as aspect ratio narrows.
          const focalX = compact ? 0.69 : aspect < 1.25 ? 0.62 : 0.56;
          const maximumOffsetX = Math.max(0, (skylineWorldWidth - worldWidth) / 2);
          skylineBaseX = clamp(
            (0.5 - focalX) * skylineWorldWidth,
            -maximumOffsetX,
            maximumOffsetX,
          );
          skyline.position.set(skylineBaseX, 0, -4);
          skyline.scale.set(skylineWorldWidth, skylineWorldHeight, 1);

          // The Challenger is a transparent, full-frame registration plate.
          // Matching the skyline transform preserves its exact generated scale
          // and position at rest on every aspect ratio.
          carWorldWidth = skylineWorldWidth;
          carWorldHeight = skylineWorldHeight;
          carTargetX = skylineBaseX;
          carTargetY = 0;
          carStartX = carTargetX + worldWidth * (compact ? 1.85 : 0.9);
          car.scale.set(carWorldWidth, carWorldHeight, 1);

          const settled = settleProgress(lastDriveProgress);
          car.position.set(
            THREE.MathUtils.lerp(carStartX, carTargetX, settled),
            carTargetY,
            1,
          );
        };

        applyLayout();
        resizeObserver = new ResizeObserver(applyLayout);
        resizeObserver.observe(host);
        window.addEventListener("resize", applyLayout, { passive: true });
        window.visualViewport?.addEventListener("resize", applyLayout, {
          passive: true,
        });
        resources.push({
          dispose: () => {
            window.removeEventListener("resize", applyLayout);
            window.visualViewport?.removeEventListener("resize", applyLayout);
          },
        });

        rendererCanvas = renderer.domElement;
        rendererCanvas.setAttribute("aria-hidden", "true");
        rendererCanvas.style.display = "block";
        rendererCanvas.style.width = "100%";
        rendererCanvas.style.height = "100%";
        rendererCanvas.style.pointerEvents = "none";

        const handleContextLost = (event: Event) => {
          event.preventDefault();
          reportFailure(new Error("WDCC intro graphics context was lost."));
        };
        rendererCanvas.addEventListener("webglcontextlost", handleContextLost);

        const originalOnDeviceLost = renderer.onDeviceLost.bind(renderer);
        const originalOnError = renderer.onError.bind(renderer);
        renderer.onDeviceLost = (info) => {
          originalOnDeviceLost(info);
          reportFailure(new Error("WDCC intro graphics device was lost."));
        };
        renderer.onError = (message) => {
          originalOnError(message);
          reportFailure(new Error(`WDCC intro renderer error: ${String(message)}`));
        };

        const updateScene = (elapsedMs: number) => {
          const driveProgress = reducedMotion
            ? 1
            : clamp(elapsedMs / DRIVE_DURATION_MS, 0, 1);
          lastDriveProgress = driveProgress;
          const settled = settleProgress(driveProgress);
          const carX = THREE.MathUtils.lerp(carStartX, carTargetX, settled);
          const roadShudder = reducedMotion
            ? 0
            : Math.sin(driveProgress * Math.PI * 10)
              * (1 - driveProgress)
              * 0.22;

          car.position.set(carX, carTargetY + roadShudder, 1);
          car.rotation.z = reducedMotion
            ? 0
            : Math.sin(driveProgress * Math.PI * 7)
              * (1 - driveProgress)
              * 0.0045;

          const cameraProgress = reducedMotion
            ? 1
            : easeOutCubic(elapsedMs / 2_350);
          camera.zoom = 1 + cameraProgress * 0.032;
          camera.updateProjectionMatrix();

          const driveVisibility = reducedMotion
            ? 0
            : smoothstep(0.025, 0.18, driveProgress)
              * (1 - smoothstep(0.74, 1, driveProgress));
          const smokeClock = elapsedMs / 1_000;
          const smokeOriginX = carX + carWorldWidth * 0.34;
          const smokeOriginY = carTargetY - carWorldHeight * 0.27;

          smoke.forEach((particle, index) => {
            const age = Math.max(0, smokeClock - particle.delay);
            const life = (age % particle.lifetime) / particle.lifetime;
            const hasStarted = smokeClock >= particle.delay;
            const billow = Math.sin(Math.PI * life);
            const lateralNoise = Math.sin(particle.phase + life * 5.4) * 0.6;
            const scale = particle.baseScale * (0.55 + life * 1.7);

            particle.sprite.position.set(
              smokeOriginX
                - life * carWorldWidth * (0.13 + index * 0.002)
                + (particle.drift + lateralNoise) * 1.5,
              smokeOriginY + life * particle.lift * 5.1,
              0.5,
            );
            particle.sprite.scale.set(scale * 1.65, scale, 1);
            particle.material.opacity = hasStarted
              ? driveVisibility * Math.pow(billow, 1.35) * 0.31
              : 0;
            particle.material.rotation += 0.0015 * (index % 2 ? 1 : -1);
          });
        };

        updateScene(reducedMotion ? DRIVE_DURATION_MS : 0);
        await renderer.compileAsync(scene, camera);
        renderer.render(scene, camera);

        if (disposed || failed) {
          rendererCanvas.removeEventListener("webglcontextlost", handleContextLost);
          disposeResources();
          disposeRenderer();
          return;
        }

        host.appendChild(rendererCanvas);
        const backend: WdccWebGpuBackend = (
          renderer.backend as { isWebGPUBackend?: boolean }
        ).isWebGPUBackend
          ? "webgpu"
          : "webgl2";
        try {
          callbacksRef.current.onReady(backend);
        } catch {
          // Rendering remains valid even if the consumer callback fails.
        }

        let driveCallbackSent = false;
        let startedAt: number | null = null;
        const renderFrame = (now: number) => {
          animationFrame = 0;
          if (disposed || failed || !renderer) return;
          if (!playingRef.current && !reducedMotion) return;

          if (startedAt === null) startedAt = now;
          const elapsedMs = reducedMotion ? DRIVE_DURATION_MS : now - startedAt;
          try {
            updateScene(elapsedMs);
            renderer.render(scene, camera);
          } catch (error) {
            reportFailure(error);
            return;
          }

          if (!driveCallbackSent && elapsedMs >= DRIVE_DURATION_MS) {
            driveCallbackSent = true;
            invokeSafely(callbacksRef.current.onDriveComplete);
          }

          if (!reducedMotion && elapsedMs < EFFECT_DURATION_MS) {
            animationFrame = window.requestAnimationFrame(renderFrame);
          }
        };

        const beginPlayback = () => {
          if (disposed || failed || animationFrame || !renderer) return;
          animationFrame = window.requestAnimationFrame(renderFrame);
        };
        beginPlaybackRef.current = beginPlayback;

        if (reducedMotion) beginPlayback();
        else if (playingRef.current) beginPlayback();

        resources.push({
          dispose: () => {
            rendererCanvas?.removeEventListener(
              "webglcontextlost",
              handleContextLost,
            );
          },
        });
      } catch (error) {
        reportFailure(error);
      }
    };

    void start();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      beginPlaybackRef.current = null;
      resizeObserver?.disconnect();
      rendererCanvas?.remove();
      disposeResources();
      disposeRenderer();
    };
  }, [enabled, reducedMotion]);

  return (
    <div
      ref={hostRef}
      className="intro-gpu-host"
      style={HOST_STYLE}
      aria-hidden="true"
    />
  );
}
