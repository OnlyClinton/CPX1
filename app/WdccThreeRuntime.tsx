"use client";

import { useEffect } from "react";
import * as THREE_GL from "three";

type ThreeMode = "webgpu" | "webgl";

export default function WdccThreeRuntime() {
  useEffect(() => {
    let disposed = false;
    let currentRoot: HTMLElement | null = null;
    let renderer: any = null;
    let scene: any = null;
    let camera: any = null;
    let objects: any[] = [];
    let raf = 0;
    let resizeHandler: (() => void) | null = null;
    let attributeObserver: MutationObserver | null = null;
    let rootObserver: MutationObserver | null = null;

    const disposeScene = () => {
      cancelAnimationFrame(raf);
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      attributeObserver?.disconnect();
      attributeObserver = null;
      resizeHandler = null;

      for (const object of objects) {
        try { object.material?.map?.dispose?.(); } catch {}
        try { object.material?.dispose?.(); } catch {}
      }
      objects = [];

      try { renderer?.dispose?.(); } catch {}
      try { renderer?.domElement?.remove?.(); } catch {}
      renderer = null;
      scene = null;
      camera = null;
      currentRoot = null;
    };

    const attach = async (root: HTMLElement) => {
      if (disposed || currentRoot === root) return;
      if (document.documentElement.classList.contains("wdcc-visual-proof")) return;

      const host = root.querySelector<HTMLElement>(".li-gpu");
      if (!host) return;
      currentRoot = root;

      let THREE: any = THREE_GL;
      let mode: ThreeMode = "webgl";
      let localRenderer: any = null;

      if ("gpu" in navigator) {
        try {
          const THREE_GPU: any = await import("three/webgpu");
          localRenderer = new THREE_GPU.WebGPURenderer({ alpha: true, antialias: true });
          if (localRenderer.init) {
            await Promise.race([
              localRenderer.init(),
              new Promise((_, reject) => window.setTimeout(() => reject(new Error("webgpu-init-timeout")), 500))
            ]);
          }
          THREE = THREE_GPU;
          mode = "webgpu";
        } catch {
          try { localRenderer?.dispose?.(); } catch {}
          localRenderer = null;
          THREE = THREE_GL;
          mode = "webgl";
        }
      }

      if (!localRenderer) {
        try {
          localRenderer = new (THREE_GL as any).WebGLRenderer({
            alpha: true,
            antialias: true,
            powerPreference: "high-performance"
          });
        } catch {
          currentRoot = null;
          return;
        }
      }

      if (disposed || !root.isConnected || currentRoot !== root) {
        try { localRenderer.dispose?.(); } catch {}
        return;
      }

      renderer = localRenderer;
      const publishMode = () => {
        root.dataset.threeRuntimeMode = mode;
        root.dataset.renderMode = mode;
      };
      publishMode();
      attributeObserver = new MutationObserver(publishMode);
      attributeObserver.observe(root, {
        attributes: true,
        attributeFilter: ["data-render-mode", "data-three-runtime-mode"]
      });

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.setAttribute("aria-hidden", "true");
      host.replaceChildren(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
      camera.position.z = 2;

      const radialTexture = (inner: string, outer: string) => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 96;
        const context = canvas.getContext("2d");
        if (!context) return null;
        const gradient = context.createRadialGradient(48, 48, 0, 48, 48, 48);
        gradient.addColorStop(0, inner);
        gradient.addColorStop(0.24, inner);
        gradient.addColorStop(1, outer);
        context.fillStyle = gradient;
        context.fillRect(0, 0, 96, 96);
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
      };

      const smokeTexture = radialTexture("rgba(236,243,248,.38)", "rgba(184,204,218,0)");
      if (smokeTexture) {
        for (let i = 0; i < 10; i += 1) {
          const material = new THREE.SpriteMaterial({
            map: smokeTexture,
            transparent: true,
            depthWrite: false,
            opacity: 0.045 + Math.random() * 0.05
          });
          const sprite = new THREE.Sprite(material);
          sprite.position.set(-1.12 + Math.random() * 2.24, -0.76 + Math.random() * 1.52, 0.1);
          const scale = 0.28 + Math.random() * 0.48;
          sprite.scale.set(scale, scale * 0.58, 1);
          sprite.userData = {
            vx: (Math.random() - 0.5) * 0.00013,
            vy: 0.00009 + Math.random() * 0.00011,
            base: material.opacity,
            smoke: true
          };
          scene.add(sprite);
          objects.push(sprite);
        }
      }

      const blue = radialTexture("rgba(205,237,255,.74)", "rgba(42,149,255,0)");
      const red = radialTexture("rgba(255,176,176,.46)", "rgba(255,36,48,0)");
      const addFlare = (texture: any, x: number, y: number, sx: number, sy: number, opacity: number) => {
        if (!texture) return;
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity });
        const sprite = new THREE.Sprite(material);
        sprite.position.set(x, y, 0.2);
        sprite.scale.set(sx, sy, 1);
        sprite.userData = { base: opacity, smoke: false };
        scene.add(sprite);
        objects.push(sprite);
      };
      addFlare(blue, -0.50, -0.30, 0.38, 0.20, 0.18);
      addFlare(blue, -0.14, -0.30, 0.31, 0.17, 0.14);
      addFlare(red, 0.73, -0.59, 0.46, 0.22, 0.09);

      resizeHandler = () => {
        if (!renderer || !host.isConnected) return;
        renderer.setSize(host.clientWidth || window.innerWidth, host.clientHeight || window.innerHeight, false);
      };
      resizeHandler();
      window.addEventListener("resize", resizeHandler, { passive: true });

      const started = performance.now();
      let last = started;
      const frame = (now: number) => {
        if (disposed || !root.isConnected || currentRoot !== root) {
          disposeScene();
          return;
        }
        const elapsed = (now - started) / 1000;
        const dt = Math.min(0.034, (now - last) / 1000);
        last = now;
        const settle = 1 - Math.min(1, Math.max(0, (elapsed - 0.20) / 1.02));

        for (const object of objects) {
          if (object.userData?.smoke) {
            object.position.x += object.userData.vx * (dt * 1000);
            object.position.y += object.userData.vy * (dt * 1000);
            object.material.opacity = object.userData.base * settle;
          } else {
            object.material.opacity = object.userData.base * (0.45 + 0.55 * settle);
          }
        }

        try { renderer.render(scene, camera); } catch {}
        if (elapsed < 1.84) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    };

    const scan = () => {
      const root = document.querySelector<HTMLElement>('[data-wdcc-cinematic-intro="webgpu-three"]');
      if (root) {
        void attach(root);
      } else if (currentRoot) {
        disposeScene();
      }
    };

    scan();
    rootObserver = new MutationObserver(scan);
    rootObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      disposed = true;
      rootObserver?.disconnect();
      disposeScene();
    };
  }, []);

  return null;
}
