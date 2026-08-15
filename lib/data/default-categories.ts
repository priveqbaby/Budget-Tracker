/** The 18 Sankey lines (PRD v2 §2.3), seeded at household creation. Caps in cents. */
export const DEFAULT_CATEGORIES: Array<{
  name: string;
  monthlyCap: number;
  isFixed: boolean;
  isSurplus?: boolean;
}> = [
  { name: "Rent", monthlyCap: 150000, isFixed: true },
  { name: "Food", monthlyCap: 120000, isFixed: false },
  { name: "Travel", monthlyCap: 66600, isFixed: false },
  { name: "Gym & tennis", monthlyCap: 50000, isFixed: false },
  { name: "Debt payments", monthlyCap: 48800, isFixed: true },
  { name: "Fun activities", monthlyCap: 30000, isFixed: false },
  { name: "Clothing", monthlyCap: 25000, isFixed: false },
  { name: "Transit", monthlyCap: 20000, isFixed: false },
  { name: "Transfer to parents", monthlyCap: 20000, isFixed: true },
  { name: "Haircut & personal", monthlyCap: 20000, isFixed: false },
  { name: "Travel to Manitoba", monthlyCap: 16700, isFixed: false },
  { name: "Cell", monthlyCap: 12200, isFixed: false },
  { name: "Uber", monthlyCap: 10000, isFixed: false },
  { name: "Hydro", monthlyCap: 8500, isFixed: false },
  { name: "Wifi", monthlyCap: 6100, isFixed: false },
  { name: "Streaming", monthlyCap: 5000, isFixed: false },
  { name: "Subscriptions", monthlyCap: 6000, isFixed: false },
  { name: "Amazon Prime", monthlyCap: 800, isFixed: false },
  { name: "Unallocated surplus", monthlyCap: 51900, isFixed: false, isSurplus: true },
];
