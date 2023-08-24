import { type Engine, type SubMesh, type Scene, type UniformBuffer } from '@babylonjs/core';
import { BaseTexture, Texture } from '@babylonjs/core/Materials/Textures';
import { Material } from '@babylonjs/core/Materials/material';
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';
import { Scalar } from '@babylonjs/core/Maths/math.scalar';

/**
 * 高光阴影材质
 *
 * - PS 柔光叠加算法：https://zhuanlan.zhihu.com/p/108820522
 */
export class HighlightShadowPluginMaterial extends MaterialPluginBase {
  private _isEnabled = false;
  private _texture?: Texture | undefined;
  private _highlightLevel = 0.5;
  private _shadowLevel = 0.5;

  get highlightLevel() {
    return this._highlightLevel;
  }

  set highlightLevel(value) {
    if (this._highlightLevel === value) return;
    this._highlightLevel = value;
  }

  get shadowLevel() {
    return this._shadowLevel;
  }
  set shadowLevel(value) {
    if (this._shadowLevel === value) return;
    this._shadowLevel = value;
  }

  get isEnabled() {
    return this._isEnabled;
  }

  set isEnabled(value) {
    if (this._isEnabled === value) return;

    this._isEnabled = value;
    this.markAllDefinesAsDirty();
    this._enable(value);
  }

  get texture(): Texture | undefined {
    return this._texture;
  }

  set texture(value: Texture | undefined) {
    if (this.texture === value) return;
    this._texture = value;
    this._material.markAsDirty(Material.TextureDirtyFlag);
  }

  constructor(material: any) {
    super(material, 'HighlightShadow', 200, { HIGHLIGHT_SHADOW: false });
    this._enable(this._isEnabled);
  }

  getActiveTextures(activeTextures: BaseTexture[]): void {
    if (this.texture) {
      activeTextures.push(this.texture);
    }
  }

  public hasTexture(texture: BaseTexture): boolean {
    if (this.texture === texture) return true;
    return false;
  }

  prepareDefinesBeforeAttributes(defines: any, _scene: any, _mesh: any) {
    if (this.isEnabled && this._texture) {
      defines._needUVs = true;
      defines.HIGHLIGHT_SHADOW = true;
    } else {
      defines.HIGHLIGHT_SHADOW = false;
    }
  }

  getClassName() {
    return 'HighlightShadowPluginMaterial';
  }

  getUniforms() {
    return {
      ubo: [
        { name: 'hlsMatrix', size: 16, type: 'mat4' },
        { name: 'vHlsInfo', size: 2, type: 'vec2' },
        { name: 'vHlsLevel', size: 2, type: 'vec2' },
      ],
      vertex: `
#ifdef HIGHLIGHT_SHADOW
  uniform mat4 hlsMatrix;
  uniform vec2 vHlsInfo;
#endif
`,
      fragment: `
#ifdef HIGHLIGHT_SHADOW
  uniform mat4 hlsMatrix;
  uniform vec2 vHlsInfo;
  uniform vec2 vHlsLevel;
#endif
`,
    };
  }

  getSamplers(samplers: string[]) {
    samplers.push('hlsSampler');
  }

  isReadyForSubMesh(_defines: any, scene: Scene, _engine: Engine): boolean {
    if (scene.texturesEnabled) {
      if (this.texture && !this.texture.isReadyOrNotBlocking()) return false;
    }

    return true;
  }

  bindForSubMesh(ubo: UniformBuffer, scene: Scene, _engine: Engine, _subMesh: SubMesh) {
    // Textures
    if (scene.texturesEnabled) {
      if (this.texture) {
        ubo.setTexture('hlsSampler', this.texture);
        ubo.updateMatrix('hlsMatrix', this.texture.getTextureMatrix());
        ubo.updateFloat2('vHlsInfo', this.texture.coordinatesIndex, this.texture.level);

        const highlightLevel = Scalar.Clamp(1 / (this.highlightLevel * 2 + 1), 0, 1);
        const shadowLevel = Scalar.Clamp(this.shadowLevel * 2 + 1, 1, 99);

        ubo.updateFloat2('vHlsLevel', highlightLevel, shadowLevel);
      }
    }
  }

  getCustomCode(shaderType: string) {
    if (shaderType === 'vertex') {
      return {
        CUSTOM_VERTEX_DEFINITIONS: `
#ifdef HIGHLIGHT_SHADOW
  varying vec2 vHlsUV;
#endif
`,

        CUSTOM_VERTEX_MAIN_BEGIN: `
#ifdef HIGHLIGHT_SHADOW
  vHlsUV = vec2(hlsMatrix * vec4(uv, 1.0, 0.0));
#endif
`,
      };
    }

    if (shaderType === 'fragment') {
      return {
        CUSTOM_FRAGMENT_DEFINITIONS: `
#ifdef HIGHLIGHT_SHADOW
  varying vec2 vHlsUV;
  uniform sampler2D hlsSampler;
#endif
`,
        CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: `
#if defined(HIGHLIGHT_SHADOW)
  vec4 _hsColor = texture(hlsSampler, vHlsUV + uvOffset) * vHlsInfo.y;

  float _r = finalColor.r;
  float _g = finalColor.g;
  float _b = finalColor.b;

  if(_hsColor.r < 0.5) {
    _r = 2.0 * _r * _hsColor.r + pow(_r, vHlsLevel.y) * (1.0 - 2.0 * _hsColor.r);
  } else {
    _r = 2.0 * _r * (1.0 - _hsColor.r) + pow(_r, vHlsLevel.x) * (2.0 * _hsColor.r - 1.0);
  }

  if(_hsColor.g < 0.5) {
    _g = 2.0 * _g * _hsColor.g + pow(_g, vHlsLevel.y) * (1.0 - 2.0 * _hsColor.g);
  } else {
    _g = 2.0 * _g * (1.0 - _hsColor.g) + pow(_g, vHlsLevel.x) * (2.0 * _hsColor.g - 1.0);
  }

  if(_hsColor.b < 0.5) {
    _b = 2.0 * _b * _hsColor.b + pow(_b, vHlsLevel.y) * (1.0 - 2.0 * _hsColor.b);
  } else {
    _b = 2.0 * _b * (1.0 - _hsColor.b) + pow(_b, vHlsLevel.x) * (2.0 * _hsColor.b - 1.0);
  }

  finalColor.r = _r;
  finalColor.g = _g;
  finalColor.b = _b;
#endif
`,
      } as any;
    }

    return null;
  }
}
