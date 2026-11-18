import { ERROR_CODE } from '@cip/shared';
import { DomainError } from './domain.error';

/**
 * 角色聚合：平台级授权角色与权限点授予关系。
 * 不变量：内置角色（isBuiltin）不可修改权限授予关系、不可删除。
 */
export class Role {
  readonly id: string;

  readonly #code: string;
  #name: string;
  #description: string | null;
  readonly #isBuiltin: boolean;
  #permissionCodes: string[];

  private constructor(
    id: string,
    code: string,
    name: string,
    description: string | null,
    isBuiltin: boolean,
    permissionCodes: string[],
  ) {
    this.id = id;
    this.#code = code;
    this.#name = name;
    this.#description = description;
    this.#isBuiltin = isBuiltin;
    this.#permissionCodes = [...permissionCodes];
  }

  /** 新建后台角色：非内置、无权限点；code 唯一性由应用层在调用前校验。 */
  static register(props: {
    code: string;
    name: string;
    description: string | null;
  }): Role {
    return new Role('', props.code, props.name, props.description, false, []);
  }

  /** 由持久化行重建（infrastructure mapper 专用入口）。 */
  static reconstitute(row: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    isBuiltin: boolean;
    permissionCodes: string[];
  }): Role {
    const entity = new Role(
      row.id,
      row.code,
      row.name,
      row.description,
      row.isBuiltin,
      row.permissionCodes,
    );
    return entity;
  }

  /** 变更前守卫：内置角色不可修改权限授予关系。 */
  ensureMutable(): void {
    if (this.#isBuiltin) {
      throw new DomainError(
        ERROR_CODE.role.builtinProtected,
        '内置角色不可修改权限',
      );
    }
  }

  /** 删除前守卫：内置角色不可删除。 */
  ensureDeletable(): void {
    if (this.#isBuiltin) {
      throw new DomainError(
        ERROR_CODE.role.builtinProtected,
        '内置角色不可删除',
      );
    }
  }

  rename(name: string, description: string | null): void {
    this.#name = name;
    this.#description = description;
  }

  /** 全量替换权限点授予关系；存在性/active 校验由应用层在调用前完成。 */
  grantPermissions(permissionCodes: string[]): void {
    this.ensureMutable();
    this.#permissionCodes = [...new Set(permissionCodes)];
  }

  get code(): string {
    return this.#code;
  }

  get name(): string {
    return this.#name;
  }

  get description(): string | null {
    return this.#description;
  }

  get permissionCodes(): string[] {
    return [...this.#permissionCodes];
  }
}
