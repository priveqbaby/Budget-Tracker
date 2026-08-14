/** The 17 budget lines from the Sankey, seeded at household creation. Caps in cents. */
export const DEFAULT_CATEGORIES: Array<{
  name: string;
  monthlyCap: number;
  isFixed: boolean;
}> = [
  { name: "Rent", monthlyCap: 185000, isFixed: true },
  { name: "Debt repayment", monthlyCap: 45000, isFixed: true },
  { name: "Parent transfer", monthlyCap: 30000, isFixed: true },
  { name: "Food", monthlyCap: 120000, isFixed: false },
  { name: "Transit", monthlyCap: 24000, isFixed: false },
  { name: "Car share & taxis", monthlyCap: 12000, isFixed: false },
  { name: "Hydro & utilities", monthlyCap: 9500, isFixed: false },
  { name: "Internet & phone", monthlyCap: 14000, isFixed: false },
  { name: "Subscriptions", monthlyCap: 8500, isFixed: false },
  { name: "Health & pharmacy", monthlyCap: 15000, isFixed: false },
  { name: "Fitness", monthlyCap: 11000, isFixed: false },
  { name: "Clothing", monthlyCap: 15000, isFixed: false },
  { name: "Household goods", monthlyCap: 20000, isFixed: false },
  { name: "Personal — A", monthlyCap: 15000, isFixed: false },
  { name: "Personal — B", monthlyCap: 15000, isFixed: false },
  { name: "Travel — general", monthlyCap: 66600, isFixed: false },
  { name: "Travel — Manitoba", monthlyCap: 16700, isFixed: false },
];
