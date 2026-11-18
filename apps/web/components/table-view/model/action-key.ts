const keys = new WeakMap<object, string>();
let sequence = 0;

/** 按动作实例分配内部展示键，调用方不需要声明业务 id。 */
export function actionKey(action: object): string {
  let key = keys.get(action);
  if (!key) {
    key = `action-${++sequence}`;
    keys.set(action, key);
  }
  return key;
}
