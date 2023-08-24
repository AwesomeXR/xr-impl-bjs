// import { Mesh } from '@babylonjs/core/Meshes/mesh';
// import { RecastJSPlugin } from '@babylonjs/core/Navigation/Plugins/recastJSPlugin';
import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData } from 'ah-flow-node';
// import Recast from 'recast-detour';
import { setData } from '../lib';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { toInnerVec, toOuterVec } from '../lib/toVec';
import { Scalar } from '@babylonjs/core/Maths/math.scalar';
import { Ray } from '@babylonjs/core/Culling/ray';
import { Tools } from '@babylonjs/core/Misc/tools';
import { BRCUtil } from '../BRCUtil';
import { getCurrentTimestamp } from 'xr-core';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { Mesh } from '@babylonjs/core/Meshes/mesh';

// let _recastReadyPromise: Promise<void>;
// const _recastInsCache = new Map<string, RecastJSPlugin>();

// const getRecastInstance = async (host: IFlowHost, meshesOrMeshDataUrl: Mesh[] | string) => {
//   const cacheKey = [
//     host.ID,
//     typeof meshesOrMeshDataUrl === 'string' ? meshesOrMeshDataUrl : meshesOrMeshDataUrl.map(m => m.name).join('.'),
//   ].join('###');

//   if (!_recastInsCache.has(cacheKey)) {
//     if (!_recastReadyPromise) _recastReadyPromise = Recast();
//     await _recastReadyPromise;

//     const recastNav = new RecastJSPlugin();
//     let navMeshDataDeffer: Promise<Uint8Array>;

//     if (typeof meshesOrMeshDataUrl === 'string') {
//       navMeshDataDeffer = meshesOrMeshDataUrl.startsWith('file://')
//         ? host.mfs.readFile(meshesOrMeshDataUrl).then(ab => new Uint8Array(ab))
//         : quickXhrDownload<ArrayBuffer>(meshesOrMeshDataUrl, 'arraybuffer').then(ab => new Uint8Array(ab));
//     } else {
//       recastNav.createNavMesh(meshesOrMeshDataUrl, {
//         cs: 0.2,
//         ch: 0.2,
//         walkableSlopeAngle: 45,
//         walkableHeight: 1,
//         walkableClimb: 1,
//         walkableRadius: 1,
//         maxEdgeLen: 12,
//         maxSimplificationError: 1.3,
//         minRegionArea: 8,
//         mergeRegionArea: 20,
//         maxVertsPerPoly: 6,
//         detailSampleDist: 6,
//         detailSampleMaxError: 1,
//       });
//       navMeshDataDeffer = Promise.resolve(recastNav.getNavmeshData());
//     }

//     const navMeshData = await navMeshDataDeffer;
//     recastNav.buildFromNavmeshData(navMeshData);

//     _recastInsCache.set(cacheKey, recastNav);
//   }

//   const recastNavFromCache = _recastInsCache.get(cacheKey)!;

//   if (typeof (recastNavFromCache as any).__refCnt === 'number') (recastNavFromCache as any).__refCnt += 1;
//   else (recastNavFromCache as any).__refCnt = 0;

//   return recastNavFromCache;
// };

// const disposeRecastInstance = async (ins: RecastJSPlugin) => {
//   if (typeof (ins as any).__refCnt === 'undefined') {
//     ins.dispose();
//     return;
//   }

//   (ins as any).__refCnt -= 1;

//   if ((ins as any).__refCnt <= 0) {
//     ins.dispose();

//     let cacheKey: string | undefined;

//     for (const [_ck, _cacheIns] of _recastInsCache) {
//       if (_cacheIns === ins) {
//         cacheKey = _ck;
//         break;
//       }
//     }

//     if (cacheKey) _recastInsCache.delete(cacheKey);
//   }
// };

export const getNpcNavigateNodeRegisterData = (): IFlowNodeTypeRegisterData<'NpcNavigateNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('NpcNavigateNode')!,
  setup(ctx) {
    const stubNpcMesh = new Mesh('npc_' + ctx.ID, ctx.host);

    let removeNavPointsWalkListen: (() => void) | undefined;
    let removeDirectionWalkListen: (() => void) | undefined;
    // let recastNav: RecastJSPlugin | undefined;
    let navPoints: Vector3[] = []; // 导航路标

    let aniStartTime: number | undefined;
    let curAniType: 'idle' | 'walk' | undefined;
    let removeAniLoopListen: (() => void) | undefined;

    const switchAnimation = (aniType: 'idle' | 'walk') => {
      if (curAniType === aniType) return;

      curAniType = aniType;
      aniStartTime = getCurrentTimestamp();

      ctx.output.isIdle = aniType === 'idle';
      ctx.output.isWalk = aniType === 'walk';
    };

    const loadNavMeshData = () => {
      const meshesOrMeshDataUrl = ctx.input._meta?.navMeshDataUrl || Object.values(ctx.input.ground || {});
      if (!meshesOrMeshDataUrl) return;

      // getRecastInstance(ctx.host, meshesOrMeshDataUrl).then(_recastNav => {
      //   if (ctx.disposed) return;
      //   recastNav = _recastNav;
      // });
    };

    const flush_pos = () => {
      stubNpcMesh.position = ctx.input.position ? toInnerVec(ctx.input.position, true) : Vector3.Zero();
      ctx.output.position = toOuterVec(stubNpcMesh.position, true);
    };

    const flush_rotation = () => {
      stubNpcMesh.rotation = ctx.input.rotation ? toInnerVec(ctx.input.rotation).scale(Math.PI / 180) : Vector3.Zero();
      ctx.output.rotation = toOuterVec(stubNpcMesh.rotation, true);
    };

    const flush_ellipsoid = () => {
      if (ctx.input.ellipsoid) stubNpcMesh.ellipsoid = toInnerVec(ctx.input.ellipsoid, true);
      if (ctx.input.ellipsoidOffset) stubNpcMesh.ellipsoidOffset = toInnerVec(ctx.input.ellipsoidOffset, true);
    };

    const flush_obstacle = () => {
      stubNpcMesh.surroundingMeshes = ctx.input.obstacle ? Object.values(ctx.input.obstacle) : [];

      for (let i = 0; i < stubNpcMesh.surroundingMeshes.length; i++) {
        const mesh = stubNpcMesh.surroundingMeshes[i];
        mesh.checkCollisions = true;
        mesh.isPickable = false;
      }
    };

    const buildNavPoints = () => {
      // navPoints = [];
      // stopNavPointsWalk();
      // // if (!ctx.targetPosition || !ctx.output.position) return;
      // if (!ctx.output.position) return;
      // // const distance = ctx.output.position.subtract(ctx.targetPosition).length();
      // // if (distance <= 0.01) return;
      // // recastNav.navMesh 不为空，表示 recastNav 已 ready
      // if (recastNav && recastNav.navMesh) {
      //   navPoints = recastNav.computePath(toInnerVec(ctx.output.position), ctx.targetPosition);
      //   navPoints.shift(); // 去掉起始点: ctx.output.position
      // } else {
      //   navPoints = [ctx.targetPosition.clone()];
      // }
    };

    const startNavPointsWalk = () => {
      // try stop last if needed
      stopNavPointsWalk();

      const targetPosition = navPoints.shift();

      if (!targetPosition || !ctx.output.position) {
        switchAnimation('idle');
        return;
      }

      const distance = toInnerVec(ctx.output.position).subtract(targetPosition).length();
      if (distance <= 0.01) {
        switchAnimation('idle');
        ctx.output.position = toOuterVec(targetPosition, true);
        return;
      }

      const duration = distance / 1;

      const startTime = performance.now();
      const lerpStart = toInnerVec(ctx.output.position);
      const lerpEnd = targetPosition;

      // start walk animation
      switchAnimation('walk');

      // turn to look at target
      const moveForward = lerpEnd.subtract(lerpStart);
      moveForward.y = 0;
      moveForward.normalize();

      // gltf 模型要用 right handed mode
      ctx.output.rotation = toOuterVec(Quaternion.FromLookDirectionRH(moveForward, Vector3.UpReadOnly).toEulerAngles());

      // start lerp
      removeNavPointsWalkListen = ctx.host.event.listen('beforeRender', () => {
        const lerpAmount = Scalar.Clamp((performance.now() - startTime) / (duration * 1000));

        if (lerpAmount >= 1) {
          removeNavPointsWalkListen?.();
          switchAnimation('idle');
        }

        let lerpResult = Vector3.Lerp(lerpStart, lerpEnd, lerpAmount);

        if (ctx.input.ground) {
          const navMeshes = Object.values(ctx.input.ground);

          // 向下发射射线，让小人始终站在导航网格之上
          const rayOrigin = lerpResult.add(Vector3.UpReadOnly);
          const ray = new Ray(rayOrigin, Vector3.DownReadOnly, 2);
          const pickedGround = ctx.host.pickWithRay(ray, m => navMeshes!.includes(m as any));

          if (pickedGround && pickedGround.pickedPoint) {
            lerpResult = pickedGround.pickedPoint.clone();
          }
        }

        ctx.output.position = toOuterVec(lerpResult);

        if (lerpAmount >= 1) {
          if (navPoints.length) {
            startNavPointsWalk(); // 开始下一个循环
          }
        }
      });
    };

    const stopNavPointsWalk = () => {
      if (removeNavPointsWalkListen) {
        removeNavPointsWalkListen();
        removeNavPointsWalkListen = undefined;
      }
    };

    const startDirectionWalk = () => {
      stopNavPointsWalk();

      ctx.clearInternalInput('targetPosition'); // 确保下次重复 input targetPosition 移动的时候可以被触发
      let lastTickTime = getCurrentTimestamp();

      removeDirectionWalkListen = ctx.host.event.listen('beforeRender', () => {
        const curTickTime = getCurrentTimestamp();

        if (
          !ctx.input.targetDirection ||
          !ctx.output.rotation ||
          !ctx.host.activeCamera ||
          ctx.input.targetDirection.lengthSquared() <= 0.01
        ) {
          switchAnimation('idle');
          return;
        }

        // 构建 moveForward
        const _rawMoveForward = new Vector3(ctx.input.targetDirection.x, 0, -ctx.input.targetDirection.y).normalize();
        const _rawMoveQuat = Quaternion.FromUnitVectorsToRef(Vector3.Forward(), _rawMoveForward, Quaternion.Zero());

        const _camVec = stubNpcMesh.position.subtract(ctx.host.activeCamera.globalPosition);
        _camVec.y = 0;
        _camVec.normalize();

        const moveForward = _camVec.applyRotationQuaternion(_rawMoveQuat);

        const latestOutputRotation = toInnerVec(ctx.output.rotation.scale(Math.PI / 180)); //output.rotation 是角度值

        const outputForward = Vector3.Forward().applyRotationQuaternionInPlace(
          Quaternion.FromEulerVector(latestOutputRotation)
        );

        // 应用人物旋转
        const moveQuat = Quaternion.FromUnitVectorsToRef(outputForward, moveForward, Quaternion.Zero());
        ctx.output.rotation = toOuterVec(
          Quaternion.FromEulerVector(latestOutputRotation).multiply(moveQuat).toEulerAngles()
        ).scale(180 / Math.PI);

        // 根据 moveForward 移动
        const fps = 1000 / (curTickTime - lastTickTime);
        const scaledMoveForward = moveForward.scaleInPlace((ctx.input.speed || 1) / fps);
        let moveToPos: Vector3 | undefined;

        // 紧贴地面
        const navMeshes = ctx.input.ground ? Object.values(ctx.input.ground) : undefined;
        if (navMeshes) {
          const rayOrigin = stubNpcMesh.position.add(scaledMoveForward).add(Vector3.UpReadOnly);

          const ray = new Ray(rayOrigin, Vector3.DownReadOnly, 2);
          const pickedGround = ctx.host.pickWithRay(ray, m => navMeshes!.includes(m as any));

          if (pickedGround && pickedGround.pickedPoint) {
            moveToPos = pickedGround.pickedPoint.clone();
          } else {
            const navMeshSet = new Set(navMeshes);

            // 查找边缘，确定可前进方向
            for (let degree = 5; degree < 90; degree += 5) {
              const [ptLeft, ptRight] = [-degree, degree].map(_deg => {
                const rad = Tools.ToRadians(_deg);
                const forward = BRCUtil.rotateAroundAxis(scaledMoveForward, Vector3.UpReadOnly, rad).scaleInPlace(
                  Math.cos(rad)
                );
                const raySp = toInnerVec(ctx.output.position!).add(forward).add(Vector3.UpReadOnly);
                const ray = new Ray(raySp, Vector3.DownReadOnly, 2);
                return ctx.host.pickWithRay(ray, m => navMeshSet.has(m as any))?.pickedPoint || null;
              });

              if ((ptLeft && !ptRight) || (!ptLeft && ptRight)) {
                moveToPos = (ptLeft || ptRight)?.clone();
                break;
              }
            }
          }
        }
        //
        else {
          moveToPos = stubNpcMesh.position.add(scaledMoveForward);
        }

        if (moveToPos) {
          switchAnimation('walk');

          const displacement = moveToPos.subtract(stubNpcMesh.position);
          stubNpcMesh.moveWithCollisions(displacement);

          ctx.output.position = toOuterVec(stubNpcMesh.position, true);
        }

        lastTickTime = curTickTime;
      });
    };

    const stopDirectionWalk = () => {
      switchAnimation('idle');

      if (removeDirectionWalkListen) {
        removeDirectionWalkListen();
        removeDirectionWalkListen = undefined;
      }
    };

    // 动画循环
    removeAniLoopListen = ctx.host.event.listen('beforeRender', () => {
      if (!aniStartTime || !curAniType) return;

      let frameStartNo = 0;
      let frameEndNo = 0;
      let aniName: string | undefined;

      if (curAniType === 'idle') {
        frameStartNo = ctx.input.idleAniRange?.x || 0;
        frameEndNo = ctx.input.idleAniRange?.y || 0;
        aniName = ctx.input.idleAni;
      }
      //
      else if (curAniType === 'walk') {
        frameStartNo = ctx.input.walkAniRange?.x || 0;
        frameEndNo = ctx.input.walkAniRange?.y || 0;
        aniName = ctx.input.walkAni;
      }
      //
      else return;

      const aniGroup: AnimationGroup | undefined = aniName ? ctx.input.animator?.[aniName] : undefined;
      if (!aniGroup) return;

      const duration = getCurrentTimestamp() - aniStartTime;
      const frameDelta = (duration / 1000) * 60;
      const frameNo = frameStartNo + frameDelta;

      if (frameNo > frameEndNo) {
        // 重新开始动画
        aniStartTime = getCurrentTimestamp();
        return;
      }

      // 解算动画片段具体帧
      aniGroup.targetedAnimations.forEach(ani => {
        const v = ani.animation.evaluate(frameNo);
        setData(ani.target, ani.animation.targetPropertyPath, v);
      });
    });

    ctx.event.listen('input:change:targetPosition', () => {
      buildNavPoints();
      startNavPointsWalk();
    });

    ctx.event.listen('input:change:ground', () => {
      loadNavMeshData();
      buildNavPoints();
      startNavPointsWalk();
    });

    ctx.event.listen('input:change:targetDirection', () => {
      const _needMove = ctx.input.targetDirection && ctx.input.targetDirection.lengthSquared() > 0;

      if (_needMove && !removeDirectionWalkListen) startDirectionWalk();
      else if (!_needMove && removeDirectionWalkListen) stopDirectionWalk();
    });

    ctx.event.listen('input:change:position', flush_pos);
    ctx.event.listen('input:change:rotation', flush_rotation);
    ctx.event.listen('input:change:obstacle', flush_obstacle);
    ctx.event.listen('input:change:ellipsoid', flush_ellipsoid);
    ctx.event.listen('input:change:ellipsoidOffset', flush_ellipsoid);

    flush_pos();
    flush_rotation();
    flush_ellipsoid();
    flush_obstacle();

    loadNavMeshData();
    buildNavPoints();
    startNavPointsWalk();

    ctx.output.loaded = true;

    return () => {
      stubNpcMesh.dispose();

      stopNavPointsWalk();
      stopDirectionWalk();

      if (removeAniLoopListen) removeAniLoopListen();
      // if (recastNav) disposeRecastInstance(recastNav);
    };
  },
});
