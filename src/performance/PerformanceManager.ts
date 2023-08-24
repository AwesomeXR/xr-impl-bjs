import { EngineInstrumentation } from '@babylonjs/core/Instrumentation/engineInstrumentation';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation';
import {
  PerfCollectionStrategy,
  type IPerfViewerCollectionStrategy,
} from '@babylonjs/core/Misc/PerformanceViewer/performanceViewerCollectionStrategies';
import { type IFlowHost } from 'ah-flow-node';

type IPrefCounterData = { lastSecAverage: number; total: number; count: number };

export type IPerfData = {
  // engine
  gpuFrameTime: IPrefCounterData;
  shaderCompilationTime: IPrefCounterData;

  // scene
  drawCalls: number;
  fps: number;
  activeMeshes: number;
  activeIndices: number;
  activeBones: number;
  activeParticles: number;
  activeMeshesEvaluationTime: IPrefCounterData;
  animationsTime: IPrefCounterData;
  cameraRenderTime: IPrefCounterData;
  frameTime: IPrefCounterData;
  interFrameTime: IPrefCounterData;
  particlesRenderTime: IPrefCounterData;
  physicsTime: IPrefCounterData;
  renderTargetsRenderTime: IPrefCounterData;
  renderTime: IPrefCounterData;
  spritesRenderTime: IPrefCounterData;
};

export class PerformanceManager {
  private _DrawCalls: IPerfViewerCollectionStrategy;
  private _Fps: IPerfViewerCollectionStrategy;
  private _ActiveMeshes: IPerfViewerCollectionStrategy;
  private _ActiveIndices: IPerfViewerCollectionStrategy;
  private _ActiveBones: IPerfViewerCollectionStrategy;
  private _ActiveParticles: IPerfViewerCollectionStrategy;

  private _engineInst = new EngineInstrumentation(this.host.engine);
  private _sceneInst = new SceneInstrumentation(this.host);

  constructor(private host: IFlowHost) {
    this._engineInst.captureGPUFrameTime = true;
    this._engineInst.captureShaderCompilationTime = true;

    this._DrawCalls = PerfCollectionStrategy.DrawCallsStrategy()(host);
    this._Fps = PerfCollectionStrategy.FpsStrategy()(host);
    this._ActiveMeshes = PerfCollectionStrategy.ActiveMeshesStrategy()(host);
    this._ActiveIndices = PerfCollectionStrategy.ActiveIndicesStrategy()(host);
    this._ActiveBones = PerfCollectionStrategy.ActiveBonesStrategy()(host);
    this._ActiveParticles = PerfCollectionStrategy.ActiveParticlesStrategy()(host);

    this._sceneInst.captureActiveMeshesEvaluationTime = true;
    this._sceneInst.captureAnimationsTime = true;
    this._sceneInst.captureCameraRenderTime = true;
    this._sceneInst.captureFrameTime = true;
    this._sceneInst.captureInterFrameTime = true;
    this._sceneInst.captureParticlesRenderTime = true;
    this._sceneInst.capturePhysicsTime = true;
    this._sceneInst.captureRenderTargetsRenderTime = true;
    this._sceneInst.captureRenderTime = true;
    this._sceneInst.captureSpritesRenderTime = true;
  }

  calc() {
    const perfData: IPerfData = {
      drawCalls: 0,
      fps: 0,
      activeMeshes: 0,
      activeIndices: 0,
      activeBones: 0,
      activeParticles: 0,
      activeMeshesEvaluationTime: { lastSecAverage: 0, total: 0, count: 0 },
      animationsTime: { lastSecAverage: 0, total: 0, count: 0 },
      cameraRenderTime: { lastSecAverage: 0, total: 0, count: 0 },
      frameTime: { lastSecAverage: 0, total: 0, count: 0 },
      interFrameTime: { lastSecAverage: 0, total: 0, count: 0 },
      particlesRenderTime: { lastSecAverage: 0, total: 0, count: 0 },
      physicsTime: { lastSecAverage: 0, total: 0, count: 0 },
      renderTargetsRenderTime: { lastSecAverage: 0, total: 0, count: 0 },
      renderTime: { lastSecAverage: 0, total: 0, count: 0 },
      spritesRenderTime: { lastSecAverage: 0, total: 0, count: 0 },
      gpuFrameTime: { lastSecAverage: 0, total: 0, count: 0 },
      shaderCompilationTime: { lastSecAverage: 0, total: 0, count: 0 },
    };

    // engine
    perfData.gpuFrameTime = this._engineInst.gpuFrameTimeCounter;
    perfData.shaderCompilationTime = this._engineInst.shaderCompilationTimeCounter;

    // scene
    perfData.drawCalls = this._DrawCalls.getData();
    perfData.fps = this._Fps.getData();
    perfData.activeMeshes = this._ActiveMeshes.getData();
    perfData.activeIndices = this._ActiveIndices.getData();
    perfData.activeBones = this._ActiveBones.getData();
    perfData.activeParticles = this._ActiveParticles.getData();

    // Scene Instrumentation
    perfData.activeMeshesEvaluationTime = this._sceneInst.activeMeshesEvaluationTimeCounter;
    perfData.animationsTime = this._sceneInst.animationsTimeCounter;
    perfData.cameraRenderTime = this._sceneInst.cameraRenderTimeCounter;
    perfData.frameTime = this._sceneInst.frameTimeCounter;
    perfData.interFrameTime = this._sceneInst.interFrameTimeCounter;
    perfData.particlesRenderTime = this._sceneInst.particlesRenderTimeCounter;
    perfData.physicsTime = this._sceneInst.physicsTimeCounter;
    perfData.renderTargetsRenderTime = this._sceneInst.renderTargetsRenderTimeCounter;
    perfData.renderTime = this._sceneInst.renderTimeCounter;
    perfData.spritesRenderTime = this._sceneInst.spritesRenderTimeCounter;

    return perfData;
  }

  dispose(): void {
    this._DrawCalls.dispose();
    this._Fps.dispose();
    this._ActiveMeshes.dispose();
    this._ActiveIndices.dispose();
    this._ActiveBones.dispose();
    this._ActiveParticles.dispose();

    this._engineInst.dispose();
    this._sceneInst.dispose();
  }
}
