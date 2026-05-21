export let Module: {
  _malloc(size: number): number;
  _free(ptr: number): void;
  _crn_get_uncompressed_size(src: number, srcSize: number): number;
  _crn_decompress(src: number, srcSize: number, dst: number, dstSize: number, flags: number): void;
  HEAPU8: Uint8Array;
  HEAPU16: Uint16Array;
};
