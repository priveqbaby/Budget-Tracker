/** The Sankey lines (PRD v2 §2.3, amended), seeded at household creation. Caps in cents. */
export const DEFAULT_CATEGORIES: Array<{
  name: string;
  monthlyCap: number;
  isFixed: boolean;
  isSurplus?: boolean;
}> = [
  // Fixed — paid/unpaid checklist, including every bill on a schedule.
  { name: "Rent", monthlyCap: 150000, isFixed: true },
  { name: "Debt payments", monthlyCap: 48800, isFixed: true },
  { name: "Travel", monthlyCap: 66600, isFixed: true },
  { name: "Travel to Manitoba", monthlyCap: 16700, isFixed: true },
  { name: "Transfer to parents", monthlyCap: 15000, isFixed: true },
  { name: "Cell", monthlyCap: 12200, isFixed: true },
  { name: "Hydro", monthlyCap: 8500, isFixed: true },
  { name: "Wifi", monthlyCap: 6100, isFixed: true },

  // Variable — tracked against caps.
  { name: "Food", monthlyCap: 120000, isFixed: false },
  { name: "Gym & tennis", monthlyCap: 50000, isFixed: false },
  { name: "Fun activities", monthlyCap: 36900, isFixed: false },
  { name: "Clothing", monthlyCap: 25000, isFixed: false },
  { name: "Transit", monthlyCap: 20000, isFixed: false },
  { name: "Haircut & personal", monthlyCap: 20000, isFixed: false },
  { name: "Uber", monthlyCap: 10000, isFixed: false },
  { name: "Subscriptions", monthlyCap: 6800, isFixed: false },
  { name: "Streaming", monthlyCap: 5000, isFixed: false },

  { name: "Unallocated surplus", monthlyCap: 50000, isFixed: false, isSurplus: true },
];
