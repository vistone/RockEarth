import { PNG } from 'pngjs';
import { BulkData } from '../bulk/BulkData';
import { NodeData } from '../node/NodeData';
import { NodeHeader } from '../node/NodeHeader';
import { obbToBoundingVolumeBox } from './obbToBoundingVolume';

const EARTH_ROOT_BOX = [
    0, 0, 0,
    7645212, 0, 0,
    0, 7645212, 0,
    0, 0, 7645212
];

function createTileFromNode(nodeHeader: NodeHeader): any {
    const tile: any = {
        boundingVolume: {
            box: obbToBoundingVolumeBox(nodeHeader.obb),
        },
        geometricError: nodeHeader.meters_per_texel * 100,
        refine: "REPLACE",
    };

    if (nodeHeader.can_have_data) {
        tile.content = {
            uri: `/api/earth/tiles/${nodeHeader.path}/${nodeHeader.epoch}/${nodeHeader.texture_format}/${nodeHeader.imagery_epoch}.glb`,
        };
    }

    return tile;
}

/**
 * Builds the 4-level subtree recursively.
 */
function buildSubtree(bulk: BulkData, currentPath: string, rootPath: string): any {
    const nodeHeader = bulk.nodes.get(currentPath);
    if (!nodeHeader) {
        return null;
    }

    const isLeaf = !!(nodeHeader.flags & 4) || !!(nodeHeader.flags & 1);
    const relativeLevel = currentPath.length - rootPath.length; // 1, 2, 3, 4

    const tile: any = createTileFromNode(nodeHeader);

    if (isLeaf) {
        return tile;
    }

    if (relativeLevel < 4) {
        const children: any[] = [];
        const octants = ['0', '1', '2', '3', '4', '5', '6', '7'];
        for (const o of octants) {
            const childTile = buildSubtree(bulk, currentPath + o, rootPath);
            if (childTile) {
                children.push(childTile);
            }
        }
        if (children.length > 0) {
            tile.children = children;
        }
    } else {
        // relativeLevel === 4. Point to the NEXT external tileset JSON!
        const nextBulkHeader = bulk.bulks.get(currentPath);
        if (!nextBulkHeader) {
            return tile;
        }
        tile.children = [{
            boundingVolume: {
                box: obbToBoundingVolumeBox(nodeHeader.obb),
            },
            geometricError: nodeHeader.meters_per_texel * 100,
            refine: "REPLACE",
            content: {
                uri: `/api/earth/tiles/${currentPath}/${nextBulkHeader.epoch}.json`,
            }
        }];
    }

    return tile;
}

/**
 * Convert dynamic BulkData to standard 3D Tiles JSON structure.
 */
export function bulkToTileset(bulk: BulkData, rootPath: string, rootEpoch: number): any {
    const children: any[] = [];
    const octants = ['0', '1', '2', '3', '4', '5', '6', '7'];

    for (const o of octants) {
        const childPath = rootPath + o;
        const childTile = buildSubtree(bulk, childPath, rootPath);
        if (childTile) {
            children.push(childTile);
        }
    }

    const rootNode = bulk.nodes.get(rootPath);
    const rootGeometricError = rootPath === "" ? 1e100 : (rootNode?.meters_per_texel ?? 1) * 100;
    const rootBoundingVolume = rootPath === "" ? { box: EARTH_ROOT_BOX } : {
        box: obbToBoundingVolumeBox(rootNode?.obb ?? { center: {x:0,y:0,z:0}, extents: {x:0,y:0,z:0}, orientation: {elements: [1,0,0,0,1,0,0,0,1]} })
    };

    const rootTile: any = rootNode ? createTileFromNode(rootNode) : {
        boundingVolume: rootBoundingVolume,
        geometricError: rootGeometricError,
        refine: "REPLACE",
    };

    if (!rootNode) {
        // If the child bulk metadata does not contain the current root node header,
        // keep the parent node parameters available through the computed root volume and error.
        rootTile.boundingVolume = rootBoundingVolume;
        rootTile.geometricError = rootGeometricError;
    }

    if (rootPath === "") {
        rootTile.children = [{
            boundingVolume: rootBoundingVolume,
            geometricError: rootGeometricError,
            refine: "REPLACE",
            children: children
        }];
    } else if (children.length > 0) {
        rootTile.children = children;
    }

    return {
        asset: {
            version: "1.0"
        },
        geometricError: rootGeometricError,
        root: rootTile
    };
}

/**
 * Convert decoded NodeData into standard glTF 2.0 Binary (GLB) file buffer.
 */
export function nodeToGLB(nodeData: NodeData): Buffer | null {
    if (!nodeData.data.meshes || nodeData.data.meshes.length === 0) {
        return null;
    }

    const binParts: Uint8Array[] = [];
    let byteLength = 0;

    function addPart(view: ArrayBufferView | Uint8Array) {
        let u8: Uint8Array;
        if (view instanceof Uint8Array) {
            u8 = view;
        } else {
            u8 = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
        }
        binParts.push(u8);
        const offset = byteLength;
        byteLength += u8.byteLength;

        // pad to 4 bytes boundary
        const padding = (4 - (u8.byteLength % 4)) % 4;
        if (padding > 0) {
            const padU8 = new Uint8Array(padding);
            binParts.push(padU8);
            byteLength += padding;
        }
        return { offset, length: u8.byteLength };
    }

    const gltf: any = {
        asset: {
            version: "2.0",
            generator: "RockEarth GLB Converter"
        },
        scenes: [{
            nodes: [0]
        }],
        nodes: [] as any[],
        meshes: [] as any[],
        materials: [] as any[],
        textures: [] as any[],
        images: [] as any[],
        samplers: [{
            magFilter: 9729,
            minFilter: 9987,
            wrapS: 10497,
            wrapT: 10497
        }],
        buffers: [{
            byteLength: 0
        }],
        bufferViews: [] as any[],
        accessors: [] as any[]
    };

    const matrixValues = nodeData.data.matrix_globe_from_mesh ?? [];
    let matrix: number[] | undefined;
    if (matrixValues.length === 16) {
        matrix = [...matrixValues];
    }

    gltf.nodes.push({
        mesh: 0,
        matrix: matrix
    });

    gltf.meshes.push({
        primitives: [] as any[]
    });

    for (let mIdx = 0; mIdx < nodeData.data.meshes.length; mIdx++) {
        const meshe = nodeData.data.meshes[mIdx];
        if (!meshe.vertices || !meshe.indices) continue;

        const vertexCount = meshe.vertices.length / 3;
        const indexCount = meshe.indices.length;

        // 1. Positions Accessor
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        const floatVertices = new Float32Array(meshe.vertices.length);
        for (let i = 0; i < meshe.vertices.length; i += 3) {
            const x = meshe.vertices[i];
            const y = meshe.vertices[i + 1];
            const z = meshe.vertices[i + 2];
            
            floatVertices[i] = x;
            floatVertices[i + 1] = y;
            floatVertices[i + 2] = z;

            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
        }

        const posPart = addPart(floatVertices);
        const posViewIdx = gltf.bufferViews.length;
        gltf.bufferViews.push({
            buffer: 0,
            byteOffset: posPart.offset,
            byteLength: posPart.length,
            target: 34962 // ARRAY_BUFFER
        });

        const posAccessorIdx = gltf.accessors.length;
        gltf.accessors.push({
            bufferView: posViewIdx,
            componentType: 5126, // FLOAT
            count: vertexCount,
            type: "VEC3",
            min: [minX, minY, minZ],
            max: [maxX, maxY, maxZ]
        });

        // 2. UVs Accessor
        // Decode and normalize UV coordinates to standard Float32Array [0, 1]
        const stdUvs = new Float32Array(vertexCount * 2);
        const uv_offset = meshe.uv_offset ?? { x: 0.5, y: 0.5 };
        const uv_scale = meshe.uv_scale ?? { x: 1.0, y: 1.0 };
        const rawUvs = meshe.vertices_uvs;
        if (rawUvs) {
            for (let i = 0; i < vertexCount; i++) {
                const uRaw = rawUvs[i * 2];
                const vRaw = rawUvs[i * 2 + 1];
                stdUvs[i * 2] = (uRaw + uv_offset.x) * uv_scale.x;
                stdUvs[i * 2 + 1] = (vRaw + uv_offset.y) * uv_scale.y;
            }
        }

        const uvPart = addPart(stdUvs);
        const uvViewIdx = gltf.bufferViews.length;
        gltf.bufferViews.push({
            buffer: 0,
            byteOffset: uvPart.offset,
            byteLength: uvPart.length,
            target: 34962 // ARRAY_BUFFER
        });

        const uvAccessorIdx = gltf.accessors.length;
        gltf.accessors.push({
            bufferView: uvViewIdx,
            componentType: 5126, // FLOAT
            count: vertexCount,
            type: "VEC2"
        });

        // 3. Indices Accessor
        const idxPart = addPart(meshe.indices);
        const idxViewIdx = gltf.bufferViews.length;
        gltf.bufferViews.push({
            buffer: 0,
            byteOffset: idxPart.offset,
            byteLength: idxPart.length,
            target: 34963 // ELEMENT_ARRAY_BUFFER
        });

        const idxAccessorIdx = gltf.accessors.length;
        gltf.accessors.push({
            bufferView: idxViewIdx,
            componentType: 5123, // UNSIGNED_SHORT
            count: indexCount,
            type: "SCALAR"
        });

        // 4. Image/Texture
        const texture = meshe.texture?.[0];
        if (!texture) continue;

        let imgBuffer: Buffer;
        let isPng = false;

        if (texture.format === 1) { // JPEG
            imgBuffer = Buffer.from(texture.data[0]);
        } else if (texture.format === 6) { // DXT decodes into RGB565 Uint16Array
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
            // Use pngjs to encode to a PNG buffer
            const png = new PNG({ width: texture.width, height: texture.height });
            png.data = Buffer.from(rgba);
            imgBuffer = PNG.sync.write(png);
            isPng = true;
        } else {
            continue;
        }

        const imgPart = addPart(imgBuffer);
        const imgViewIdx = gltf.bufferViews.length;
        gltf.bufferViews.push({
            buffer: 0,
            byteOffset: imgPart.offset,
            byteLength: imgPart.length
        });

        const imgIdx = gltf.images.length;
        gltf.images.push({
            bufferView: imgViewIdx,
            mimeType: isPng ? "image/png" : "image/jpeg"
        });

        const texIdx = gltf.textures.length;
        gltf.textures.push({
            source: imgIdx,
            sampler: 0
        });

        const matIdx = gltf.materials.length;
        gltf.materials.push({
            pbrMetallicRoughness: {
                baseColorTexture: {
                    index: texIdx
                },
                metallicFactor: 0.0,
                roughnessFactor: 1.0
            },
            doubleSided: true
        });

        gltf.meshes[0].primitives.push({
            attributes: {
                POSITION: posAccessorIdx,
                TEXCOORD_0: uvAccessorIdx
            },
            indices: idxAccessorIdx,
            material: matIdx,
            mode: 4 // TRIANGLES
        });
    }

    gltf.buffers[0].byteLength = byteLength;

    // Serialize JSON chunk
    const jsonStr = JSON.stringify(gltf);
    let jsonBuffer = Buffer.from(jsonStr, 'utf-8');
    const jsonPadding = (4 - (jsonBuffer.byteLength % 4)) % 4;
    if (jsonPadding > 0) {
        jsonBuffer = Buffer.concat([jsonBuffer, Buffer.alloc(jsonPadding, 0x20)]);
    }

    // Binary chunk
    const totalBinBuffer = Buffer.concat(binParts);

    // Final glb size
    const totalLength = 12 + 8 + jsonBuffer.byteLength + 8 + totalBinBuffer.byteLength;
    const glbBuffer = Buffer.alloc(totalLength);
    let offset = 0;

    // 12-byte header
    glbBuffer.writeUInt32LE(0x46546C67, offset); offset += 4;
    glbBuffer.writeUInt32LE(2, offset); offset += 4;
    glbBuffer.writeUInt32LE(totalLength, offset); offset += 4;

    // JSON Chunk Header + Content
    glbBuffer.writeUInt32LE(jsonBuffer.byteLength, offset); offset += 4;
    glbBuffer.writeUInt32LE(0x4E4F534A, offset); offset += 4;
    jsonBuffer.copy(glbBuffer, offset); offset += jsonBuffer.byteLength;

    // BIN Chunk Header + Content
    glbBuffer.writeUInt32LE(totalBinBuffer.byteLength, offset); offset += 4;
    glbBuffer.writeUInt32LE(0x004E4942, offset); offset += 4;
    totalBinBuffer.copy(glbBuffer, offset);

    return glbBuffer;
}
