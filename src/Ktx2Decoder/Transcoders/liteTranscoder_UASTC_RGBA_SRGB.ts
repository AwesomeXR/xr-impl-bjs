import * as KTX2 from '@babylonjs/core/Materials/Textures/ktx2decoderTypes';

import { LiteTranscoder } from './liteTranscoder';
import type { KTX2FileReader, IKTX2_ImageDesc } from '../ktx2FileReader';
import { DecoderURL } from '../../DecoderURL';

/**
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export class LiteTranscoder_UASTC_RGBA_SRGB extends LiteTranscoder {
  /**
   * URL to use when loading the wasm module for the transcoder (srgb)
   */
  public static WasmModuleURL = DecoderURL.UniversalTranscoder_UASTC_RGBA_SRGB;

  public static CanTranscode(
    src: KTX2.SourceTextureFormat,
    dst: KTX2.TranscodeTarget,
    isInGammaSpace: boolean
  ): boolean {
    return src === KTX2.SourceTextureFormat.UASTC4x4 && dst === KTX2.TranscodeTarget.RGBA32 && isInGammaSpace;
  }

  public static Name = 'UniversalTranscoder_UASTC_RGBA_SRGB';

  public getName(): string {
    return LiteTranscoder_UASTC_RGBA_SRGB.Name;
  }

  public initialize(): void {
    super.initialize();
    this._transcodeInPlace = false;
    this.setModulePath(LiteTranscoder_UASTC_RGBA_SRGB.WasmModuleURL);
  }

  public transcode(
    _src: KTX2.SourceTextureFormat,
    _dst: KTX2.TranscodeTarget,
    _level: number,
    width: number,
    height: number,
    uncompressedByteLength: number,
    _ktx2Reader: KTX2FileReader,
    _imageDesc: IKTX2_ImageDesc | null,
    encodedData: Uint8Array
  ): Promise<Uint8Array | null> {
    return this._loadModule().then((moduleWrapper: any) => {
      const transcoder: any = moduleWrapper.module;
      const [, uncompressedTextureView] = this._prepareTranscoding(
        width,
        height,
        uncompressedByteLength,
        encodedData,
        4
      );

      return transcoder.decode(width, height) === 0 ? uncompressedTextureView!.slice() : null;
    });
  }
}
