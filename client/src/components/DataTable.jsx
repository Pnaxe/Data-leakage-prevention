const COLUMN_WIDTHS = {
  8: ["13.5%", "10.5%", "14.5%", "9.8%", "9.8%", "16.6%", "12.5%", "12.8%"],
  7: ["14%", "16%", "14%", "14%", "14%", "10%", "18%"],
  6: ["18%", "18%", "16%", "16%", "16%", "16%"],
  5: ["22%", "22%", "16%", "16%", "24%"],
  4: ["25%", "25%", "25%", "25%"]
};

function ColGroup({ colCount }) {
  const widths = COLUMN_WIDTHS[colCount] ?? Array.from({ length: colCount }, () => `${100 / colCount}%`);

  return (
    <colgroup>
      {widths.map((width, index) => (
        <col key={index} style={{ width }} />
      ))}
    </colgroup>
  );
}

export default function DataTable({
  columns,
  rows,
  empty = "No data available",
  padRows = 25,
  fill = false
}) {
  const colCount = columns.length;
  const blankCount = padRows > rows.length ? padRows - rows.length : 0;
  const rowKey = (row, index) => row.id ?? row.pk ?? `row-${index}`;

  const tableBody = rows.length === 0 && blankCount === 0 ? (
    <tr>
      <td className="pm-table-empty" colSpan={colCount}>{empty}</td>
    </tr>
  ) : (
    <>
      {rows.map((row, index) => (
        <tr key={rowKey(row, index)}>
          {columns.map((column) => (
            <td key={column.key} className={column.align === "right" ? "pm-numeric" : undefined}>
              {column.render ? column.render(row) : row[column.key]}
            </td>
          ))}
        </tr>
      ))}
      {Array.from({ length: blankCount }).map((_, index) => (
        <tr key={`blank-${index}`} className="pm-table-row-empty" aria-hidden="true">
          {columns.map((column) => (
            <td key={column.key}>&nbsp;</td>
          ))}
        </tr>
      ))}
    </>
  );

  const table = (
    <table className={`pm-table${fill ? " pm-table--sticky-head" : ""}`} data-cols={colCount}>
      <ColGroup colCount={colCount} />
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} className={column.align === "right" ? "pm-numeric" : undefined}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{tableBody}</tbody>
    </table>
  );

  if (fill) {
    return (
      <section className="pm-table-card pm-table-card--fill">
        <div className="pm-table-fill-wrap">
          <div className="pm-table-x-inner">
            <div className="pm-table-body-viewport">{table}</div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="pm-table-card">
      <div className={`pm-table-scroll${padRows ? " pm-table-scroll--fixed" : ""}`}>
        {table}
      </div>
    </section>
  );
}
