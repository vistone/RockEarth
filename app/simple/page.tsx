"use client";

import { useEffect, useRef, useState } from "react";
import { NodeManager, LatLonBox } from "@/lib/earth3d";
import Link from "next/link";

export default function SimplePage() {
    const nodeManagerRef = useRef<NodeManager | null>(null);
    const [nodes, setNodes] = useState<[string, { path: string; latLonBox: LatLonBox }][]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const filterLatLonBox = new LatLonBox(
            37.304420471191406,
            37.3040771484375,
            -121.88644409179688,
            -121.88610076904297
        );

        const nodeValidationHandler = (node: { latLonBox: LatLonBox }) => {
            return LatLonBox.is_overlapping(filterLatLonBox, node.latLonBox);
        };

        const manager = new NodeManager({
            nodeValidationHandler: nodeValidationHandler,
        });
        nodeManagerRef.current = manager;

        const interval = setInterval(() => {
            const nodeMap = manager.get_nodes();
            const nodeList: [string, { path: string; latLonBox: LatLonBox }][] = [];
            for (const [path, node] of nodeMap) {
                nodeList.push([path, { path: node.path, latLonBox: node.latLonBox }]);
            }
            setNodes(nodeList);
            if (nodeList.length > 0) {
                setIsLoading(false);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-2xl font-bold">Earth 3D - Node Tree Viewer</h1>
                    <Link
                        href="/"
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors text-sm font-medium"
                    >
                        Back to 3D View
                    </Link>
                </div>

                <div className="mb-4 p-4 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-sm text-white/70">
                        Filtering nodes for: {"{"}n: 37.3044, s: 37.3041, w: -121.8864, e: -121.8861{"}"}
                    </p>
                    <p className="text-sm text-white/50 mt-1">
                        Found {nodes.length} nodes
                    </p>
                </div>

                {isLoading && (
                    <div className="flex items-center gap-3 text-white/60 py-8">
                        <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        <span>Loading nodes...</span>
                    </div>
                )}

                <div className="bg-black/30 rounded-lg border border-white/10 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10 bg-white/5">
                                    <th className="text-left px-4 py-3 font-medium text-white/70">Path</th>
                                    <th className="text-left px-4 py-3 font-medium text-white/70">North</th>
                                    <th className="text-left px-4 py-3 font-medium text-white/70">South</th>
                                    <th className="text-left px-4 py-3 font-medium text-white/70">West</th>
                                    <th className="text-left px-4 py-3 font-medium text-white/70">East</th>
                                </tr>
                            </thead>
                            <tbody>
                                {nodes.map(([path, node]) => (
                                    <tr
                                        key={path}
                                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                                    >
                                        <td className="px-4 py-2 font-mono text-blue-300">{node.path}</td>
                                        <td className="px-4 py-2 text-white/80">{node.latLonBox.n.toFixed(6)}</td>
                                        <td className="px-4 py-2 text-white/80">{node.latLonBox.s.toFixed(6)}</td>
                                        <td className="px-4 py-2 text-white/80">{node.latLonBox.w.toFixed(6)}</td>
                                        <td className="px-4 py-2 text-white/80">{node.latLonBox.e.toFixed(6)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
