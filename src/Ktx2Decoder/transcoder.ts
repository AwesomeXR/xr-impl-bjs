/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/naming-convention */
import type * as KTX2 from '@babylonjs/core/Materials/Textures/ktx2decoderTypes';

import type { WASMMemoryManager } from './wasmMemoryManager';
import type { KTX2FileReader, IKTX2_ImageDesc } from './ktx2FileReader';

/**
 * @internal
 */
export class Transcoder {
  public static CanTranscode(
    _src: KTX2.SourceTextureFormat,
    _dst: KTX2.TranscodeTarget,
    _isInGammaSpace: boolean
  ): boolean {
    return false;
  }

  public static Name = 'Transcoder';

  public getName(): string {
    return Transcoder.Name;
  }

  public initialize(): void {}

  public needMemoryManager(): boolean {
    return false;
  }

  public setMemoryManager(_memoryMgr: WASMMemoryManager): void {}

  public transcode(
    _src: KTX2.SourceTextureFormat,
    _dst: KTX2.TranscodeTarget,
    _level: number,
    _width: number,
    _height: number,
    _uncompressedByteLength: number,
    _ktx2Reader: KTX2FileReader,
    _imageDesc: IKTX2_ImageDesc | null,
    _encodedData: Uint8Array
  ): Promise<Uint8Array | null> {
    return Promise.resolve(null);
  }
}
