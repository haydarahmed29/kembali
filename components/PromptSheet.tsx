"use client";

import { useEffect, useState } from "react";
import { usePromptSheetStore } from "@/lib/promptSheet";

/**
 * The one in-app replacement for the browser's prompt/confirm/alert popups — a bottom sheet
 * styled like every other card here. Mounted once in app/layout.tsx; pages open it through
 * promptFields / promptField / confirmSheet / alertSheet in lib/promptSheet.
 */
export default function PromptSheet() {
  const { open, mode, title, message, fields, confirmLabel, danger, close } = usePromptSheetStore();
  const [values, setValues] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    const initial: Record<string, string> = {};
    for (const f of fields) initial[f.key] = f.defaultValue ?? "";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the form each time the sheet opens
    setValues(initial);
    setMissing(new Set());
  }, [open, fields]);

  if (!open) return null;

  function submit() {
    if (mode !== "prompt") {
      close({});
      return;
    }
    const empty = new Set(fields.filter((f) => !f.optional && !values[f.key]?.trim()).map((f) => f.key));
    if (empty.size > 0) {
      setMissing(empty); // keep the sheet open and point at what's missing
      return;
    }
    close(values);
  }

  const confirmClass = danger ? "bg-red-600 text-white" : "bg-kb-lime text-kb-ink";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button type="button" aria-label="Tutup" onClick={() => close(null)} className="absolute inset-0 bg-black/40" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[480px] bg-white rounded-t-[28px] p-5 pb-7 flex flex-col gap-3.5 max-h-[85vh] overflow-y-auto"
      >
        <div className="w-10 h-1.5 rounded-full bg-kb-border mx-auto -mt-1" />
        {title && <div className="text-[17px] font-bold">{title}</div>}
        {message && <p className="m-0 text-sm text-[#3F4F44] leading-relaxed">{message}</p>}
        {mode === "prompt" &&
          fields.map((f) => {
            const isMissing = missing.has(f.key);
            const border = isMissing ? "border-red-500" : "border-kb-border";
            const onChange = (v: string) => {
              setValues((prev) => ({ ...prev, [f.key]: v }));
              if (isMissing && v.trim()) setMissing((m) => { const n = new Set(m); n.delete(f.key); return n; });
            };
            return (
              <div key={f.key} className="flex flex-col gap-1.5">
                <label htmlFor={`ps-${f.key}`} className="text-[13px] font-semibold text-[#3F4F44]">
                  {f.label}
                  {f.optional && <span className="font-normal text-kb-muted"> (opsional)</span>}
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    id={`ps-${f.key}`}
                    autoFocus={fields[0]?.key === f.key}
                    value={values[f.key] ?? ""}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={f.placeholder}
                    className={`min-h-24 rounded-2xl border ${border} px-3.5 py-3 text-sm bg-kb-card resize-none`}
                  />
                ) : (
                  <input
                    id={`ps-${f.key}`}
                    autoFocus={fields[0]?.key === f.key}
                    type={f.type === "number" ? "number" : "text"}
                    inputMode={f.type === "number" ? "numeric" : undefined}
                    value={values[f.key] ?? ""}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    placeholder={f.placeholder}
                    className={`h-12 border ${border} rounded-2xl px-3.5 text-[15px] bg-kb-card`}
                  />
                )}
                {isMissing && <span className="text-xs text-red-600">Yang ini wajib diisi ya.</span>}
              </div>
            );
          })}
        <div className="flex gap-2.5 mt-1.5">
          {mode !== "alert" && (
            <button type="button" onClick={() => close(null)} className="flex-1 h-12 rounded-2xl bg-kb-card text-kb-muted font-bold text-sm">
              Batal
            </button>
          )}
          <button type="button" onClick={submit} className={`flex-1 h-12 rounded-2xl font-bold text-sm ${confirmClass}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
