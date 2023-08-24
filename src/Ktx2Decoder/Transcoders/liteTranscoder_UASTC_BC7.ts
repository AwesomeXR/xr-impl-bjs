import * as KTX2 from '@babylonjs/core/Materials/Textures/ktx2decoderTypes';

import { LiteTranscoder } from './liteTranscoder';
import { DecoderURL } from '../../DecoderURL';

/**
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export class LiteTranscoder_UASTC_BC7 extends LiteTranscoder {
  /**
   * URL to use when loading the wasm module for the transcoder
   */
  public static WasmModuleURL = DecoderURL.UniversalTranscoder_UASTC_BC7;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static CanTranscode(
    src: KTX2.SourceTextureFormat,
    dst: KTX2.TranscodeTarget,
    _isInGammaSpace: boolean
  ): boolean {
    return src === KTX2.SourceTextureFormat.UASTC4x4 && dst === KTX2.TranscodeTarget.BC7_RGBA;
  }

  public static Name = 'UniversalTranscoder_UASTC_BC7';

  public getName(): string {
    return LiteTranscoder_UASTC_BC7.Name;
  }

  public initialize(): void {
    super.initialize();
    this.setModulePath(LiteTranscoder_UASTC_BC7.WasmModuleURL);
  }
}
