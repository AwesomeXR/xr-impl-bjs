import { IFlowNodeTypeRegisterData, FlowNodeTypeRegistry, Util } from 'ah-flow-node';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { AssetContainer } from '@babylonjs/core/assetContainer';
import { BRCUtil } from '../BRCUtil';
import { toInnerVec, toOuterVec } from '../lib/toVec';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { IAssetContainerInitConfig, LODManager, getData } from 'xr-core';
import { setData, updateTexture } from '../lib';
import { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR';
import { Texture } from '@babylonjs/core/Materials/Textures';
import { updateMaterial } from '../lib/updateMaterial';

export const getAssetContainerNodeRegisterData = (): IFlowNodeTypeRegisterData<'AssetContainerNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('AssetContainerNode')!,
  setup(ctx) {
    const originDefine = Util.cloneNodeDefine(ctx._define);

    const rootPivot = new TransformNode('RP_' + ctx.ID, ctx.host); // 所有 lod 的父级
    const lodContainers: (AssetContainer | undefined)[] = []; // lod 级别容器
    let curLod: number = -1;

    const lodMng = new LODManager<string | null>(
      ctx.host,
      () => toOuterVec(ctx.host.activeCamera!.globalPosition),
      (url, _distance, index) => {
        ctx.logger.info('[LOD_%s] %s', index, url);

        if (url) {
          curLod = index;
          loadContainerAndShow(url, index);
        } else {
          curLod = -1;
          hideAll();
        }
      }
    );

    // 载入初始配置
    function loadInitConfig(_container: AssetContainer) {
      const _initConfig = ctx.input._initConfig as IAssetContainerInitConfig;
      if (!_initConfig) return;

      ctx.logger.info('load init config');

      // for add
      if (_initConfig.add) {
        // 添加材质
        if (_initConfig.add.materials) {
          for (const matName of _initConfig.add.materials) {
            const _mat = _container.materials.find(m => m.name === matName);
            if (_mat) continue;

            const _newMat = new PBRMaterial(matName, ctx.host);
            _container.materials.push(_newMat);
          }
        }

        // 添加 texture
        if (_initConfig.add.textures) {
          for (const texName of _initConfig.add.textures) {
            const _tex = _container.textures.find(m => m.name === texName);
            if (_tex) continue;

            const _newTex = new Texture('x', ctx.host);
            _newTex.name = texName;
            _container.textures.push(_newTex);
          }
        }
      }

      // for modify
      if (_initConfig.modify) {
        // modify material
        if (_initConfig.modify.material) {
          for (const matName of Object.keys(_initConfig.modify.material)) {
            const _mat = _container.materials.find(m => m.name === matName);
            if (!_mat || !(_mat instanceof PBRMaterial)) continue;

            const _matCfg = _initConfig.modify.material[matName];
            updateMaterial(_container, _mat, _matCfg);
          }
        }

        // modify texture
        if (_initConfig.modify.texture) {
          for (const texName of Object.keys(_initConfig.modify.texture)) {
            const _tex = _container.textures.find(m => m.name === texName);
            if (!_tex || !(_tex instanceof Texture)) continue;

            const _texCfg = _initConfig.modify.texture[texName];
            updateTexture(ctx.host, _container, _tex, _texCfg);
          }
        }
      }
    }

    function reloadInputDef() {
      const { _inDefs } = ctx.input;
      if (!_inDefs) return;

      const newInput = { ...originDefine.input } as any;
      for (let i = 0; i < _inDefs.length; i++) {
        const item = _inDefs[i];
        newInput[item.key] = item.def;
      }

      ctx.updateDefine({ input: newInput });

      for (let i = 0; i < _inDefs.length; i++) {
        reloadExtraInputIfNeeded(_inDefs[i].key);
      }
    }

    function reloadOutputDef() {
      const { _outDefs } = ctx.input;
      if (!_outDefs) return;

      const newOutput = { ...originDefine.output } as any;
      for (let i = 0; i < _outDefs.length; i++) {
        const item = _outDefs[i];
        newOutput[item.key] = item.def;
      }

      ctx.updateDefine({ output: newOutput });

      for (let i = 0; i < _outDefs.length; i++) {
        flushExtraOutputIfNeeded(_outDefs[i].key);
      }
    }

    function reloadExtraInputIfNeeded(key: string) {
      const _container = lodContainers[0];
      if (!_container) return; // 只对 lod0 生效

      const incomeValue = (ctx.input as any)[key];
      if (typeof incomeValue === 'undefined') return;

      if (key.startsWith('material/')) {
        const [_, matName, propPath] = key.split('/');
        const mat = _container.materials.find(m => m.name === matName);
        if (mat) {
          if (incomeValue instanceof BaseTexture) {
            incomeValue.onDisposeObservable.addOnce(() => {
              if (getData(mat, propPath) === incomeValue) {
                ctx.setInput(key as any, null, { skipEqualCheck: true });
              }
            });
          }
          setData(mat, propPath, incomeValue);
        }
      }

      if (key.startsWith('texture/')) {
        const [_, texName, propPath] = key.split('/');
        const tex = _container.textures.find(m => m.name === texName);
        if (tex) {
          setData(tex, propPath, incomeValue);
        }
      }

      flushExtraOutputIfNeeded(key);
    }

    function flushExtraOutputIfNeeded(key: string) {
      const _container = lodContainers[0];
      if (!_container) return; // 只对 lod0 生效

      if (!(ctx._define.output as any)[key]) return;

      const [_t, targetName, propPath] = key.split('/');
      let outputValue: any;

      // node
      if (_t === 'node') {
        const _node = _container.getNodes().find(m => m.name === targetName);
        if (_node) outputValue = getData(_node, propPath);
      }
      // material
      if (_t === 'material') {
        const mat = _container.materials.find(m => m.name === targetName);
        if (mat) outputValue = getData(mat, propPath);
      }
      // texture
      if (_t === 'texture') {
        const tex = _container.textures.find(m => m.name === targetName);
        if (tex) outputValue = getData(tex, propPath);
      }
      // animationGroup
      if (_t === 'animationGroup') {
        const ani = _container.animationGroups.find(m => m.name === targetName);
        if (ani) outputValue = getData(ani, propPath);
      }

      if (typeof outputValue !== 'undefined') {
        (ctx.output as any)[key] = outputValue;
      }
    }

    function reloadAll() {
      reloadInputDef();
      reloadOutputDef();

      setLodList();

      if (ctx.input.position) {
        rootPivot.position = toInnerVec(ctx.input.position);
        lodMng.targetCenter = ctx.input.position;
      }
      if (ctx.input.scaling) rootPivot.scaling = toInnerVec(ctx.input.scaling);
      if (ctx.input.rotation) rootPivot.rotation = toInnerVec(ctx.input.rotation).scale(Math.PI / 180);

      if (ctx.input.visible) toggleVisibleLODIfNeeded(curLod);
      else hideAll();

      flushRootOutputTransform();
    }

    function hideAll() {
      const nodes = rootPivot.getDescendants(false);
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        node.setEnabled(false);
      }
    }

    function toggleVisibleLODIfNeeded(lodIndex: number) {
      // 当前处于全局不可见状态
      if (!ctx.input.visible) {
        hideAll();
        return;
      }

      // 切换可见性
      for (let i = 0; i < lodContainers.length; i++) {
        const _container = lodContainers[i];
        if (!_container) continue;

        const pivot: Mesh | undefined = (_container as any).__pivot;
        if (!pivot) continue;

        const _enable = i === lodIndex;
        pivot.setEnabled(_enable);

        const _subNodes = pivot.getDescendants(false);

        for (let j = 0; j < _subNodes.length; j++) {
          const node = _subNodes[j];
          node.setEnabled(_enable);
        }
      }

      const _container = lodContainers[lodIndex];
      if (!_container) return;

      const pivot: Mesh = (_container as any).__pivot;

      // 输出 lod 相关的节点
      ctx.output.nodes = _container
        .getNodes()
        .filter(n => n.name !== pivot.name)
        .reduce((re, cur) => {
          return { ...re, [cur.getClassName() + ':' + cur.name]: cur };
        }, {});

      ctx.output.material = _container.materials.reduce((re, cur) => ({ ...re, [cur.name]: cur }), {});
      ctx.output.animator = _container.animationGroups.reduce((re, cur) => ({ ...re, [cur.name]: cur }), {});
      ctx.output.animators = _container.animationGroups;

      const bInfo = pivot.getHierarchyBoundingVectors(true);

      ctx.output.boundBox = {
        center: toOuterVec(bInfo.min.add(bInfo.max.subtract(bInfo.min).scale(0.5))),
        size: toOuterVec(bInfo.max.subtract(bInfo.min)),
      };

      lodMng.targetCenter = ctx.output.boundBox.center;
      lodMng.targetSize = ctx.output.boundBox.size;
    }

    function setLodList() {
      lodMng.lodList = [];

      if (ctx.input.lodDistance) {
        const { url, url_low, url_middle, url_minimal } = ctx.input;
        const urls = [url, url_middle, url_low, url_minimal].filter(v => !!v) as string[];

        if (urls.length === 4) {
          lodMng.lodList.push({ value: urls[0], distance: ctx.input.lodDistance.x });
          lodMng.lodList.push({ value: urls[1], distance: ctx.input.lodDistance.y });
          lodMng.lodList.push({ value: urls[2], distance: ctx.input.lodDistance.z });
          lodMng.lodList.push({ value: urls[3], distance: Number.MAX_SAFE_INTEGER });
        }

        if (urls.length === 3) {
          lodMng.lodList.push({ value: urls[0], distance: ctx.input.lodDistance.y });
          lodMng.lodList.push({ value: urls[1], distance: ctx.input.lodDistance.z });
          lodMng.lodList.push({ value: urls[2], distance: Number.MAX_SAFE_INTEGER });
        }

        if (urls.length === 2) {
          lodMng.lodList.push({ value: urls[0], distance: ctx.input.lodDistance.z });
          lodMng.lodList.push({ value: urls[1], distance: Number.MAX_SAFE_INTEGER });
        }

        if (urls.length === 1) {
          lodMng.lodList.push({ value: urls[0], distance: Number.MAX_SAFE_INTEGER });
        }
      } else {
        const url = ctx.input.url || ctx.input.url_middle || ctx.input.url_low || ctx.input.url_minimal;
        if (url) {
          lodMng.lodList.push({ value: url, distance: Number.MAX_SAFE_INTEGER });
        }
      }
    }

    const flushRootOutputTransform = () => {
      rootPivot.computeWorldMatrix(true);

      ctx.output.position = toOuterVec(rootPivot.position, true);
      ctx.output.scaling = toOuterVec(rootPivot.scaling, true);
      ctx.output.rotation = toOuterVec(rootPivot.rotation.scale(360 / Math.PI / 2), true);
      ctx.output.upVec = toOuterVec(rootPivot.up, true);
      ctx.output.forwardVec = toOuterVec(rootPivot.forward, true);
      ctx.output.rightVec = toOuterVec(rootPivot.right, true);

      const _container = lodContainers[curLod];
      if (_container) {
        const pivot: Mesh = (_container as any).__pivot;
        const bInfo = pivot.getHierarchyBoundingVectors(true);

        ctx.output.boundBox = {
          center: toOuterVec(bInfo.min.add(bInfo.max.subtract(bInfo.min).scale(0.5))),
          size: toOuterVec(bInfo.max.subtract(bInfo.min)),
        };

        lodMng.targetCenter = ctx.output.boundBox.center;
        lodMng.targetSize = ctx.output.boundBox.size;
      }
    };

    const loadContainerAndShow = (toLoadUrl: string, lodIndex: number) => {
      const cachedContainer: AssetContainer | undefined = lodContainers[lodIndex];
      const _needAddOrReplace = !cachedContainer || (cachedContainer as any).__url !== toLoadUrl;

      // 需要更新容器
      if (_needAddOrReplace) {
        lodMng.pause = true;

        BRCUtil.loadModel(ctx.host, toLoadUrl).then(_container => {
          if (cachedContainer) cachedContainer.dispose();

          if (ctx.disposed) {
            _container.dispose();
            lodMng.pause = false;
            return;
          }

          if (lodIndex === 0) loadInitConfig(_container); // 仅在这里调用一次
          _container.addAllToScene();

          // 加入 lod 列表
          lodContainers[lodIndex] = _container;

          const pivot = _container.createRootMesh();
          pivot.name = `_LOD_${lodIndex}` + ctx.ID;
          pivot.parent = rootPivot; // 挂到全局父级上去

          _container.rootNodes.push(pivot);

          (_container as any).__pivot = pivot; // 挂到 __pivot 方便读取
          (_container as any).__url = toLoadUrl; // url 标记

          // 给 nodes 打标
          for (const node of _container.getNodes()) {
            node.__flowNodeID = ctx.ID;
          }
          for (const ag of _container.animationGroups) {
            ag.__flowNodeID = ctx.ID;
          }

          toggleVisibleLODIfNeeded(lodIndex); // 切换到当前 lod 显示

          lodMng.pause = false;

          if (lodIndex === 0) {
            if (ctx.input._inDefs) {
              for (let i = 0; i < ctx.input._inDefs.length; i++) {
                const _indefKey = ctx.input._inDefs[i].key;
                reloadExtraInputIfNeeded(_indefKey);
              }
            }

            if (ctx.input._outDefs) {
              for (let i = 0; i < ctx.input._outDefs.length; i++) {
                const _defKey = ctx.input._outDefs[i].key;
                flushExtraOutputIfNeeded(_defKey);
              }
            }

            ctx.output.container = _container; // 只输出 lod0
          }

          ctx.output.loaded = true;
        });
      }

      //
      else {
        toggleVisibleLODIfNeeded(lodIndex); // 直接切换到当前 lod 显示
      }
    };

    const flusher = Util.createNodeFlusher(ctx, {
      position: function () {
        if (ctx.input.position) {
          rootPivot.position = toInnerVec(ctx.input.position);
          lodMng.targetCenter = ctx.input.position;

          flushRootOutputTransform();
        }
      },
      scaling: function () {
        if (ctx.input.scaling) {
          rootPivot.scaling = toInnerVec(ctx.input.scaling);
          flushRootOutputTransform();
        }
      },
      rotation: function () {
        if (ctx.input.rotation) {
          rootPivot.rotation = toInnerVec(ctx.input.rotation).scale(Math.PI / 180);
          flushRootOutputTransform();
        }
      },
      visible: function () {
        if (ctx.input.visible) toggleVisibleLODIfNeeded(curLod);
        else hideAll();
      },
      _meta: function () {},

      url: setLodList,
      url_middle: setLodList,
      url_low: setLodList,
      url_minimal: setLodList,
      lodDistance: setLodList,
      _inDefs: reloadInputDef,
      _outDefs: reloadOutputDef,
      _initConfig: function () {
        // 只在 load container 的时候调用一次
      },
    });

    flusher.bindInputEvent();

    ctx.event.listen('input:change', ev => reloadExtraInputIfNeeded(ev.key));

    reloadAll();

    return () => {
      lodMng.dispose();

      if (rootPivot) rootPivot.dispose();
      for (const container of lodContainers) {
        container?.dispose();
      }
    };
  },
});
