/** 注入令牌：application 以 token 依赖，infrastructure 以 useClass 实现。 */
export const MODEL_GATEWAY_PORT = Symbol('MODEL_GATEWAY_PORT');

/**
 * 模型网关端口：application 消费、infrastructure 实现。
 * 领域层不 import 第三方 SDK，网关与模型的具体类型由 application
 * 以类型参数绑定（当前为 mastra 的 MastraModelGateway / GatewayLanguageModel）。
 */
export interface ModelGatewayPort<TGateway, TModel> {
  /** 按当前 DB 配置构建网关快照（每次调用现读，页面改动即时生效）。 */
  createGateway(): Promise<TGateway>;
  /** 按供应商 slug 与模型 id 解析可调用模型；未注册返回 null。 */
  resolveRegisteredModel(
    providerSlug: string,
    modelId: string,
  ): Promise<TModel | null>;
}
