"use client";

import { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TilesRenderer } from "3d-tiles-renderer";
import StatsPanel from "@/components/ui/StatsPanel";

export default function EarthCanvas() {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const tilesRendererRef = useRef<TilesRenderer | null>(null);
    const rafRef = useRef<number>(0);
    const [stats, setStats] = useState({ nodeCount: 0, fps: 0 });
    const frameCountRef = useRef(0);
    const lastFpsUpdateRef = useRef(performance.now());
    const currentFpsRef = useRef(0);

    useEffect(() => {
        if (!containerRef.current) return;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0000ff);
        sceneRef.current = scene;

        // Add lights so PBR materials in loaded GLB tiles are visible
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
        dirLight.position.set(1, 0.5, 1).normalize().multiplyScalar(1e7);
        scene.add(dirLight);

        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 100000000);
        // Position camera above Earth so the globe is visible in the frustum
        camera.position.set(0, 0, 12000000);
        camera.lookAt(0, 0, 0);
        cameraRef.current = camera;

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 1000;
        controls.maxDistance = 50000000;
        controls.target.set(0, 0, 0);
        controlsRef.current = controls;

        // Setup standard 3D Tiles renderer loading our standard tileset API endpoint
        const tilesRenderer = new TilesRenderer("/api/earth/tileset.json");
        tilesRenderer.errorTarget = 6;
        tilesRenderer.loadSiblings = true;
        tilesRenderer.maxDepth = 30;
        tilesRendererRef.current = tilesRenderer;
        (window as any)._tilesRenderer = tilesRenderer;

        // Set the camera to use for tile culling
        tilesRenderer.setCamera(camera);
        tilesRenderer.setResolutionFromRenderer(camera, renderer);

        // Add tiles group to scene
        scene.add(tilesRenderer.group);

        const animate = () => {
            rafRef.current = requestAnimationFrame(animate);

            frameCountRef.current++;
            const now = performance.now();
            if (now - lastFpsUpdateRef.current >= 1000) {
                currentFpsRef.current = frameCountRef.current;
                frameCountRef.current = 0;
                lastFpsUpdateRef.current = now;
            }

            controls.update();
            camera.updateMatrixWorld();
            tilesRenderer.update();

            // Update stats
            const activeTiles = (tilesRenderer as any).stats?.active ?? 0;
            setStats({ nodeCount: activeTiles, fps: currentFpsRef.current });

            renderer.render(scene, camera);
        };

        animate();

        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            tilesRenderer.setResolutionFromRenderer(camera, renderer);
        };
        window.addEventListener("resize", handleResize);

        return () => {
            cancelAnimationFrame(rafRef.current);
            window.removeEventListener("resize", handleResize);
            tilesRenderer.dispose();
            controls.dispose();
            renderer.dispose();
            if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
                containerRef.current.removeChild(renderer.domElement);
            }
        };
    }, []);

    return (
        <div className="relative w-full h-screen">
            <StatsPanel nodeCount={stats.nodeCount} fps={stats.fps} />
            <div className="absolute bottom-4 left-4 z-10 text-white/60 text-xs max-w-md pointer-events-none">
                <p>🖱️ 左键拖拽旋转 · 右键拖拽平移 · 滚轮缩放</p>
            </div>
            <div ref={containerRef} className="w-full h-full" />
        </div>
    );
}
