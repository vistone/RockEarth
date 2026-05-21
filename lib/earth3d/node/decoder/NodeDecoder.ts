import { INodeData } from '../../proto/rocktree';
import { BufferGeometryUtils } from './BufferGeometryUtils';
import { MeshDecoder } from './MeshDecoder';
import { TextureDecoder } from './TextureDecoder';

export interface DecodedIMesh {
    vertices_uvs?: Uint16Array;
    uv_offset?: {x: number, y: number};
    uv_scale?: {x: number, y: number};
    octants?: Uint8Array;
    indices?: Uint16Array;
    vertices?: Uint8Array;
    texture?: any;
}

export interface DecodedNode {
    meshes?: DecodedIMesh[];
    matrix_globe_from_mesh?: number[];
}

export class NodeDecoder {
    public static unpackPathAndFlags(path_id: number) {
        let level = 1 + (path_id & 3);
        path_id >>= 2;
        let path = "";

        for (let i = 0; i < level; i++) {
            path += parseInt('0') + (path_id & 7);
            path_id >>= 3;
        }
        let flags = path_id;

        return {
            path: path,
            level: level,
            flags: flags
        }
    }

    public static Decode(node_data: INodeData): DecodedNode {
        const node: DecodedNode = {};
        node.meshes = [];
        
        node.matrix_globe_from_mesh = node_data.matrix_globe_from_mesh ?? undefined;

        for (const mesh of node_data.meshes ?? []) {
            if (!mesh.indices || !mesh.vertices || !mesh.layer_and_octant_counts || !mesh.texture || !mesh.texture_coordinates) {
                console.warn("Skipping mesh with missing required fields");
                continue;
            }

            let indices = MeshDecoder.unpackIndices(mesh.indices);
            const vertices = MeshDecoder.unpackVertices(mesh.vertices);

            let octants = MeshDecoder.unpackOctants(mesh.layer_and_octant_counts, indices, vertices.length / 3);
            let {uv_offset, uv_scale} = TextureDecoder.unpackUvOffsetAndScale(mesh.texture[0], mesh.uv_offset_and_scale ?? []);
            let uvs = TextureDecoder.unpackTexCoords(mesh.texture_coordinates, mesh.texture[0], vertices.length / 3);

            let layer_bounds = MeshDecoder.unpackLayerBounds(mesh.layer_and_octant_counts);
            indices = indices.slice(0, layer_bounds[3]);

            // 6 == CRN_DXT
            const firstTexture = mesh.texture[0];
            if (!firstTexture.data || firstTexture.data.length === 0) {
                console.warn("Skipping mesh with missing texture data");
                continue;
            }

            const textureData = firstTexture.format == 6 
                ? TextureDecoder.unpackCRN(firstTexture.data[0], firstTexture.width ?? 0, firstTexture.height ?? 0) 
                : firstTexture.data[0];

            let texture =
            [{
                data: [textureData],
                format: firstTexture.format,
                width: firstTexture.width,
                height: firstTexture.height,
            }]

            // Convert indices to stripDrawMode
            indices = BufferGeometryUtils.toTriangleStripDrawMode(indices);

            node.meshes.push({
                indices: indices,
                vertices: vertices,
                octants: octants,
                vertices_uvs: uvs,
                uv_scale: uv_scale,
                uv_offset: uv_offset,
                texture: texture
            })
        }
    
        return node;
    }
}
