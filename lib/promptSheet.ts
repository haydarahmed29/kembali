"use client";

import { create } from "zustand";

export interface PromptField {
  key: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  type?: "text" | "number" | "textarea";
  optional?: boolean; // required by default: the sheet won't submit while it's empty
}

type Mode = "prompt" | "confirm" | "alert";

interface PromptSheetState {
  open: boolean;
  mode: Mode;
  title: string | null;
  message: string | null;
  fields: PromptField[];
  confirmLabel: string;
  danger: boolean;
  resolve: ((value: Record<string, string> | null) => void) | null;
}

interface ShowOpts {
  mode?: Mode;
  title?: string;
  message?: string;
  fields?: PromptField[];
  confirmLabel?: string;
  danger?: boolean;
}

interface PromptSheetStore extends PromptSheetState {
  show: (opts: ShowOpts) => Promise<Record<string, string> | null>;
  close: (value: Record<string, string> | null) => void;
}

export const usePromptSheetStore = create<PromptSheetStore>((set, get) => ({
  open: false,
  mode: "prompt",
  title: null,
  message: null,
  fields: [],
  confirmLabel: "Simpan",
  danger: false,
  resolve: null,
  show: ({ mode = "prompt", title, message, fields = [], confirmLabel, danger = false }) =>
    new Promise((resolve) => {
      // a sheet already open gets cancelled rather than left hanging
      get().resolve?.(null);
      set({ open: true, mode, title: title ?? null, message: message ?? null, fields, confirmLabel: confirmLabel ?? "Simpan", danger, resolve });
    }),
  close: (value) => {
    const { resolve } = get();
    set({ open: false, resolve: null });
    resolve?.(value);
  },
}));

/** One styled bottom sheet with every field at once. Resolves null if the user cancels. */
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

/** In-app replacement for window.confirm(). */
export async function confirmSheet(message: string, opts?: { title?: string; confirmLabel?: string; danger?: boolean }): Promise<boolean> {
  const result = await usePromptSheetStore.getState().show({
    mode: "confirm",
    title: opts?.title ?? "Yakin?",
    message,
    confirmLabel: opts?.confirmLabel ?? "Ya",
    danger: opts?.danger ?? false,
  });
  return result !== null;
}

/** In-app replacement for window.alert(). */
export async function alertSheet(message: string, title = "Info"): Promise<void> {
  await usePromptSheetStore.getState().show({ mode: "alert", title, message, confirmLabel: "Oke" });
}
