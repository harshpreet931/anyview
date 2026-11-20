import { createContext, useContext, useEffect } from 'react';

type PinPage = (pageIndex: number) => () => void;

export const PinPageContext = createContext<PinPage>(() => () => {});

/** Keeps a page mounted while `active`, even after it scrolls out of the virtualized window. */
export function usePinPage(pageIndex: number, active: boolean): void {
  const pin = useContext(PinPageContext);
  useEffect(() => (active ? pin(pageIndex) : undefined), [pin, pageIndex, active]);
}
