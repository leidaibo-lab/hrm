/** cursor 分页统一返回形态，适用于信息流、动态等无限列表。 */
export interface CursorPage<T> {
  /** 结果条目。 */
  items: T[];
  /** 下一页游标；没有更多数据时为 null。 */
  nextCursor: string | null;
}

/** offset 分页统一返回形态（管理后台），可附 total。 */
export interface OffsetPage<T> {
  /** 结果条目。 */
  items: T[];
  /** 符合条件的记录总数。 */
  total: number;
}
