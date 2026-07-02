"use client";

import { createContext, useContext } from "react";

export interface CodePanelCtx {
  /** code currently shown in the right splitscreen (null = none) */
  panelCode: string | null;
  openInPanel: (code: string, lang: string) => void;
  closePanel: () => void;
}

export const CodePanelContext = createContext<CodePanelCtx | null>(null);
export const useCodePanel = () => useContext(CodePanelContext);
