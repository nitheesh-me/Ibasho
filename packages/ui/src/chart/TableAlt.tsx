/**
 * Chart primitives: `ChartFrame` and `TableAlt` (DESIGN_SYSTEM 8, 12; UX 11). Owner: WP-06.
 *
 * Every chart has a one sentence summary and a table alternative, and the person can switch
 * between them. Table cells that hold numbers are evidence ids rendered as `Num`, so the table is
 * as traceable as the chart.
 */
import type { EvidenceId } from '@ibasho/core';
import { type ReactNode, useId, useState } from 'react';
import { Num, type NumProps } from '../num/Num.tsx';

/** A cell: plain words, or a number by its evidence id. */
export type TableCell =
  | string
  | { ev: EvidenceId; signed?: boolean; delta?: NumProps['delta']; as?: NumProps['as'] }
  | null;

export interface TableAltData {
  caption: string;
  /** Column headings after the row heading column. */
  columns: string[];
  /** Heading of the row heading column. */
  rowHeading: string;
  rows: { key: string; head: ReactNode; cells: TableCell[] }[];
}

export function TableAlt({ data }: { data: TableAltData }) {
  return (
    <table className="ib-table" data-table-alt="">
      <caption className="ib-table__caption">{data.caption}</caption>
      <thead>
        <tr>
          <th scope="col">{data.rowHeading}</th>
          {data.columns.map((c) => (
            <th key={c} scope="col">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.rows.map((r) => (
          <tr key={r.key}>
            <th scope="row">{r.head}</th>
            {r.cells.map((c, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: cells are positional under fixed columns
              <td key={i}>
                {c === null ? (
                  <span className="ib-table__none">None</span>
                ) : typeof c === 'string' ? (
                  c
                ) : (
                  <Num
                    ev={c.ev}
                    size="ui"
                    {...(c.signed ? { signed: true } : {})}
                    {...(c.delta ? { delta: c.delta } : {})}
                    {...(c.as ? { as: c.as } : {})}
                  />
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export interface ChartFrameProps {
  /** Short visible title. */
  title?: ReactNode;
  /** One plain sentence saying what the chart shows (required, DS 12). */
  summary: ReactNode;
  /** The table alternative (required, DS 8). */
  table: TableAltData;
  /** Start on the table. */
  defaultView?: 'chart' | 'table';
  /** Extra controls or a legend under the chart. */
  legend?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function ChartFrame({
  title,
  summary,
  table,
  defaultView = 'chart',
  legend,
  className,
  children,
}: ChartFrameProps) {
  const [view, setView] = useState(defaultView);
  const summaryId = useId();
  return (
    <figure
      className={['ib-chart', className].filter(Boolean).join(' ')}
      data-view={view}
      aria-describedby={summaryId}
    >
      <div className="ib-chart__head">
        {title ? <div className="ib-chart__title">{title}</div> : null}
        <button
          type="button"
          className="ib-link-button ib-chart__toggle"
          aria-pressed={view === 'table'}
          onClick={() => setView(view === 'chart' ? 'table' : 'chart')}
        >
          {view === 'chart' ? 'Show as table' : 'Show as chart'}
        </button>
      </div>
      <figcaption id={summaryId} className="ib-chart__summary">
        {summary}
      </figcaption>
      {view === 'chart' ? (
        <div className="ib-chart__body">
          {children}
          {legend ? <div className="ib-chart__legend">{legend}</div> : null}
        </div>
      ) : (
        <div className="ib-chart__body ib-chart__body--table">
          <TableAlt data={table} />
        </div>
      )}
    </figure>
  );
}
