import { NextRequest, NextResponse } from 'next/server';
import { GetURL } from '@/lib/earth3d/utils/GetURL';

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ slug: string[] }> }
) {
    const params = await props.params;
    const { slug } = params;
    if (!slug || slug.length === 0) {
        return new NextResponse("Invalid request parameters", { status: 400 });
    }

    try {
        const pbParam = slug.join('/');
        const targetUrl = `https://kh.google.com/rt/earth/NodeData/${pbParam}`;
        
        const buffer = await GetURL(targetUrl);
        if (!buffer) {
            return new NextResponse("NodeData not found", { status: 404 });
        }

        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/octet-stream',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=31536000, immutable'
            }
        });
    } catch (err: any) {
        console.error("Error in NodeData proxy:", err);
        return new NextResponse(err.message || "Internal Server Error", { status: 500 });
    }
}
