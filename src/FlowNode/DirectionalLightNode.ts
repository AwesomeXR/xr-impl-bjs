import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData, Util } from 'ah-flow-node';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { toInnerColor, toInnerVec, toOuterVec } from '../lib/toVec';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { AssetContainer } from '@babylonjs/core';

class BizDirectionalLight extends DirectionalLight {
  protected _setDefaultAutoExtendShadowProjectionMatrix(
    matrix: Matrix,
    viewMatrix: Matrix,
    renderList: Array<AbstractMesh>
  ): void {
    const activeCamera = this.getScene().activeCamera;

    if (!activeCamera) {
      return;
    }

    // Check extends
    if (this.autoUpdateExtends || (this as any)._orthoLeft === Number.MAX_VALUE) {
      const tempVector3 = Vector3.Zero();

      let _orthoLeft = Number.MAX_VALUE;
      let _orthoRight = Number.MIN_VALUE;
      let _orthoTop = Number.MIN_VALUE;
      let _orthoBottom = Number.MAX_VALUE;

      let shadowMinZ = Number.MAX_VALUE;
      let shadowMaxZ = Number.MIN_VALUE;

      for (let meshIndex = 0; meshIndex < renderList.length; meshIndex++) {
        const mesh = renderList[meshIndex];

        if (!mesh) {
          continue;
        }

        const boundingInfo = mesh.getBoundingInfo();
        const boundingBox = boundingInfo.boundingBox;

        for (let index = 0; index < boundingBox.vectorsWorld.length; index++) {
          Vector3.TransformCoordinatesToRef(boundingBox.vectorsWorld[index], viewMatrix, tempVector3);

          if (tempVector3.x < _orthoLeft) {
            _orthoLeft = tempVector3.x;
          }
          if (tempVector3.y < _orthoBottom) {
            _orthoBottom = tempVector3.y;
          }

          if (tempVector3.x > _orthoRight) {
            _orthoRight = tempVector3.x;
          }
          if (tempVector3.y > _orthoTop) {
            _orthoTop = tempVector3.y;
          }
          if (this.autoCalcShadowZBounds) {
            if (tempVector3.z < shadowMinZ) {
              shadowMinZ = tempVector3.z;
            }
            if (tempVector3.z > shadowMaxZ) {
              shadowMaxZ = tempVector3.z;
            }
          }
        }
      }

      if (this.autoCalcShadowZBounds) {
        this._shadowMinZ = shadowMinZ;
        this._shadowMaxZ = shadowMaxZ;
      }

      const xOffset = _orthoRight - _orthoLeft;
      const yOffset = _orthoTop - _orthoBottom;

      _orthoLeft = _orthoLeft - xOffset * (this as any)._shadowOrthoScale;
      _orthoRight = _orthoRight + xOffset * (this as any)._shadowOrthoScale;
      _orthoTop = _orthoTop + yOffset * (this as any)._shadowOrthoScale;
      _orthoBottom = _orthoBottom - yOffset * (this as any)._shadowOrthoScale;

      (this as any)._orthoLeft = _orthoLeft;
      (this as any)._orthoRight = _orthoRight;
      (this as any)._orthoTop = _orthoTop;
      (this as any)._orthoBottom = _orthoBottom;
    }

    const minZ = this.shadowMinZ !== undefined ? this.shadowMinZ : activeCamera.minZ;
    const maxZ = this.shadowMaxZ !== undefined ? this.shadowMaxZ : activeCamera.maxZ;

    const useReverseDepthBuffer = this.getScene().getEngine().useReverseDepthBuffer;

    Matrix.OrthoOffCenterLHToRef(
      (this as any)._orthoLeft,
      (this as any)._orthoRight,
      (this as any)._orthoBottom,
      (this as any)._orthoTop,
      useReverseDepthBuffer ? maxZ : minZ,
      useReverseDepthBuffer ? minZ : maxZ,
      matrix,
      this.getScene().getEngine().isNDCHalfZRange
    );
  }
}

export const getDirectionalLightNodeRegisterData = (): IFlowNodeTypeRegisterData<'DirectionalLightNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('DirectionalLightNode')!,
  setup(ctx) {
    const light = new BizDirectionalLight('DirectionalLight_' + ctx.ID, Vector3.Down(), ctx.host);

    light.autoUpdateExtends = true;
    light.autoCalcShadowZBounds = !!ctx.input.shadowAutoCalcShadowZBounds;
    light.intensity = ctx.input.intensity || 1;

    if (ctx.input.shadowDepthMinMax && !light.autoCalcShadowZBounds) {
      light.shadowMinZ = ctx.input.shadowDepthMinMax.x;
      light.shadowMaxZ = ctx.input.shadowDepthMinMax.y;
    }

    if (ctx.input.shadowOrthoScale) light.shadowOrthoScale = ctx.input.shadowOrthoScale;
    if (ctx.input.color) light.diffuse = toInnerColor(ctx.input.color);

    rebuildLightTransition();

    let shadowGenerator: ShadowGenerator | undefined;

    function rebuildLightTransition() {
      const _pInfo = calcPositionInfo(
        ctx.input.alpha || 0,
        ctx.input.beta || 0,
        ctx.input.radius || 1,
        ctx.input.target ? toInnerVec(ctx.input.target) : Vector3.ZeroReadOnly
      );

      light.direction = _pInfo.direction;
      light.position = _pInfo.position;

      ctx.output.position = toOuterVec(_pInfo.position);
    }

    function rebuildShadow() {
      if (ctx.input.shadow) {
        if (!shadowGenerator) {
          shadowGenerator = new ShadowGenerator(ctx.input.shadowMapSize || 1024, light);

          shadowGenerator.usePercentageCloserFiltering = true;
          shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
          shadowGenerator.transparencyShadow = true;
        }

        if (ctx.input.shadowMapSize) shadowGenerator.mapSize = ctx.input.shadowMapSize;

        if (typeof ctx.input.shadowBias !== 'undefined') shadowGenerator.bias = ctx.input.shadowBias;
        if (typeof ctx.input.shadowNormalBias !== 'undefined') shadowGenerator.normalBias = ctx.input.shadowNormalBias;
        if (typeof ctx.input.shadowDarkness !== 'undefined') shadowGenerator.darkness = ctx.input.shadowDarkness;

        buildShadowCaster();
      }
      //
      else if (!ctx.input.shadow && shadowGenerator) {
        shadowGenerator.dispose();
        shadowGenerator = undefined;
      }
    }

    function buildShadowCaster() {
      if (!shadowGenerator) return;

      const sMap = shadowGenerator.getShadowMap();
      if (sMap && sMap.renderList) {
        sMap.renderList.length = 0;
      }

      if (ctx.input.shadowMeshCollection) {
        Object.values(ctx.input.shadowMeshCollection).forEach(mesh => {
          if (mesh instanceof Mesh) {
            shadowGenerator!.addShadowCaster(mesh, true);
          }
        });
      }

      // 未定义 shadowMeshCollection 的时候，自动添加所有的 assetContainer 的 mesh
      else {
        for (const node of ctx.host.flowNodeManager.all) {
          if (Util.isFlowNode('AssetContainerNode', node) && node.output.container) {
            const _container = node.output.container as AssetContainer;

            for (const mesh of _container.meshes) {
              if (mesh instanceof Mesh) {
                shadowGenerator!.addShadowCaster(mesh, true);
              }
            }
          }
        }
      }
    }

    const flusher = Util.createNodeFlusher(ctx, {
      alpha: rebuildLightTransition,
      beta: rebuildLightTransition,
      radius: rebuildLightTransition,
      target: rebuildLightTransition,
      intensity: function () {
        light.intensity = ctx.input.intensity || 1;
      },
      shadow: rebuildShadow,
      shadowMeshCollection: buildShadowCaster,
      shadowMapSize: rebuildShadow,
      _meta: function () {},
      shadowBias: function () {
        if (!shadowGenerator || typeof ctx.input.shadowBias === 'undefined') return;
        shadowGenerator.bias = ctx.input.shadowBias;
      },
      shadowNormalBias: function () {
        if (!shadowGenerator || typeof ctx.input.shadowNormalBias === 'undefined') return;
        shadowGenerator.normalBias = ctx.input.shadowNormalBias;
      },
      shadowDarkness: function () {
        if (!shadowGenerator || typeof ctx.input.shadowDarkness === 'undefined') return;
        shadowGenerator.darkness = ctx.input.shadowDarkness;
      },

      shadowAutoCalcShadowZBounds: function () {
        light.autoCalcShadowZBounds = !!ctx.input.shadowAutoCalcShadowZBounds;

        if (!light.autoCalcShadowZBounds && ctx.input.shadowDepthMinMax) {
          light.shadowMinZ = ctx.input.shadowDepthMinMax.x;
          light.shadowMaxZ = ctx.input.shadowDepthMinMax.y;
        }
      },
      shadowDepthMinMax: function () {
        if (ctx.input.shadowDepthMinMax) {
          light.shadowMinZ = ctx.input.shadowDepthMinMax.x;
          light.shadowMaxZ = ctx.input.shadowDepthMinMax.y;
        }
      },
      shadowOrthoScale: function () {
        if (ctx.input.shadowOrthoScale) light.shadowOrthoScale = ctx.input.shadowOrthoScale;
      },
      color: function () {
        if (ctx.input.color) light.diffuse = toInnerColor(ctx.input.color);
      },
    });

    const removeNodeRemoveListen = ctx.host.event.listen('afterNodeRemove', ev => {
      if (Util.isFlowNode('AssetContainerNode', ev.node)) buildShadowCaster();
    });

    const removeOutputChangeListen = ctx.host.event.listen('node:output:change', ev => {
      if (Util.isFlowNode('AssetContainerNode', ev.source) && ev.key === 'container') buildShadowCaster();
    });

    flusher.bindInputEvent();
    rebuildShadow();

    ctx.output.light = light;
    ctx.output.loaded = true;

    return () => {
      light.dispose(false, true);
      if (shadowGenerator) shadowGenerator.dispose();

      removeNodeRemoveListen();
      removeOutputChangeListen();
    };
  },
});

function calcPositionInfo(alpha: number, beta: number, radius: number, target: Vector3) {
  alpha = (alpha / 180) * Math.PI;
  beta = (beta / 180) * Math.PI;

  const x0 = Math.sin(beta) * Math.cos(alpha);
  const z0 = Math.sin(beta) * Math.sin(alpha);
  const y0 = Math.cos(beta);

  const position = new Vector3(target.x + x0 * radius, target.y + y0 * radius, target.z + z0 * radius);
  const direction = new Vector3(-x0, -y0, -z0);

  return { position, direction };
}
