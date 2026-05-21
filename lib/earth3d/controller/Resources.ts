import Pbf from "pbf";
import { BulkMetadata, IPlanetoidMetadata, PlanetoidMetadata, NodeData as ProtoNodeData } from "../proto/rocktree";
import { GetURL } from "../utils/GetURL";
import { LRUMap } from 'lru_map';
import { BulkData } from "../bulk/BulkData";
import { NodeData } from "../node/NodeData";
import { NodeHeader } from "../node/NodeHeader";

enum ResourceState {
    PENDING,
    SUCCESS,
    FAILED
}

interface ResourceRequest<T> {
    status: ResourceState;
    data: T | null;
}

export class Resources {
    private urlPrefix: string;
    public bulkCache: LRUMap<string, ResourceRequest<BulkData>>;
    public nodeCache: LRUMap<string, ResourceRequest<NodeData>>;

    constructor(urlPrefix: string) {
        this.urlPrefix = urlPrefix;
        this.bulkCache = new LRUMap(200);
        this.nodeCache = new LRUMap(500);
    }

    public async request_planetoid_metadata(): Promise<IPlanetoidMetadata | null> {
        const url = this.urlPrefix + "PlanetoidMetadata";
    
        try {
            const buffer = await GetURL(url);
            if (!buffer) return null;
            const protodata = new Uint8Array(buffer);
            const pbf = new Pbf(protodata);
            const metadata = PlanetoidMetadata.read(pbf);
            return metadata;
        } catch (error) {
            console.error("Failed to fetch planetoid metadata:", error);
            return null;
        }
    }

    public async request_bulk_data(path: string, epoch: number): Promise<BulkData | null> {
        const url = this.urlPrefix + `BulkMetadata/pb=!1m2!1s${path}!2u${epoch}`;

        try {
            const buffer = await GetURL(url);
            if (!buffer) return null;
            const protodata = new Uint8Array(buffer);
            const pbf = new Pbf(protodata);
            const metadata = BulkMetadata.read(pbf);
            const bulk = new BulkData(metadata);
            return bulk;
        } catch (error) {
            console.error(`Failed to fetch bulk data for path=${path} epoch=${epoch}:`, error);
            return null;
        }
    }

    public async request_node_data(node_header: NodeHeader): Promise<NodeData | null> {
        let url = this.urlPrefix + `NodeData/pb=!1m2!1s${node_header.path}!2u${node_header.epoch}!2e${node_header.texture_format}!4b0`;

        if (node_header.imagery_epoch != 0) {
            url = this.urlPrefix + `NodeData/pb=!1m2!1s${node_header.path}!2u${node_header.epoch}!2e${node_header.texture_format}!3u${node_header.imagery_epoch}!4b0`;
        }

        try {
            const buffer = await GetURL(url);
            if (!buffer) return null;
            const protodata = new Uint8Array(buffer);
            const pbf = new Pbf(protodata);
            const metadata = ProtoNodeData.read(pbf);
            const node = new NodeData(node_header, metadata);
            return node;
        } catch (error) {
            console.error(`Failed to fetch node data for path=${node_header.path}:`, error);
            return null;
        }
    }

    public get_or_fetch_cached_bulk(path: string, epoch: number): BulkData | false {
        const cachedBulk = this.bulkCache.get(path);

        if (!cachedBulk) {
            this.bulkCache.set(path, {status: ResourceState.PENDING, data: null});

            this.request_bulk_data(path, epoch)
                .then(bulk => {
                    if (bulk !== null) {
                        this.bulkCache.set(path, {status: ResourceState.SUCCESS, data: bulk});
                    }
                    else {
                        this.bulkCache.set(path, {status: ResourceState.FAILED, data: null});
                    }
                })
                .catch(() => {
                    this.bulkCache.set(path, {status: ResourceState.FAILED, data: null});
                });
            return false;
        }

        if (cachedBulk.status == ResourceState.SUCCESS) return cachedBulk.data as BulkData;

        return false;
    }

    public get_or_fetch_cached_node(nodeHeader: NodeHeader): NodeData | false {
        const cachedNode = this.nodeCache.get(nodeHeader.path);

        if (!cachedNode) {
            this.nodeCache.set(nodeHeader.path, {status: ResourceState.PENDING, data: null});

            this.request_node_data(nodeHeader)
                .then(node => {
                    if (node !== null) {
                        this.nodeCache.set(nodeHeader.path, {status: ResourceState.SUCCESS, data: node});
                    }
                    else {
                        this.nodeCache.set(nodeHeader.path, {status: ResourceState.FAILED, data: null});
                    }
                })
                .catch(() => {
                    this.nodeCache.set(nodeHeader.path, {status: ResourceState.FAILED, data: null});
                });
            return false;
        }

        if (cachedNode.status == ResourceState.SUCCESS) return cachedNode.data as NodeData;

        return false;
    }
}
