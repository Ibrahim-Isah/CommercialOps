"use client";

import * as React from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/** One column of an import template: the JSON key plus guidance for the user. */
export interface TemplateColumn {
  key: string;
  example?: string | number;
  required?: boolean;
  notes?: string;
}

/** Cell → trimmed string ("" when empty); numbers keep their digits. */
export function cellStr(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (v instanceof Date) return cellDate(v);
  return String(v).trim();
}

/**
 * Cell → yyyy-mm-dd. Handles JS Dates (from cellDates parsing), raw Excel
 * date serials, and strings typed directly into the sheet.
 */
export function cellDate(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return [
      v.getFullYear(),
      String(v.getMonth() + 1).padStart(2, "0"),
      String(v.getDate()).padStart(2, "0"),
    ].join("-");
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    // Excel serial: days since 1900-01-00 (25569 days before the Unix epoch).
    const d = new Date(Math.round((v - 25569) * 86400000));
    return [
      d.getUTCFullYear(),
      String(d.getUTCMonth() + 1).padStart(2, "0"),
      String(d.getUTCDate()).padStart(2, "0"),
    ].join("-");
  }
  return typeof v === "string" ? v.trim() : "";
}

/** Match a cell against a fixed option list, ignoring case; falls back to the raw string so the API can report the invalid value. */
export function cellOption<T extends string>(v: unknown, options: readonly T[]): string {
  const s = cellStr(v);
  return options.find((o) => o.toLowerCase() === s.toLowerCase()) ?? s;
}

interface ImportFailure {
  row: number;
  message: string;
}

export function ExcelMenu({
  entity,
  fileName,
  columns,
  importRow,
  onImported,
}: {
  /** Plural, lower case — used in toasts, e.g. "vendors". */
  entity: string;
  /** Template download name, e.g. "vendors-template.xlsx". */
  fileName: string;
  columns: TemplateColumn[];
  /** Import one sheet row; throw an Error with a user-readable message to fail it. */
  importRow: (row: Record<string, unknown>) => Promise<void>;
  /** Called after at least one row imported, so the page can reload. */
  onImported: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  function downloadTemplate() {
    const wb = XLSX.utils.book_new();

    const data = XLSX.utils.aoa_to_sheet([
      columns.map((c) => c.key),
      columns.map((c) => c.example ?? ""),
    ]);
    data["!cols"] = columns.map((c) => ({
      wch: Math.max(c.key.length + 2, String(c.example ?? "").length + 2, 12),
    }));
    XLSX.utils.book_append_sheet(wb, data, "Data");

    const guide = XLSX.utils.aoa_to_sheet([
      ["Field", "Required", "Notes"],
      ...columns.map((c) => [c.key, c.required ? "Yes" : "No", c.notes ?? ""]),
      [],
      [
        "Fill the Data sheet. Keep the header row unchanged — row 2 is an example, replace it with real data.",
      ],
    ]);
    guide["!cols"] = [{ wch: 28 }, { wch: 10 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, guide, "Guide");

    XLSX.writeFile(wb, fileName);
    setOpen(false);
  }

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
      const sheetName = wb.SheetNames.includes("Data")
        ? "Data"
        : wb.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        wb.Sheets[sheetName],
        { defval: "" }
      );
      const dataRows = rows.filter((r) =>
        Object.values(r).some((v) => cellStr(v) !== "")
      );
      if (dataRows.length === 0) {
        toast.error(
          `No data rows found. Fill the Data sheet of the ${entity} template and upload it again.`
        );
        return;
      }

      let ok = 0;
      const failures: ImportFailure[] = [];
      for (const row of dataRows) {
        // sheet_to_json tags each row with its 0-based sheet index.
        const rowNum =
          ((row as { __rowNum__?: number }).__rowNum__ ?? 0) + 1;
        try {
          await importRow(row);
          ok++;
        } catch (e) {
          failures.push({
            row: rowNum,
            message: e instanceof Error ? e.message : "Import failed.",
          });
        }
      }

      if (failures.length === 0) {
        toast.success(`Imported ${ok} ${entity} from ${file.name}.`);
      } else {
        const detail = failures
          .slice(0, 3)
          .map((f) => `Row ${f.row}: ${f.message}`)
          .join("\n");
        const more =
          failures.length > 3 ? `\n…and ${failures.length - 3} more.` : "";
        toast.error(
          `Imported ${ok} of ${dataRows.length} ${entity}. ${failures.length} row(s) failed.`,
          { description: detail + more, duration: 10000 }
        );
      }
      if (ok > 0) onImported();
    } catch {
      toast.error(
        "Could not read that file. Upload an .xlsx file based on the downloaded template."
      );
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" disabled={busy}>
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            )}
            Excel
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-1">
          <button
            type="button"
            className="flex w-full items-start gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-secondary"
            onClick={downloadTemplate}
          >
            <Download className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Download template
              <span className="block text-xs text-muted-foreground">
                Excel sheet with the {entity} fields and a guide.
              </span>
            </span>
          </button>
          <button
            type="button"
            className="flex w-full items-start gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-secondary"
            onClick={() => {
              setOpen(false);
              fileRef.current?.click();
            }}
          >
            <Upload className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Upload Excel data
              <span className="block text-xs text-muted-foreground">
                Import {entity} from a filled-in template.
              </span>
            </span>
          </button>
        </PopoverContent>
      </Popover>
    </>
  );
}
