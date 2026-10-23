import { expect, it } from 'vitest';
import { sellingPointCapacityIssue } from './sellingPointCapacity';
it('reports total text that cannot fit with minimum equal padding',()=>{
 expect(sellingPointCapacityIssue([300,420,700])).toBeTruthy();
 expect(sellingPointCapacityIssue([160,260,320])).toBeNull();
});
