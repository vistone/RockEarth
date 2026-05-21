export class BufferGeometryUtils {

    /**
     * Converts a triangle strip index buffer to a triangle list index buffer.
     *
     * Google Earth uses triangle strips where degenerate triangles (triangles
     * with two or more identical vertex indices) act as separators between
     * separate strip segments. These degenerate triangles must be skipped,
     * otherwise they produce holes ("洞洞") in the rendered mesh.
     */
    static toTriangleStripDrawMode(indexes: Uint16Array): Uint16Array {
        const numberOfPotentialTriangles = indexes.length - 2;

        // First pass: count valid (non-degenerate) triangles
        let validCount = 0;
        for (let i = 0; i < numberOfPotentialTriangles; i++) {
            const a = indexes[i];
            const b = indexes[i + 1];
            const c = indexes[i + 2];
            if (a !== b && b !== c && a !== c) {
                validCount++;
            }
        }

        // Second pass: fill output with only valid triangles, applying strip winding
        const newIndices = new Uint16Array(validCount * 3);
        let j = 0;
        for (let i = 0; i < numberOfPotentialTriangles; i++) {
            const a = indexes[i];
            const b = indexes[i + 1];
            const c = indexes[i + 2];
            if (a === b || b === c || a === c) {
                // Skip degenerate triangle (strip separator)
                continue;
            }

            if (i % 2 === 0) {
                newIndices[j]     = a;
                newIndices[j + 1] = b;
                newIndices[j + 2] = c;
            } else {
                // Odd strips reverse winding to maintain consistent face normals
                newIndices[j]     = c;
                newIndices[j + 1] = b;
                newIndices[j + 2] = a;
            }
            j += 3;
        }

        return newIndices;
    }
}