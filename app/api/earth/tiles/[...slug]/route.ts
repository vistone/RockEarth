import { NextRequest, NextResponse } from 'next/server';
import { globalResources } from '@/lib/earth3d/3dtiles/serverResources';
import { bulkToTileset, nodeToGLB } from '@/lib/earth3d/3dtiles/standardTileset';

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ slug: string[] }> }
) {
    const params = await props.params;
    const { slug } = params;
    if (!slug || slug.length < 2) {
        return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    try {
        const lastItem = slug[slug.length - 1];

        // Case 1: Subtree tileset JSON
        if (lastItem.endsWith('.json')) {
            // URL format: /api/earth/tiles/[path]/[epoch].json
            // slug example: ["0123", "100.json"]
            const path = slug.slice(0, slug.length - 1).join(''); // Usually just slug[0]
            const epochStr = lastItem.slice(0, -5);
            const epoch = parseInt(epochStr, 10);

            const bulk = await globalResources.request_bulk_data(path, epoch);
            if (!bulk) {
                // Return an empty standard 3D Tileset to prevent console errors in viewers when Google Earth does not have bulk data at this path.
                return NextResponse.json({
                    asset: {
                        version: "1.0"
                    },
                    root: {
                        boundingVolume: {
                            box: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]
                        },
                        geometricError: 0,
                        refine: "REPLACE"
                    }
                }, {
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'public, max-age=3600'
                    }
                });
            }

            const tileset = bulkToTileset(bulk, path, epoch);
            return NextResponse.json(tileset, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'public, max-age=3600'
                }
            });
        }

        // Case 2: GLB Mesh
        if (lastItem.endsWith('.glb')) {
            // URL format: /api/earth/tiles/[path]/[epoch]/[textureFormat]/[imageryEpoch].glb
            // slug example: ["0123", "100", "1", "0.glb"]
            if (slug.length < 4) {
                return NextResponse.json({ error: "Invalid GLB parameters" }, { status: 400 });
            }

            const path = slug.slice(0, slug.length - 3).join('');
            const epoch = parseInt(slug[slug.length - 3], 10);
            const textureFormat = parseInt(slug[slug.length - 2], 10);
            const imageryEpochStr = lastItem.slice(0, -4);
            const imageryEpoch = parseInt(imageryEpochStr, 10);

            // Reconstruct a simple fake NodeHeader so the request_node_data is standard and matches existing types
            const fakeNodeHeader = {
                path: path,
                epoch: epoch,
                texture_format: textureFormat,
                imagery_epoch: imageryEpoch,
                can_have_data: true,
                flags: 0,
                level: path.length,
                is_bulk: false,
                obb: { center: {x:0,y:0,z:0}, extents: {x:0,y:0,z:0}, orientation: {elements: [1,0,0,0,1,0,0,0,1]} },
                latLonBox: { north: 0, south: 0, east: 0, west: 0 },
                meters_per_texel: 1,
                parent_bulk: "",
                path_and_flags: { path: "", level: 0, flags: 0 },
                state: 0
            } as any;

            const node = await globalResources.request_node_data(fakeNodeHeader);
            if (!node) {
                return NextResponse.json({ error: `Node not found or empty: path=${path}` }, { status: 404 });
            }

            console.log(`[GLB] generating for path=${path} epoch=${epoch}`);
            const glbBuffer = nodeToGLB(node);
            if (!glbBuffer) {
                return NextResponse.json({ error: `Failed to compile GLB for path=${path}` }, { status: 404 });
            }

            return new NextResponse(new Uint8Array(glbBuffer), {
                status: 200,
                headers: {
                    'Content-Type': 'model/gltf-binary',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'no-cache'
                }
            });
        }

        return NextResponse.json({ error: "Unsupported request format" }, { status: 400 });

    } catch (err: any) {
        console.error("Error in slug tiles route:", err);
        return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
    }
}
