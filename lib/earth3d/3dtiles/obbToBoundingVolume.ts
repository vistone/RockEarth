import { OBB } from '../node/decoder/NodeOBB';

/**
 * Convert Google Earth OBB to 3D Tiles boundingVolume.box format.
 * box: [centerX, centerY, centerZ, halfXx, halfXy, halfXz, halfYx, halfYy, halfYz, halfZx, halfZy, halfZz]
 */
export function obbToBoundingVolumeBox(obb: OBB): number[] {
    const { center, extents, orientation } = obb;
    const e = orientation.elements;

    return [
        center.x, center.y, center.z,
        e[0] * extents.x, e[1] * extents.x, e[2] * extents.x,
        e[3] * extents.y, e[4] * extents.y, e[5] * extents.y,
        e[6] * extents.z, e[7] * extents.z, e[8] * extents.z,
    ];
}
