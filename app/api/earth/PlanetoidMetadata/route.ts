import { NextResponse } from 'next/server';
import { GetURL } from '@/lib/earth3d/utils/GetURL';

export async function GET() {
    try {
        const buffer = await GetURL("https://kh.google.com/rt/earth/PlanetoidMetadata");
        if (!buffer) {
            return new NextResponse("PlanetoidMetadata not found", { status: 404 });
        }
        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/octet-stream',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=86400'
            }
        });
    } catch (err: any) {
        console.error("Error in PlanetoidMetadata proxy:", err);
        return new NextResponse(err.message || "Internal Server Error", { status: 500 });
    }
}
