"use client";

import { create } from "zustand";

export interface PromptField {
  key: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  type?: "text" | "number" | "textarea";
  optional?: boolean; // if false (default) and left empty, resolve(null) on submit
}

interface PromptSheetState {
  open: boolean;
  title: string | null;
  fields: PromptField[];
  confirmLabel: string;
  resolve: ((value: Record<string, string> | null) => void) | null;
}

interface PromptSheetStore extends PromptSheetState {
  show: (opts: { title?: string; fields: PromptField[]; confirmLabel?: string }) => Promise<Record<string, string> | null>;
  close: (value: Record<string, string> | null) => void;
}

export const usePromptSheetStore = create<PromptSheetStore>((set, get) => ({
  open: false,
  title: null,
  fields: [],
  confirmLabel: "Simpan",
  resolve: null,
  show: ({ title, fields, confirmLabel }) =>
    new Promise((resolve) => {
      set({ open: true, title: title ?? null, fields, confirmLabel: confirmLabel ?? "Simpan", resolve });
    }),
  close: (value) => {
    const { resolve } = get();
    set({ open: false, resolve: null });
    resolve?.(value);
  },
}));

/**
 * Drop-in-ish replacement for a chain of window.prompt() calls: shows one styled bottom sheet
 * with every field at once instead of N sequential native browser popups. Resolves null if the
 * user cancels, or if a required field was left empty.
 */
export function promptFields(fields: PromptField[], opts?: { title?: string; confirmLabel?: string }) {
  return usePromptSheetStore.getState().show({ title: opts?.title, fields, confirmLabel: opts?.confirmLabel });
}

/** Single-field convenience wrapper, close to the old window.prompt(message, default) shape. */
export async function promptField(
  label: string,
  defaultValue = "",
  opts?: { type?: PromptField["type"]; optional?: boolean; placeholder?: string }
): Promise<string | null> {
  const result = await promptFields([
    { key: "value", label, defaultValue, type: opts?.type, optional: opts?.optional, placeholder: opts?.placeholder },
  ]);
  return result ? (result.value ?? "") : null;
}
