import { NextResponse } from 'next/server';
import { globalResources } from '@/lib/earth3d/3dtiles/serverResources';
import { bulkToTileset } from '@/lib/earth3d/3dtiles/standardTileset';

export async function GET() {
    try {
        const planetoid = await globalResources.request_planetoid_metadata();
        if (!planetoid) {
            return NextResponse.json({ error: "Failed to load PlanetoidMetadata" }, { status: 500 });
        }

        const rootEpoch = planetoid.root_node_metadata?.epoch ?? 0;
        
        // Fetch root bulk metadata
        const bulk = await globalResources.request_bulk_data("", rootEpoch);
        if (!bulk) {
            return NextResponse.json({ error: "Failed to load root BulkMetadata" }, { status: 500 });
        }

        // Convert root bulk metadata into standard 3D Tileset JSON
        const tileset = bulkToTileset(bulk, "", rootEpoch);

        return NextResponse.json(tileset, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=3600'
            }
        });
    } catch (err: any) {
        console.error("Error in tileset.json handler:", err);
        return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
    }
}
