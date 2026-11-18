type CsvCell = string | number | null | undefined;

const escapeCell = (cell: CsvCell): string => {
  const text = cell === null || cell === undefined ? '' : String(cell);
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
};

/**
 * 导出二维数据为 CSV（浏览器端，UTF-8 BOM 保证 Excel 中文不乱码）。
 * 用于列表页的用户主动导出；数据由调用方按当前权限可见范围提供。
 */
export function downloadCsv(filename: string, rows: CsvCell[][]): void {
  const csv = rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
