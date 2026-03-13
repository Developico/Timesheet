"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { generateCSV, downloadBlob, reportFilename } from "@/lib/report-export"
import type { ReportResult } from "@/types/reports"

export function ExportBar({ result, groupTasks = false }: { result: ReportResult; groupTasks?: boolean }) {
  const [pdfLoading, setPdfLoading] = useState(false)

  function handleCSV() {
    const csv = generateCSV(result, { groupTasks })
    downloadBlob(csv, reportFilename(result, "csv"), "text/csv;charset=utf-8")
  }

  async function handlePDF() {
    setPdfLoading(true)
    try {
      const res = await fetch("/api/reports/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...result, _options: { groupTasks } }),
      })
      if (!res.ok) throw new Error("PDF generation failed")
      const html = await res.text()
      const w = window.open("", "_blank")
      if (w) {
        w.document.write(html)
        w.document.close()
      }
    } catch {
      // silently fail — user sees no new window
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground mr-1">Export:</span>
      <Button variant="outline" size="sm" onClick={handleCSV}>
        CSV
      </Button>
      <Button variant="outline" size="sm" onClick={handlePDF} disabled={pdfLoading}>
        {pdfLoading ? "Generating…" : "PDF"}
      </Button>
    </div>
  )
}
