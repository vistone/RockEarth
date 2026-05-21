import Pbf from 'pbf';
import * as THREE from 'three';
import { PlanetoidMetadata, BulkMetadata, NodeData as ProtoNodeData } from '../proto/rocktree';
import { GetURL } from '../utils/GetURL';
import { BulkData } from '../bulk/BulkData';
import { NodeHeader } from '../node/NodeHeader';
import { NodeData } from '../node/NodeData';
import { NodeState } from '../node/NodeState';
import { obbToBoundingVolumeBox } from './obbToBoundingVolume';

const vertexShader = `
uniform vec2 uv_offset;
uniform vec2 uv_scale;
uniform bool octant_mask[8];
attribute float octant;	
attribute vec2 texcoords;		
varying vec2 v_texcoords;

void main() {
    float mask = octant_mask[int(octant)] ? 0.0 : 1.0;
    v_texcoords = (texcoords + uv_offset) * uv_scale * mask;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ) * mask;
}
`;

const fragmentShader = `
#ifdef GL_ES
    precision mediump float;
#endif
uniform sampler2D textureMap;
varying vec2 v_texcoords;
void main() {
    gl_FragColor = vec4(texture2D(textureMap, v_texcoords).rgb, 1.0);
}
`;

interface GoogleEarthTilesetPluginOptions {
    urlPrefix?: string;
    epoch?: number;
}

export class GoogleEarthTilesetPlugin {
    public name = 'GOOGLE_EARTH_TILESET_PLUGIN';
    public urlPrefix: string;
    public epoch: number | null = null;
    public planetoid: any = null;
    public rootEpoch: number = 0;

    constructor(options: GoogleEarthTilesetPluginOptions = {}) {
        this.urlPrefix = options.urlPrefix || '/api/earth/';
        if (options.epoch) {
            this.epoch = options.epoch;
            this.rootEpoch = options.epoch;
        }
    }

    async fetchData(uri: string, fetchOptions: any) {
        if (!uri.startsWith('google-earth://')) {
            return null;
        }

        const parts = uri.replace('google-earth://', '').split('/');
        const type = parts[0];
        const path = parts[1] || '';
        const epoch = parseInt(parts[2]);

        if (type === 'root') {
            const buffer = await GetURL(this.urlPrefix + 'PlanetoidMetadata');
            if (!buffer) return null;

            const pbf = new Pbf(new Uint8Array(buffer));
            this.planetoid = PlanetoidMetadata.read(pbf);
            this.rootEpoch = this.epoch ?? this.planetoid.root_node_metadata?.epoch ?? 0;
            console.log('[GoogleEarth] PlanetoidMetadata loaded, rootEpoch:', this.rootEpoch, 'root_node_metadata:', this.planetoid.root_node_metadata);

            return {
                asset: { version: '1.0' },
                root: {
                    boundingVolume: {
                        region: [-Math.PI, -Math.PI / 2, Math.PI, Math.PI / 2, 0, 10000000],
                    },
                    geometricError: 10000000,
                    content: {
                        uri: `google-earth://bulk//${this.rootEpoch}`,
                    },
                },
            };
        }

        if (type === 'bulk') {
            const url = this.urlPrefix + `BulkMetadata/pb=!1m2!1s${path}!2u${epoch}`;
            try {
                return await GetURL(url);
            } catch {
                return null;
            }
        } else if (type === 'node') {
            const textureFormat = parseInt(parts[3]);
            const imageryEpoch = parseInt(parts[4]);
            let url = this.urlPrefix + `NodeData/pb=!1m2!1s${path}!2u${epoch}!2e${textureFormat}!4b0`;
            if (imageryEpoch !== 0) {
                url = this.urlPrefix + `NodeData/pb=!1m2!1s${path}!2u${epoch}!2e${textureFormat}!3u${imageryEpoch}!4b0`;
            }
            try {
                return await GetURL(url);
            } catch {
                return null;
            }
        }

        return null;
    }

    async parseToMesh(buffer: ArrayBuffer, tile: any, extension: string, uri: string, abortSignal: AbortSignal): Promise<THREE.Group | null> {
        if (!uri.startsWith('google-earth://')) {
            return null;
        }

        const parts = uri.replace('google-earth://', '').split('/');
        const type = parts[0];
        const path = parts[1] || '';
        const epoch = parseInt(parts[2]);

        if (type === 'bulk') {
            return this.parseBulk(buffer, tile, path, epoch);
        } else if (type === 'node') {
            const textureFormat = parseInt(parts[3]);
            const imageryEpoch = parseInt(parts[4]);
            return this.parseNode(buffer, tile, path, epoch, textureFormat, imageryEpoch);
        }

        return null;
    }

    private async parseBulk(buffer: ArrayBuffer, tile: any, path: string, epoch: number): Promise<THREE.Group> {
        const pbf = new Pbf(new Uint8Array(buffer));
        const metadata = BulkMetadata.read(pbf);
        const bulk = new BulkData(metadata);

        console.log('[parseBulk] path=', path, 'epoch=', epoch, 'node_metadata.length=', metadata.node_metadata?.length, 'nodes.keys=', Array.from(bulk.nodes.keys()));

        const children: any[] = [];
        const octants = ['0', '1', '2', '3', '4', '5', '6', '7'];

        for (const o of octants) {
            const childPath = path + o;
            const childTile = this.buildSubtree(bulk, childPath, path);
            if (childTile) {
                children.push(childTile);
            }
        }

        tile.children = children;

        // Return empty group - this tile is just a container for children
        const group = new THREE.Group();
        group.name = `bulk_${path}`;
        return group;
    }

    private buildSubtree(bulk: BulkData, currentPath: string, rootPath: string): any {
        const nodeHeader = bulk.nodes.get(currentPath);
        if (!nodeHeader) {
            return null;
        }

        const isLeaf = !!(nodeHeader.flags & 4) || !!(nodeHeader.flags & 1);
        const relativeLevel = currentPath.length - rootPath.length; // 1, 2, 3, 4

        const tile: any = {
            boundingVolume: {
                box: obbToBoundingVolumeBox(nodeHeader.obb),
            },
            geometricError: nodeHeader.meters_per_texel * 100,
        };

        if (nodeHeader.can_have_data) {
            tile.content = {
                uri: `google-earth://node/${currentPath}/${nodeHeader.epoch}/${nodeHeader.texture_format}/${nodeHeader.imagery_epoch}`,
            };
        }

        if (isLeaf) {
            return tile;
        }

        if (relativeLevel < 4) {
            // Children are within the SAME bulk metadata!
            const children: any[] = [];
            const octants = ['0', '1', '2', '3', '4', '5', '6', '7'];
            for (const o of octants) {
                const childTile = this.buildSubtree(bulk, currentPath + o, rootPath);
                if (childTile) {
                    children.push(childTile);
                }
            }
            if (children.length > 0) {
                tile.children = children;
            }
        } else {
            // relativeLevel === 4. Children are in the NEXT bulk metadata chunk!
            if (!bulk.bulks.has(currentPath)) {
                // No next bulk metadata exists for this node; it is a leaf.
                return tile;
            }
            tile.children = [{
                boundingVolume: {
                    box: obbToBoundingVolumeBox(nodeHeader.obb),
                },
                geometricError: nodeHeader.meters_per_texel * 100,
                content: {
                    uri: `google-earth://bulk/${currentPath}/${nodeHeader.epoch}`,
                }
            }];
        }

        return tile;
    }

    private async parseNode(
        buffer: ArrayBuffer,
        tile: any,
        path: string,
        epoch: number,
        textureFormat: number,
        imageryEpoch: number
    ): Promise<THREE.Group | null> {
        // Reconstruct a NodeHeader for decoding
        // We need parent bulk info, but we don't have it here.
        // Instead, we'll parse the raw protobuf and create NodeData directly
        // This is a simplified approach - ideally we'd cache NodeHeaders from the parent bulk

        const pbf = new Pbf(new Uint8Array(buffer));
        const protoNodeData = ProtoNodeData.read(pbf);

        // Create a minimal NodeHeader-like object for NodeData constructor
        const fakeNodeHeader = {
            path_and_flags: { path, level: path.length, flags: 0 },
            parent_bulk: path.substring(0, Math.max(0, path.length - 1)),
            path,
            flags: 0,
            level: path.length,
            is_bulk: false,
            can_have_data: true,
            state: NodeState.PENDING,
            meters_per_texel: 1,
            texture_format: textureFormat,
            imagery_epoch: imageryEpoch,
            epoch,
            obb: { center: { x: 0, y: 0, z: 0 }, extents: { x: 0, y: 0, z: 0 }, orientation: { elements: [1, 0, 0, 0, 1, 0, 0, 0, 1] } },
            latLonBox: { n: 0, s: 0, w: 0, e: 0 },
        } as any;

        const nodeData = new NodeData(fakeNodeHeader, protoNodeData);
        if (nodeData.state !== NodeState.DECODED || !nodeData.data.meshes) {
            return null;
        }

        const group = new THREE.Group();
        group.name = `node_${path}`;

        for (const meshe of nodeData.data.meshes ?? []) {
            if (!meshe.indices || !meshe.vertices || !meshe.octants || !meshe.vertices_uvs) continue;

            const geometry = new THREE.BufferGeometry();
            geometry.setIndex(new THREE.Uint16BufferAttribute(meshe.indices, 1));
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(meshe.vertices, 3));
            geometry.setAttribute('octant', new THREE.Float32BufferAttribute(meshe.octants, 1));
            geometry.setAttribute('texcoords', new THREE.Float32BufferAttribute(meshe.vertices_uvs, 2));

            const texture = meshe.texture?.[0];
            if (!texture) continue;

            let texture_map: THREE.Texture;
            if (texture.format == 1) { // JPG
                const blob = new Blob([texture.data[0]]);
                const url = URL.createObjectURL(blob);
                texture_map = new THREE.TextureLoader().load(url);
            } else if (texture.format == 6) { // DXT
                const rgb565 = texture.data[0] as Uint16Array;
                const rgba = new Uint8Array(texture.width * texture.height * 4);
                for (let i = 0; i < rgb565.length; i++) {
                    const val = rgb565[i];
                    const r5 = val & 0x1f;
                    const g6 = (val & 0x7e0) >> 5;
                    const b5 = (val & 0xf800) >> 11;
                    rgba[i * 4 + 0] = Math.round((r5 * 255) / 31);
                    rgba[i * 4 + 1] = Math.round((g6 * 255) / 63);
                    rgba[i * 4 + 2] = Math.round((b5 * 255) / 31);
                    rgba[i * 4 + 3] = 255;
                }
                texture_map = new THREE.DataTexture(
                    rgba,
                    texture.width,
                    texture.height,
                    THREE.RGBAFormat,
                    THREE.UnsignedByteType
                );
                texture_map.needsUpdate = true;
            } else {
                continue;
            }

            const matrixValues = nodeData.data.matrix_globe_from_mesh ?? [];
            if (matrixValues.length < 16) continue;

            const matrix_globe_from_mesh = new THREE.Matrix4().set(
                matrixValues[0], matrixValues[1], matrixValues[2], matrixValues[3],
                matrixValues[4], matrixValues[5], matrixValues[6], matrixValues[7],
                matrixValues[8], matrixValues[9], matrixValues[10], matrixValues[11],
                matrixValues[12], matrixValues[13], matrixValues[14], matrixValues[15]
            ).transpose();

            const material = new THREE.ShaderMaterial({
                uniforms: {
                    textureMap: { value: texture_map },
                    uv_offset: { value: meshe.uv_offset },
                    uv_scale: { value: meshe.uv_scale },
                    octant_mask: { value: [0, 0, 0, 0, 0, 0, 0, 0] },
                },
                vertexShader,
                fragmentShader,
            });

            const mesh = new THREE.Mesh(geometry, material);
            const position = new THREE.Vector3();
            const quaternion = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            matrix_globe_from_mesh.decompose(position, quaternion, scale);
            mesh.position.copy(position);
            mesh.quaternion.copy(quaternion);
            mesh.scale.copy(scale);

            group.add(mesh);
        }

        return group;
    }
}
