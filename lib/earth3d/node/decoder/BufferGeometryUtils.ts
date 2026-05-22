export class BufferGeometryUtils {

    /**
     * Converts a triangle strip index buffer to a triangle list index buffer.
     *
     * Google Earth uses triangle strips where degenerate triangles (triangles
     * with two or more identical vertex indices) act as separators between
     * separate strip segments. We preserve them in the output because they
     * maintain the correct winding parity across the strip; GPU rasterization
     * automatically drops zero-area degenerate triangles without producing
     * visual artefacts.
     */
    static toTriangleStripDrawMode(indexes: Uint16Array): Uint16Array {
        const numberOfTriangles = indexes.length - 2;
        const newIndices = new Uint16Array(numberOfTriangles * 3);

        for (let i = 0, j = 0; i < numberOfTriangles; i++, j += 3) {
            if (i % 2 === 0) {
                newIndices[j] = indexes[i];
                newIndices[j + 1] = indexes[i + 1];
                newIndices[j + 2] = indexes[i + 2];
            } else {
                // Odd strips reverse winding to maintain consistent face normals
                newIndices[j] = indexes[i + 2];
                newIndices[j + 1] = indexes[i + 1];
                newIndices[j + 2] = indexes[i];
            }
        }

        return newIndices;
    }
}
