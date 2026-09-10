const currencyFormatter = new Intl.NumberFormat("es-BO", {
  style: "currency",
  currency: "BOB",
})

export function formatCurrency(value: number | string): string {
  return currencyFormatter.format(Number(value))
}
