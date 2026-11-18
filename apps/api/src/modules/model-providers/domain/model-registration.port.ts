import type { CatalogModelView } from './catalog.port';
import type { ProviderModel } from './provider-model.entity';

/** 模型及初始价格原子注册能力。 */
export const MODEL_REGISTRATION_PORT = Symbol('MODEL_REGISTRATION_PORT');

/** 单项注册结果；重复注册只跳过同一供应商模型。 */
export interface ModelRegistrationPort {
  /** 按目录记录注册模型，并返回创建或跳过结果。 */
  create(
    model: ProviderModel,
    entry: CatalogModelView,
    effectiveFrom: Date,
  ): Promise<'created' | 'skipped'>;
}
