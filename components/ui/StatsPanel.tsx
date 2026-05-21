"use client";

interface StatsPanelProps {
  nodeCount: number;
  fps: number;
}

export default function StatsPanel({ nodeCount, fps }: StatsPanelProps) {
  return (
    <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-sm border border-white/10 rounded-lg px-4 py-3 text-sm font-mono">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white/80">FPS:</span>
          <span className="text-green-400 font-bold">{fps.toFixed(0)}</span>
        </div>
        <div className="w-px h-4 bg-white/20" />
        <div className="flex items-center gap-2">
          <span className="text-white/80">Nodes:</span>
          <span className="text-blue-400 font-bold">{nodeCount}</span>
        </div>
      </div>
    </div>
  );
}
