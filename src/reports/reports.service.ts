import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

@Injectable()
export class ReportsService {
  private tz = process.env.APP_TZ ?? 'UTC';

  constructor(
    @InjectEntityManager()
    private em: EntityManager,
  ) {}

  private branchFilter(branchId?: number) {
    return branchId ? `AND o."branchId" = ${branchId}` : '';
  }

  /** Resumen ejecutivo: totales del período */
  async getSummary(orgId: number, from: string, to: string, branchId?: number) {
    const bf = this.branchFilter(branchId);
    const [row] = await this.em.query(`
      SELECT
        COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total ELSE 0 END), 0)::numeric AS "totalSales",
        COUNT(CASE WHEN o.status = 'completed' THEN 1 END)::int                              AS "totalOrders",
        COALESCE(AVG(CASE WHEN o.status = 'completed' THEN o.total END), 0)::numeric         AS "avgTicket",
        COALESCE(SUM(CASE WHEN o.status = 'completed' AND o."paymentMethod" = 'cash'     THEN o.total ELSE 0 END), 0)::numeric AS "cashSales",
        COALESCE(SUM(CASE WHEN o.status = 'completed' AND o."paymentMethod" = 'card'     THEN o.total ELSE 0 END), 0)::numeric AS "cardSales",
        COALESCE(SUM(CASE WHEN o.status = 'completed' AND o."paymentMethod" = 'transfer' THEN o.total ELSE 0 END), 0)::numeric AS "transferSales",
        COUNT(CASE WHEN o.status = 'voided' THEN 1 END)::int                                 AS "voidedCount",
        COALESCE(SUM(CASE WHEN o.status = 'voided' THEN o.total ELSE 0 END), 0)::numeric     AS "voidedTotal"
      FROM orders o
      JOIN branches b ON b.id = o."branchId"
      WHERE b."organizationId" = $1
        AND o.status IN ('completed', 'voided')
        AND (o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE '${this.tz}')::date BETWEEN $2 AND $3
        ${bf}
    `, [orgId, from, to]);

    return {
      totalSales:    parseFloat(row.totalSales),
      totalOrders:   row.totalOrders,
      avgTicket:     parseFloat(row.avgTicket),
      cashSales:     parseFloat(row.cashSales),
      cardSales:     parseFloat(row.cardSales),
      transferSales: parseFloat(row.transferSales),
      voidedCount:   row.voidedCount,
      voidedTotal:   parseFloat(row.voidedTotal),
    };
  }

  /** Ventas por hora (0-23) — para el gráfico de línea */
  async getSalesByHour(orgId: number, from: string, to: string, branchId?: number) {
    const bf = this.branchFilter(branchId);
    const rows = await this.em.query(`
      SELECT
        EXTRACT(HOUR FROM (o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE '${this.tz}'))::int AS hour,
        COALESCE(SUM(o.total), 0)::numeric     AS total,
        COUNT(o.id)::int                       AS orders
      FROM orders o
      JOIN branches b ON b.id = o."branchId"
      WHERE b."organizationId" = $1
        AND o.status = 'completed'
        AND (o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE '${this.tz}')::date BETWEEN $2 AND $3
        ${bf}
      GROUP BY hour
      ORDER BY hour
    `, [orgId, from, to]);

    // Rellenar horas sin ventas
    const map = new Map(rows.map((r: any) => [r.hour, r]));
    return Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, '0')}:00`,
      total:  parseFloat((map.get(h) as any)?.total ?? '0'),
      orders: (map.get(h) as any)?.orders ?? 0,
    }));
  }

  /** Ventas por día — para gráfico de barras */
  async getSalesByDay(orgId: number, from: string, to: string, branchId?: number) {
    const bf = this.branchFilter(branchId);
    const rows = await this.em.query(`
      SELECT
        (o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE '${this.tz}')::date AS day,
        COALESCE(SUM(o.total), 0)::numeric     AS total,
        COUNT(o.id)::int                       AS orders
      FROM orders o
      JOIN branches b ON b.id = o."branchId"
      WHERE b."organizationId" = $1
        AND o.status = 'completed'
        AND (o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE '${this.tz}')::date BETWEEN $2 AND $3
        ${bf}
      GROUP BY day
      ORDER BY day
    `, [orgId, from, to]);

    return rows.map((r: any) => ({
      day:    r.day instanceof Date ? r.day.toISOString().split('T')[0] : String(r.day),
      total:  parseFloat(r.total),
      orders: r.orders,
    }));
  }

  /** Top productos por cantidad y monto */
  async getTopProducts(orgId: number, from: string, to: string, branchId?: number) {
    const bf = this.branchFilter(branchId);
    return this.em.query(`
      SELECT
        p.name                             AS name,
        SUM(oi.quantity)::int              AS qty,
        SUM(oi.subtotal)::numeric          AS total
      FROM order_items oi
      JOIN products p  ON p.id  = oi."productId"
      JOIN orders   o  ON o.id  = oi."orderId"
      JOIN branches b  ON b.id  = o."branchId"
      WHERE b."organizationId" = $1
        AND o.status = 'completed'
        AND (o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE '${this.tz}')::date BETWEEN $2 AND $3
        ${bf}
      GROUP BY p.name
      ORDER BY qty DESC
      LIMIT 15
    `, [orgId, from, to]).then((rows: any[]) =>
      rows.map(r => ({ name: r.name, qty: r.qty, total: parseFloat(r.total) }))
    );
  }

  /** Resumen de turnos */
  async getShiftsSummary(orgId: number, from: string, to: string, branchId?: number) {
    const branchCond = branchId ? `AND s."branchId" = ${branchId}` : '';
    return this.em.query(`
      SELECT
        s.id,
        s."openedAt",
        s."closedAt",
        b.name                                                      AS branch,
        u.name                                                      AS cashier,
        s."openingAmount"::numeric,
        s."closingAmount"::numeric,
        COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total END), 0)::numeric AS sales,
        COUNT(CASE WHEN o.status = 'completed' THEN 1 END)::int     AS orders
      FROM shifts s
      JOIN branches b   ON b.id = s."branchId"
      LEFT JOIN users u ON u.id = s."userId"
      LEFT JOIN orders o ON o."shiftId" = s.id
      WHERE b."organizationId" = $1
        AND s.type = 'pos'
        AND (s."openedAt" AT TIME ZONE 'UTC' AT TIME ZONE '${this.tz}')::date BETWEEN $2 AND $3
        ${branchCond}
      GROUP BY s.id, b.name, u.name
      ORDER BY s."openedAt" DESC
    `, [orgId, from, to]).then((rows: any[]) =>
      rows.map(r => ({
        id:             r.id,
        openedAt:       r.openedAt instanceof Date ? r.openedAt.toISOString() : r.openedAt,
        closedAt:       r.closedAt instanceof Date ? r.closedAt.toISOString() : r.closedAt,
        branch:         r.branch,
        cashier:        r.cashier ?? 'Sistema',
        openingAmount:  parseFloat(r.openingAmount ?? '0'),
        closingAmount:  r.closingAmount !== null ? parseFloat(r.closingAmount) : null,
        sales:          parseFloat(r.sales),
        orders:         r.orders,
        difference:     r.closingAmount !== null
          ? parseFloat(r.closingAmount) - (parseFloat(r.openingAmount ?? '0') + parseFloat(r.sales))
          : null,
      }))
    );
  }
}
