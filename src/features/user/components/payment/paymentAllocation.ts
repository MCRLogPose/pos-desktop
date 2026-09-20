// Lógica reutilizable de asignación de pagos por prenda (pivot waterfall/FIFO).
// Usada por el modal de ajuste del checkout y por el checkout mismo para
// generar la asignación automática.

export type PaymentMethodId = 'cash' | 'card' | 'yape';

export interface PaymentFraction {
    method: PaymentMethodId;
    amount: number;
}

export interface AllocationLineItem {
    id: string;
    name: string;
    subtotal: number;
}

export interface ItemAllocation {
    itemId: string;
    name: string;
    subtotal: number;
    target: number;
    amounts: Record<PaymentMethodId, number>;
}

export const PAYMENT_METHODS: readonly { id: PaymentMethodId; label: string }[] = [
    { id: 'cash', label: 'Efectivo' },
    { id: 'card', label: 'Tarjeta' },
    { id: 'yape', label: 'Yape' },
];

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const isZero = (n: number) => Math.abs(n) <= 0.005;

/** Reparte el total entre las prendas proporcional a su subtotal (incluye la
 * parte proporcional del IGV). La suma siempre es exactamente el total. */
export function computeItemShares(items: AllocationLineItem[], total: number): number[] {
    const sum = items.reduce((acc, i) => acc + i.subtotal, 0);
    const shares = items.map(i =>
        round2(sum > 0 ? (i.subtotal * total) / sum : total / Math.max(items.length, 1))
    );
    if (shares.length > 0) {
        const residual = round2(total - shares.reduce((a, b) => a + b, 0));
        shares[shares.length - 1] = round2(shares[shares.length - 1] + residual);
    }
    return shares;
}

/** Waterfall/FIFO: el primer metodo de pago cubre el primer item y el
 * excedente fluye al siguiente, hasta que cada item alcanza su parte. */
export function allocWaterfall(
    items: AllocationLineItem[],
    payments: PaymentFraction[],
    total: number
): ItemAllocation[] {
    const shares = computeItemShares(items, total);
    const result: ItemAllocation[] = items.map((item, idx) => ({
        itemId: item.id,
        name: item.name,
        subtotal: item.subtotal,
        target: shares[idx],
        amounts: { cash: 0, card: 0, yape: 0 },
    }));

    let pi = 0;
    let consumed = 0;
    for (const row of result) {
        let remaining = row.target;
        while (remaining > 0.001) {
            const p = payments[pi];
            if (!p) break;
            const take = round2(Math.min(round2(p.amount - consumed), remaining));
            row.amounts[p.method] = round2(row.amounts[p.method] + take);
            consumed = round2(consumed + take);
            remaining = round2(remaining - take);
            if (round2(p.amount - consumed) <= 0.001) {
                pi += 1;
                consumed = 0;
            }
        }
    }

    return result;
}

export interface RowBalance {
    itemId: string;
    target: number;
    sum: number;
    ok: boolean;
}

export interface ColumnBalance {
    method: PaymentMethodId;
    target: number;
    sum: number;
    ok: boolean;
}

export interface AllocationBalance {
    rows: RowBalance[];
    columns: ColumnBalance[];
    isBalanced: boolean;
}

/** Valida que cada prenda sume su parte y cada metodo sume su fraccion de la orden. */
export function allocationBalance(
    alloc: ItemAllocation[],
    payments: PaymentFraction[]
): AllocationBalance {
    const rows: RowBalance[] = alloc.map(row => {
        const sum = round2(row.amounts.cash + row.amounts.card + row.amounts.yape);
        return { itemId: row.itemId, target: round2(row.target), sum, ok: isZero(sum - round2(row.target)) };
    });

    const columns: ColumnBalance[] = PAYMENT_METHODS.map(({ id: method }) => {
        const target = payments.find(p => p.method === method)?.amount ?? 0;
        const sum = round2(alloc.reduce((acc, r) => acc + (r.amounts[method] || 0), 0));
        return { method, target: round2(target), sum, ok: isZero(round2(sum) - round2(target)) };
    });

    const isBalanced = rows.every(r => r.ok) && columns.every(c => c.ok);
    return { rows, columns, isBalanced };
}