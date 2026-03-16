import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shift, ShiftStatus, ShiftType } from './entities/shift.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { OpenShiftDto } from './dto/open-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';

@Injectable()
export class ShiftsService {
  constructor(
    @InjectRepository(Shift)
    private repo: Repository<Shift>,
    @InjectRepository(Order)
    private ordersRepo: Repository<Order>,
  ) {}

  /** Abre un turno POS para una sucursal. Valida que no haya uno abierto. */
  async open(dto: OpenShiftDto, userId: number, branchId: number): Promise<Shift> {
    const existing = await this.findActivePosForBranch(branchId);
    if (existing) throw new BadRequestException('Ya existe un turno abierto en esta sucursal');

    const shift = this.repo.create({
      type: ShiftType.POS,
      status: ShiftStatus.OPEN,
      openingAmount: dto.openingAmount,
      notes: dto.notes,
      branch: { id: branchId } as any,
      user: { id: userId } as any,
    });
    return this.repo.save(shift);
  }

  /** Retorna pedidos pendientes de un turno */
  async getPendingOrders(shiftId: number): Promise<Order[]> {
    return this.ordersRepo.find({
      where: { shift: { id: shiftId }, status: OrderStatus.PENDING },
      relations: ['items', 'items.product'],
    });
  }

  /** Cierra un turno POS. Si hay pendientes y cancelPending=false, lanza error con el conteo. */
  async close(id: number, dto: CloseShiftDto, orgId: number): Promise<Shift> {
    const shift = await this.findOne(id, orgId);
    if (shift.type === ShiftType.SYSTEM) throw new BadRequestException('El turno del sistema no se puede cerrar');
    if (shift.status === ShiftStatus.CLOSED) throw new BadRequestException('El turno ya está cerrado');

    const pending = await this.getPendingOrders(id);

    if (pending.length > 0 && !dto.cancelPending) {
      throw new BadRequestException({
        message: 'Hay pedidos pendientes en este turno',
        pendingCount: pending.length,
        pendingOrders: pending.map(o => ({
          id: o.id,
          ticketNumber: o.ticketNumber,
          total: o.total,
          itemCount: o.items.length,
        })),
      });
    }

    // Cancelar pedidos pendientes si el cajero lo aprobó
    if (pending.length > 0 && dto.cancelPending) {
      await this.ordersRepo.update(
        pending.map(o => o.id),
        { status: OrderStatus.CANCELLED },
      );
    }

    shift.status = ShiftStatus.CLOSED;
    shift.closingAmount = dto.closingAmount;
    shift.closedAt = new Date();
    if (dto.notes) shift.notes = dto.notes;
    return this.repo.save(shift);
  }

  /** Retorna el turno POS activo de una sucursal (null si no hay). */
  async findActivePosForBranch(branchId: number): Promise<Shift | null> {
    return this.repo.findOne({
      where: {
        branch: { id: branchId },
        type: ShiftType.POS,
        status: ShiftStatus.OPEN,
      },
    });
  }

  /** Retorna (o crea) el turno SYSTEM permanente de una sucursal para pedidos digitales. */
  async getOrCreateSystemShift(branchId: number): Promise<Shift> {
    const existing = await this.repo.findOne({
      where: {
        branch: { id: branchId },
        type: ShiftType.SYSTEM,
        status: ShiftStatus.OPEN,
      },
    });
    if (existing) return existing;

    const shift = this.repo.create({
      type: ShiftType.SYSTEM,
      status: ShiftStatus.OPEN,
      openingAmount: 0,
      branch: { id: branchId } as any,
      user: null,
    });
    return this.repo.save(shift);
  }

  async findAll(orgId: number, branchId?: number): Promise<Shift[]> {
    const qb = this.repo.createQueryBuilder('shift')
      .leftJoinAndSelect('shift.branch', 'branch')
      .leftJoinAndSelect('shift.user', 'user')
      .leftJoin('branch.organization', 'org')
      .where('org.id = :orgId', { orgId });

    if (branchId) qb.andWhere('branch.id = :branchId', { branchId });

    return qb.orderBy('shift.openedAt', 'DESC').getMany();
  }

  async findOne(id: number, orgId: number): Promise<Shift> {
    const shift = await this.repo.createQueryBuilder('shift')
      .leftJoinAndSelect('shift.branch', 'branch')
      .leftJoinAndSelect('shift.user', 'user')
      .leftJoin('branch.organization', 'org')
      .where('shift.id = :id', { id })
      .andWhere('org.id = :orgId', { orgId })
      .getOne();
    if (!shift) throw new NotFoundException('Shift not found');
    return shift;
  }

  /** Reporte detallado del turno: productos vendidos + métodos de pago */
  async getReport(id: number, orgId: number) {
    const shift = await this.findOne(id, orgId);

    const [summary] = await this.repo.manager.query(`
      SELECT
        COUNT(o.id)::int                                                                    AS "totalOrders",
        COALESCE(SUM(o.total), 0)::numeric                                                 AS "totalSales",
        COALESCE(SUM(CASE WHEN o."paymentMethod" = 'cash'     THEN o.total ELSE 0 END), 0)::numeric AS "cashSales",
        COALESCE(SUM(CASE WHEN o."paymentMethod" = 'card'     THEN o.total ELSE 0 END), 0)::numeric AS "cardSales",
        COALESCE(SUM(CASE WHEN o."paymentMethod" = 'transfer' THEN o.total ELSE 0 END), 0)::numeric AS "transferSales"
      FROM orders o
      WHERE o."shiftId" = $1 AND o.status = 'completed'
    `, [id]);

    const products: Array<{
      productId: number; name: string;
      totalQty: number; unitPrice: number; totalSubtotal: number;
    }> = await this.repo.manager.query(`
      SELECT
        p.id           AS "productId",
        p.name         AS name,
        SUM(oi.quantity)::int          AS "totalQty",
        oi."unitPrice"::numeric        AS "unitPrice",
        SUM(oi.subtotal)::numeric      AS "totalSubtotal"
      FROM order_items oi
      JOIN products p  ON p.id  = oi."productId"
      JOIN orders   o  ON o.id  = oi."orderId"
      WHERE o."shiftId" = $1 AND o.status = 'completed'
      GROUP BY p.id, p.name, oi."unitPrice"
      ORDER BY "totalSubtotal" DESC
    `, [id]);

    const cashSales      = parseFloat(summary.cashSales);
    const expectedCash   = parseFloat(shift.openingAmount as any) + cashSales;
    const closingAmount  = shift.closingAmount ? parseFloat(shift.closingAmount as any) : null;

    return {
      shift,
      totalOrders:   summary.totalOrders,
      totalSales:    parseFloat(summary.totalSales),
      cashSales,
      cardSales:     parseFloat(summary.cardSales),
      transferSales: parseFloat(summary.transferSales),
      expectedCash,
      closingAmount,
      difference:    closingAmount !== null ? closingAmount - expectedCash : null,
      products: products.map(p => ({
        ...p,
        totalQty:      Number(p.totalQty),
        unitPrice:     parseFloat(p.unitPrice as any),
        totalSubtotal: parseFloat(p.totalSubtotal as any),
      })),
    };
  }

  /** Resumen del turno: ventas totales, efectivo esperado, diferencia */
  async getSummary(id: number, orgId: number) {
    const shift = await this.findOne(id, orgId);

    const result = await this.repo.manager.query(`
      SELECT
        COUNT(o.id)::int                                          AS "totalOrders",
        COALESCE(SUM(o.total), 0)::numeric                       AS "totalSales",
        COALESCE(SUM(CASE WHEN o."paymentMethod" = 'cash' THEN o.total ELSE 0 END), 0)::numeric AS "cashSales",
        COALESCE(SUM(CASE WHEN o."paymentMethod" != 'cash' THEN o.total ELSE 0 END), 0)::numeric AS "digitalSales"
      FROM orders o
      WHERE o."shiftId" = $1 AND o.status = 'completed'
    `, [id]);

    const stats = result[0];
    const cashSales = parseFloat(stats.cashSales);
    const expectedCash = parseFloat(shift.openingAmount as any) + cashSales;
    const closingAmount = shift.closingAmount ? parseFloat(shift.closingAmount as any) : null;
    const difference = closingAmount !== null ? closingAmount - expectedCash : null;

    return {
      shift,
      totalOrders: stats.totalOrders,
      totalSales: parseFloat(stats.totalSales),
      cashSales,
      digitalSales: parseFloat(stats.digitalSales),
      expectedCash,
      closingAmount,
      difference,
    };
  }
}
