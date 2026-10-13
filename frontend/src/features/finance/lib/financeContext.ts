import { useOutletContext } from 'react-router-dom';
import type { FinancePeriod } from './period';

export interface FinanceContext {
  period: FinancePeriod;
}

export function useFinancePeriod(): FinancePeriod {
  return useOutletContext<FinanceContext>().period;
}