import { NodeData } from "../node/NodeData";
import { IPlanetoidMetadata } from "../proto/rocktree";
import { Resources } from "./Resources";
import { NodeHeader } from "../node/NodeHeader";
import { BulkData } from "../bulk/BulkData";

/**
 * Node Manager options
 */
export interface NodeManagerOptions {
    /** url: URL used to get data from. */
    url?: string;
    /** nodeValidationHandler: Function responsible for the validation of new potential nodes. */
    nodeValidationHandler?: (node: NodeHeader) => boolean;
    /** rootEpoch: Set the epoch used when querying nodes. If not set the latest epoch from planetoid will be used. */
    rootEpoch?: number;
}

const NodeManagerOptionsDefault: Required<NodeManagerOptions> = {
    url: "/api/earth/",
    nodeValidationHandler: () => true,
    rootEpoch: 0,
}

export class NodeManager {
    private planetoid: IPlanetoidMetadata | null = null;
    private root_bulk: BulkData | null = null;
    private options: Required<NodeManagerOptions>;
    private resourceManager: Resources;
    private epoch: number = 0;
    private initialized: boolean = false;

    private readonly octants = ["0", "1", "2", "3", "4", "5", "6", "7"];

    constructor(options?: NodeManagerOptions) {
        this.options = { ...NodeManagerOptionsDefault, ...options };
        this.resourceManager = new Resources(this.options.url);

        this.resourceManager.request_planetoid_metadata()
            .then((planetoid_metadata) => {
                if (!planetoid_metadata) {
                    console.error("Failed to fetch planetoid metadata");
                    return;
                }
                this.planetoid = planetoid_metadata;
                this.epoch = this.options.rootEpoch ? this.options.rootEpoch : (planetoid_metadata.root_node_metadata?.epoch ?? 0);
                
                return this.resourceManager.request_bulk_data("", this.epoch);
            })
            .then(bulk => {
                if (bulk) {
                    this.root_bulk = bulk;
                    this.initialized = true;
                }
            })
            .catch(err => {
                console.error("NodeManager initialization failed:", err);
            });
    }

    public get_nodes(): Map<string, NodeData> {
        const potential_nodes = new Map<string, NodeData>();
        
        if (!this.root_bulk || !this.initialized) return potential_nodes;

        let next_valid = new Map<string, BulkData>();
        next_valid.set("", this.root_bulk);

        while (next_valid.size !== 0) {
            const entries = Array.from(next_valid.entries());
            next_valid.clear();

            for (const [current_bulk_path, current_bulk_raw] of entries) {
                let current_bulk = current_bulk_raw;

                if (current_bulk_path.length > 0 && current_bulk_path.length % 4 == 0) {
                    const potential_bulk_header = current_bulk.bulks.get(current_bulk_path);
                    
                    if (!potential_bulk_header) continue;
                    
                    const cachedBulk = this.resourceManager.get_or_fetch_cached_bulk(potential_bulk_header.path, potential_bulk_header.epoch);
                    if (!cachedBulk) continue;

                    current_bulk = cachedBulk;
                }

                for (const o of this.octants) {
                    const next_bulk_path = current_bulk_path + o;
                    const node = current_bulk.nodes.get(next_bulk_path);

                    if (!node) continue;

                    if (!this.options.nodeValidationHandler(node)) {
                        continue;
                    }

                    next_valid.set(next_bulk_path, current_bulk);

                    if (!node.can_have_data) continue;

                    const cachedNode = this.resourceManager.get_or_fetch_cached_node(node);
                    if (!cachedNode) continue;

                    potential_nodes.set(node.path, cachedNode);
                }
            }
        }

        return potential_nodes;
    }

    public getMasksForNodes(nodes: Map<string, NodeData>): Map<string, number> {
        const mask_map = new Map<string, number>();

        for (const [path] of nodes) {
            const level = path.length;
            const octant = parseInt(path[level - 1]);
            const prev = path.substring(0, level - 1);
        
            mask_map.set(prev, (mask_map.get(prev) ?? 0) | (1 << octant));
            if (!mask_map.has(path)) mask_map.set(path, 0);
        }

        return mask_map;
    }
}
