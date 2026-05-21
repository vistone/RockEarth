import { NextResponse } from 'next/server';
import { globalResources } from '@/lib/earth3d/3dtiles/serverResources';

export async function GET() {
    try {
        const path = "20527061";
        const epoch = 1005;
        const bulk = await globalResources.request_bulk_data(path, epoch);
        if (!bulk) {
            return NextResponse.json({ error: "Failed to load bulk data" }, { status: 500 });
        }

        const bulksList = [];
        for (const [key, header] of bulk.bulks.entries()) {
            bulksList.push({
                key,
                path: header.path,
                epoch: header.epoch,
                flags: header.flags,
                level: header.level,
                is_bulk: header.is_bulk,
                can_have_data: header.can_have_data
            });
        }

        return NextResponse.json({
            head_node_key: bulk.head_node_key,
            total_bulks: bulk.bulks.size,
            total_nodes: bulk.nodes.size,
            bulks: bulksList
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
