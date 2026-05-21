import { NodeState } from "./NodeState";
import { IBulkMetadata, INodeMetadata, NodeMetadata } from "../proto/rocktree";
import { NodeDecoder } from "./decoder/NodeDecoder";
import { NodeOBB, OBB } from "./decoder/NodeOBB";
import { TextureDecoder } from "./decoder/TextureDecoder";
import { LatLonBox, octant_to_latlong } from "./decoder/LatLonBox";

export class NodeHeader {
    public path: string;
    public flags: number;
    public level: number;
    public is_bulk: boolean;
    public obb: OBB;
    public latLonBox: LatLonBox;
    public can_have_data: boolean;

    public parent_bulk: string;

    public path_and_flags: { path: string; level: number; flags: number };
    public meters_per_texel: number;
    
    public texture_format: number;
    public imagery_epoch: number;
    public epoch: number;

    public state: NodeState;

    constructor(parent_bulk: IBulkMetadata, metadata: INodeMetadata) {
        const path_and_flags = NodeDecoder.unpackPathAndFlags(metadata.path_and_flags ?? 0);

        this.path_and_flags = path_and_flags;
        this.parent_bulk = parent_bulk.head_node_key?.path ?? "";
        this.path = this.parent_bulk + path_and_flags.path;
        this.flags = path_and_flags.flags;
        this.level = this.path.length;
        this.is_bulk = (this.level % 4 == 0) && (!(this.flags & 4));
        this.can_have_data = !(this.flags & (NodeMetadata.Flags.NODATA.value ?? 0));
        this.state = NodeState.PENDING;

        // Set meters per texel so it can be used for node validation
        this.meters_per_texel = metadata.meters_per_texel ? metadata.meters_per_texel : (parent_bulk.meters_per_texel?.[path_and_flags.level - 1] ?? 0);

        this.texture_format = TextureDecoder.unpackTextureFormat(metadata.available_texture_formats, parent_bulk.default_available_texture_formats ?? 0);
        this.imagery_epoch = TextureDecoder.unpackImageryEpoch(this.flags, metadata.imagery_epoch ?? 0, parent_bulk.default_imagery_epoch ?? 0);
        this.epoch = metadata.epoch ? metadata.epoch : (parent_bulk.head_node_key?.epoch ?? 0);

        if (metadata.oriented_bounding_box) {
            this.obb = NodeOBB.unpackObb(metadata.oriented_bounding_box, parent_bulk.head_node_center ?? [0,0,0], this.meters_per_texel);
            this.latLonBox = octant_to_latlong(this.path);
        } else {
            this.obb = { center: {x:0,y:0,z:0}, extents: {x:0,y:0,z:0}, orientation: {elements: [1,0,0,0,1,0,0,0,1]} };
            this.latLonBox = new LatLonBox(0,0,0,0);
        }
    }
}
