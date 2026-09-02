import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';

const COLUMN_CONFIG = {
  line_code: { fallback: 'Line Code', type: 'text', defaultWidth: 112 },
  description: { fallback: 'Item Description', type: 'text', defaultWidth: 256 },
  specification: { fallback: 'Specification', type: 'text', defaultWidth: 224 },
  comment: { fallback: 'Comment', type: 'text', defaultWidth: 224 },
  quantity: { fallback: 'Qty', type: 'number', defaultWidth: 96 },
  uom: { fallback: 'UOM', type: 'text', defaultWidth: 96 },
  unit_price: { fallback: 'Unit Price', type: 'number', defaultWidth: 128 },
  discount: { fallback: 'Discount', type: 'number', defaultWidth: 112 },
  total_price: { fallback: 'Total Price', type: 'calculated', defaultWidth: 128 },
};

const blankRow = (index) => ({
  line_code: String(index + 1).padStart(3, '0'),
  description: '',
  specification: '',
  comment: '',
  quantity: 1,
  uom: '',
  unit_price: 0,
  discount: 0,
});

const numericValue = (value) => {
  const parsed = Number(String(value ?? '').replaceAll(',', ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const cellReference = (row, column) => `${String.fromCharCode(65 + column)}${row + 1}`;

const PurchaseOrderPriceSpreadsheet = ({ items, headers, currency, onItemsChange, onHeaderChange, onAddColumn, onRemoveColumn }) => {
  const gridRef = useRef(null);
  const previousColumnKeysRef = useRef(Object.keys(headers).filter((key) => !key.startsWith('__')));
  const [columnWidths, setColumnWidths] = useState(headers.__column_widths || {});
  const [rowHeights, setRowHeights] = useState(() => Object.fromEntries(
    (items || []).map((item, index) => [index, Number(item.__row_height) || 42]),
  ));
  const [activeCell, setActiveCell] = useState({ row: 0, column: 0 });
  const rows = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const columnOrder = useMemo(() => (Array.isArray(headers.__column_order)
    ? headers.__column_order
    : Object.keys(headers).filter((key) => !key.startsWith('__'))), [headers]);
  const columns = useMemo(() => columnOrder.filter((key) => Object.hasOwn(headers, key)).map((key) => ({
    key,
    ...(COLUMN_CONFIG[key] || { fallback: headers[key] || 'Custom Column', type: 'text', defaultWidth: 176 }),
  })), [columnOrder, headers]);
  const editableColumns = useMemo(() => columns.filter((column) => column.type !== 'calculated'), [columns]);
  const selectedColumn = editableColumns[activeCell.column];
  const activeValue = rows[activeCell.row]?.[selectedColumn?.key] ?? '';

  useEffect(() => {
    const previousKeys = previousColumnKeysRef.current;
    const newColumn = columnOrder.find((key) => !previousKeys.includes(key));
    previousColumnKeysRef.current = columnOrder;
    if (!newColumn) return;
    window.requestAnimationFrame(() => {
      const input = gridRef.current?.querySelector(`[data-column-header="${newColumn}"]`);
      input?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      input?.focus();
      input?.select();
    });
  }, [columnOrder]);

  const totals = useMemo(() => rows.map((item) => Math.max(
    0,
    numericValue(item.quantity) * numericValue(item.unit_price) - numericValue(item.discount),
  )), [rows]);

  useEffect(() => {
    setColumnWidths(headers.__column_widths || {});
  }, [headers.__column_widths]);

  useEffect(() => {
    setRowHeights(Object.fromEntries(rows.map((item, index) => [index, Number(item.__row_height) || 42])));
  }, [rows]);

  const startColumnResize = (event, column) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = Number(columnWidths[column.key]) || column.defaultWidth;
    let finalWidth = startWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const move = (moveEvent) => {
      finalWidth = Math.min(520, Math.max(70, startWidth + moveEvent.clientX - startX));
      setColumnWidths((previous) => ({ ...previous, [column.key]: finalWidth }));
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      onHeaderChange('__column_widths', { ...columnWidths, [column.key]: finalWidth });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  };

  const autoFitColumn = (column) => {
    const values = rows.map((row) => String(row[column.key] ?? ''));
    const longest = Math.max(String(headers[column.key] || column.fallback).length, ...values.map((value) => value.length));
    const width = Math.min(520, Math.max(70, longest * 8 + 54));
    const nextWidths = { ...columnWidths, [column.key]: width };
    setColumnWidths(nextWidths);
    onHeaderChange('__column_widths', nextWidths);
  };

  const startRowResize = (event, rowIndex) => {
    event.preventDefault();
    event.stopPropagation();
    const startY = event.clientY;
    const startHeight = Number(rowHeights[rowIndex]) || 42;
    let finalHeight = startHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    const move = (moveEvent) => {
      finalHeight = Math.min(240, Math.max(32, startHeight + moveEvent.clientY - startY));
      setRowHeights((previous) => ({ ...previous, [rowIndex]: finalHeight }));
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      onItemsChange(rows.map((row, index) => index === rowIndex ? { ...row, __row_height: finalHeight } : row));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  };

  const resetRowHeight = (rowIndex) => {
    setRowHeights((previous) => ({ ...previous, [rowIndex]: 42 }));
    onItemsChange(rows.map((row, index) => index === rowIndex ? { ...row, __row_height: 42 } : row));
  };

  const updateCell = (rowIndex, key, value) => {
    const nextRows = rows.map((row, index) => index === rowIndex
      ? { ...row, [key]: ['quantity', 'unit_price', 'discount'].includes(key) ? numericValue(value) : value }
      : row);
    onItemsChange(nextRows);
  };

  const focusCell = (row, column) => {
    if (!rows.length) return;
    const boundedRow = Math.min(rows.length - 1, Math.max(0, row));
    const boundedColumn = Math.min(editableColumns.length - 1, Math.max(0, column));
    setActiveCell({ row: boundedRow, column: boundedColumn });
    window.requestAnimationFrame(() => {
      const input = gridRef.current?.querySelector(`[data-cell="${boundedRow}-${boundedColumn}"]`);
      input?.focus();
      input?.select();
    });
  };

  const handleKeyDown = (event, row, column) => {
    const input = event.currentTarget;
    if (event.key === 'Enter') {
      event.preventDefault();
      focusCell(event.shiftKey ? row - 1 : row + 1, column);
    } else if (event.key === 'Tab') {
      event.preventDefault();
      const direction = event.shiftKey ? -1 : 1;
      const linearIndex = row * editableColumns.length + column + direction;
      focusCell(
        Math.floor(Math.max(0, linearIndex) / editableColumns.length),
        (Math.max(0, linearIndex) % editableColumns.length),
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusCell(row - 1, column);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusCell(row + 1, column);
    } else if (event.key === 'ArrowLeft' && input.selectionStart === 0 && input.selectionEnd === 0) {
      event.preventDefault();
      focusCell(row, column - 1);
    } else if (event.key === 'ArrowRight' && input.selectionStart === input.value.length) {
      event.preventDefault();
      focusCell(row, column + 1);
    }
  };

  const handlePaste = (event, startRow, startColumn) => {
    const clipboard = event.clipboardData.getData('text/plain');
    if (!clipboard) return;
    event.preventDefault();
    const pastedRows = clipboard.replace(/\r/g, '').replace(/\n$/, '').split('\n')
      .map((line) => line.split('\t'));
    const requiredRows = Math.min(100, Math.max(rows.length, startRow + pastedRows.length));
    const nextRows = Array.from({ length: requiredRows }, (_, index) => ({
      ...(rows[index] || blankRow(index)),
    }));

    pastedRows.forEach((pastedRow, rowOffset) => {
      pastedRow.forEach((value, columnOffset) => {
        const column = editableColumns[startColumn + columnOffset];
        const targetRow = startRow + rowOffset;
        if (!column || targetRow >= requiredRows) return;
        nextRows[targetRow][column.key] = column.type === 'number' ? numericValue(value) : value.trim();
      });
    });
    onItemsChange(nextRows);
    focusCell(startRow, startColumn);
  };

  const addRow = () => {
    if (rows.length >= 100) return;
    const nextRows = [...rows, blankRow(rows.length)];
    onItemsChange(nextRows);
    window.requestAnimationFrame(() => focusCell(nextRows.length - 1, 0));
  };

  const duplicateRow = (index) => {
    if (rows.length >= 100) return;
    const copy = { ...rows[index], line_code: String(rows.length + 1).padStart(3, '0') };
    onItemsChange([...rows.slice(0, index + 1), copy, ...rows.slice(index + 1)]);
  };

  const removeRow = (index) => {
    const nextRows = rows.filter((_, rowIndex) => rowIndex !== index);
    onItemsChange(nextRows);
    setActiveCell({ row: Math.max(0, Math.min(index, nextRows.length - 1)), column: activeCell.column });
  };

  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="w-16 rounded border border-slate-300 bg-white px-2 py-1.5 text-center font-mono text-xs font-semibold text-blue-700">{rows.length ? cellReference(activeCell.row, activeCell.column) : '—'}</div>
        <span className="text-slate-300">fx</span>
        <input
          type={selectedColumn?.type || 'text'}
          value={activeValue}
          disabled={!rows.length}
          onChange={(event) => selectedColumn && updateCell(activeCell.row, selectedColumn.key, event.target.value)}
          className="min-w-48 flex-1 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-slate-100"
          aria-label="Active cell value"
        />
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="hidden text-slate-500 md:inline">Paste rows directly from Excel · Enter moves down · Tab moves right</span>
        <button type="button" onClick={addRow} disabled={rows.length >= 100} className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">+ Add Row</button>
      </div>
    </div>

    <div ref={gridRef} className="max-h-[430px] overflow-auto">
      <table style={{ minWidth: `${columns.reduce((sum, column) => sum + (Number(columnWidths[column.key]) || column.defaultWidth), 0) + 144}px` }} className="table-fixed border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-20 bg-slate-100">
          <tr>
            <th className="sticky left-0 z-30 w-12 border-b border-r border-slate-300 bg-slate-100 px-2 py-2 text-center text-[10px] font-bold text-slate-500">#</th>
            {columns.map((column) => <th key={column.key} style={{ width: `${Number(columnWidths[column.key]) || column.defaultWidth}px` }} className="relative border-b border-r border-slate-300 p-1.5">
              <div className="flex items-center gap-1">
                <input data-column-header={column.key} type="text" value={headers[column.key] ?? column.fallback} onChange={(event) => onHeaderChange(column.key, event.target.value)} className="min-w-0 flex-1 rounded border border-blue-200 bg-white px-2 py-1.5 text-[10px] font-semibold uppercase text-slate-600 focus:border-blue-500 focus:ring-blue-500" />
                <div className="flex shrink-0 flex-col overflow-hidden rounded border border-slate-300 bg-white"><button type="button" onClick={() => onAddColumn(column.key)} title={`Add column after ${headers[column.key] || column.fallback}`} className="h-[14px] px-1 text-[10px] font-bold leading-none text-blue-600 hover:bg-blue-100">+</button><button type="button" onClick={() => onRemoveColumn(column.key)} disabled={columns.length <= 1} title={`Remove ${headers[column.key] || column.fallback}`} className="h-[14px] border-t border-slate-200 px-1 text-[10px] font-bold leading-none text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white">−</button></div>
              </div>
              <button type="button" aria-label={`Resize ${headers[column.key] || column.fallback} column`} title="Drag to resize · double-click to auto-fit" onPointerDown={(event) => startColumnResize(event, column)} onDoubleClick={() => autoFitColumn(column)} className="absolute -right-1 top-0 z-40 h-full w-2 cursor-col-resize touch-none hover:bg-blue-400/60" />
            </th>)}
            <th className="w-24 border-b border-slate-300 p-2 text-center text-[10px] font-bold uppercase text-slate-500">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, rowIndex) => <tr key={`${item.line_code || 'row'}-${rowIndex}`} style={{ height: `${Number(rowHeights[rowIndex]) || 42}px` }} className="group hover:bg-blue-50/40">
            <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-2 text-center font-mono text-xs font-medium text-slate-500 group-hover:bg-blue-50"><span>{rowIndex + 1}</span><button type="button" aria-label={`Resize row ${rowIndex + 1}`} title="Drag to resize row · double-click to reset" onPointerDown={(event) => startRowResize(event, rowIndex)} onDoubleClick={() => resetRowHeight(rowIndex)} className="absolute bottom-[-4px] left-0 z-20 h-2 w-full cursor-row-resize touch-none hover:bg-blue-400/60" /></th>
            {columns.map((column) => {
              if (column.type === 'calculated') return <td key={column.key} className="border-b border-r border-slate-200 px-3 py-2 text-right font-mono text-sm font-bold text-slate-800">{currency} {totals[rowIndex].toFixed(2)}</td>;
              const columnIndex = editableColumns.findIndex((editableColumn) => editableColumn.key === column.key);
              const isActive = activeCell.row === rowIndex && activeCell.column === columnIndex;
              return <td key={column.key} className={`border-b border-r border-slate-200 p-1 ${isActive ? 'bg-blue-50 ring-2 ring-inset ring-blue-500' : ''}`}>
                <input
                  data-cell={`${rowIndex}-${columnIndex}`}
                  type={column.type}
                  min={column.type === 'number' ? 0 : undefined}
                  step={column.type === 'number' ? '0.01' : undefined}
                  value={item[column.key] ?? ''}
                  onFocus={(event) => { setActiveCell({ row: rowIndex, column: columnIndex }); event.currentTarget.select(); }}
                  onChange={(event) => updateCell(rowIndex, column.key, event.target.value)}
                  onKeyDown={(event) => handleKeyDown(event, rowIndex, columnIndex)}
                  onPaste={(event) => handlePaste(event, rowIndex, columnIndex)}
                  className={`h-full w-full border-0 bg-transparent px-2 py-2 text-sm outline-none focus:ring-0 ${column.type === 'number' ? 'text-right font-mono' : ''}`}
                />
              </td>;
            })}
            <td className="border-b border-slate-200 px-2 py-1 text-center"><div className="flex justify-center gap-1"><button type="button" onClick={() => duplicateRow(rowIndex)} title="Duplicate row" className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-100">Copy</button><button type="button" onClick={() => removeRow(rowIndex)} title="Delete row" className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-100">Delete</button></div></td>
          </tr>)}
          {!rows.length && <tr><td colSpan={columns.length + 2} className="px-4 py-14 text-center"><p className="text-sm text-slate-500">No pricing rows yet.</p><button type="button" onClick={addRow} className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700">Add the first row</button></td></tr>}
        </tbody>
      </table>
    </div>
    <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500"><span>{rows.length} row{rows.length === 1 ? '' : 's'} · maximum 100</span><span>Drag column edges or row bottoms to resize · double-click a handle to auto-fit/reset</span></div>
  </div>;
};

PurchaseOrderPriceSpreadsheet.propTypes = {
  items: PropTypes.arrayOf(PropTypes.object),
  headers: PropTypes.object.isRequired,
  currency: PropTypes.string,
  onItemsChange: PropTypes.func.isRequired,
  onHeaderChange: PropTypes.func.isRequired,
  onAddColumn: PropTypes.func.isRequired,
  onRemoveColumn: PropTypes.func.isRequired,
};

PurchaseOrderPriceSpreadsheet.defaultProps = { items: [], currency: 'AED' };

export default PurchaseOrderPriceSpreadsheet;
