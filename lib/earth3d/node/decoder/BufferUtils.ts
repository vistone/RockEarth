export class BufferUtils {
    public static readUint16LE (buffer: ArrayBuffer | Uint8Array, offset: number) {
        offset = offset >>> 0;
        const view = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        return view[offset] | (view[offset + 1] << 8);
    }

    public static readInt16LE (buffer: ArrayBuffer | Uint8Array, offset: number) {
        offset = offset >>> 0;
        const view = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        const val = view[offset] | (view[offset + 1] << 8);
        return (val & 0x8000) ? val | 0xFFFF0000 : val;
    }
}
