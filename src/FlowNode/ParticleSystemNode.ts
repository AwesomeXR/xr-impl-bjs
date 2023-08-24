import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData } from 'ah-flow-node';

export const getParticleSystemNodeRegisterData = (): IFlowNodeTypeRegisterData<'ParticleSystemNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('ParticleSystemNode')!,
  setup(_ctx) {
    return () => {};
  },
});
