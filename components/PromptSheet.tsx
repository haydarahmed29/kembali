"use client";

import { useEffect, useState } from "react";
import { usePromptSheetStore } from "@/lib/promptSheet";

/**
 * The one in-app replacement for window.prompt()/window.confirm() across the whole app — a
 * bottom sheet styled like every other card/modal here, instead of the browser's native (and
 * on Android, theme-inverted) popup. Mounted once in app/layout.tsx; pages call promptFields()
 * from lib/promptSheet to open it.
 */
export default function PromptSheet() {
  const { open, title, fields, confirmLabel, close } = usePromptSheetStore();
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const initial: Record<string, string> = {};
    for (const f of fields) initial[f.key] = f.defaultValue ?? "";
    setValues(initial);
  }, [open, fields]);

  if (!open) return null;

  function submit() {
    for (const f of fields) {
      if (!f.optional && !values[f.key]?.trim()) {
        close(null);
        return;
      }
    }
    close(values);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button type="button" aria-label="Tutup" onClick={() => close(null)} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-[480px] bg-white rounded-t-[28px] p-5 pb-7 flex flex-col gap-3.5 max-h-[85vh] overflow-y-auto">
        <div className="w-10 h-1.5 rounded-full bg-kb-border mx-auto -mt-1" />
        {title && <div className="text-[17px] font-bold">{title}</div>}
        {fields.map((f) => (
          <div key={f.key} className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-[#3F4F44]">{f.label}</label>
            {f.type === "textarea" ? (
              <textarea
                autoFocus={fields[0]?.key === f.key}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="min-h-24 rounded-2xl border border-kb-border px-3.5 py-3 text-sm bg-kb-card resize-none"
              />
            ) : (
              <input
                autoFocus={fields[0]?.key === f.key}
                type={f.type === "number" ? "number" : "text"}
                inputMode={f.type === "number" ? "numeric" : undefined}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder={f.placeholder}
                className="h-12 border border-kb-border rounded-2xl px-3.5 text-[15px] bg-kb-card"
              />
            )}
          </div>
        ))}
        <div className="flex gap-2.5 mt-1.5">
          <button type="button" onClick={() => close(null)} className="flex-1 h-12 rounded-2xl bg-kb-card text-kb-muted font-bold text-sm">
            Batal
          </button>
          <button type="button" onClick={submit} className="flex-1 h-12 rounded-2xl bg-kb-lime text-kb-ink font-bold text-sm">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
