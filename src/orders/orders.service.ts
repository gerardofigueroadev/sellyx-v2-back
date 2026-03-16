import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus, OrderChannel } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { ProductsService } from '../products/products.service';
import { ShiftsService } from '../shifts/shifts.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemsRepository: Repository<OrderItem>,
    private productsService: ProductsService,
    private shiftsService: ShiftsService,
  ) {}

  private generateOrderNumber(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const time = now.getTime().toString().slice(-6);
    return `ORD-${date}-${time}`;
  }

  async create(dto: CreateOrderDto, userId: number, branchId: number, orgId: number): Promise<Order> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('La orden debe tener al menos un producto');
    }

    const channel = dto.channel ?? OrderChannel.POS;

    // Resolver turno según canal
    let shift = null;
    if (channel === OrderChannel.POS) {
      shift = await this.shiftsService.findActivePosForBranch(branchId);
      if (!shift) throw new BadRequestException('No hay turno abierto en esta sucursal. Abre la caja primero.');
    } else {
      // Canal digital: turno virtual del sistema (se crea automáticamente si no existe)
      shift = await this.shiftsService.getOrCreateSystemShift(branchId);
    }

    // Siguiente número de ticket dentro del turno
    const ticketCount = await this.ordersRepository.count({ where: { shift: { id: shift.id } } });
    const ticketNumber = ticketCount + 1;

    let total = 0;
    const orderItems: Partial<OrderItem>[] = [];

    for (const item of dto.items) {
      const product = await this.productsService.findOne(item.productId, orgId);
      if (!product.isAvailable) {
        throw new BadRequestException(`El producto ${product.name} no está disponible`);
      }
      const subtotal = Number(product.price) * item.quantity;
      total += subtotal;
      orderItems.push({ product, quantity: item.quantity, unitPrice: product.price, subtotal, notes: item.notes ?? null });
    }

    const order = this.ordersRepository.create({
      orderNumber: this.generateOrderNumber(),
      ticketNumber,
      paymentMethod: dto.paymentMethod,
      channel,
      notes: dto.notes,
      total,
      shift: { id: shift.id } as any,
      user: { id: userId } as any,
      branch: branchId ? { id: branchId } as any : undefined,
      customer: dto.customerId ? { id: dto.customerId } as any : null,
    });

    const savedOrder = await this.ordersRepository.save(order);

    for (const item of orderItems) {
      await this.orderItemsRepository.save({ ...item, order: savedOrder });
    }

    return this.findOne(savedOrder.id);
  }

  async findAll(branchId?: number, orgId?: number): Promise<Order[]> {
    const where: any = {};
    if (branchId) where.branch = { id: branchId };
    else if (orgId) where.branch = { organization: { id: orgId } };
    return this.ordersRepository.find({
      where,
      relations: ['items', 'items.product', 'user', 'customer', 'branch', 'shift'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ['items', 'items.product', 'user', 'customer', 'branch', 'shift'],
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async complete(id: number): Promise<Order> {
    const order = await this.findOne(id);
    order.status = OrderStatus.COMPLETED;
    return this.ordersRepository.save(order);
  }

  async cancel(id: number): Promise<Order> {
    const order = await this.findOne(id);
    order.status = OrderStatus.CANCELLED;
    return this.ordersRepository.save(order);
  }

  async getStats(branchId?: number, orgId?: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let qb = this.ordersRepository.createQueryBuilder('order');
    if (branchId) qb = qb.where('order.branchId = :branchId', { branchId });

    const [totalOrders, completedOrders] = await Promise.all([
      qb.getCount(),
      qb.clone().andWhere('order.status = :status', { status: OrderStatus.COMPLETED }).getCount(),
    ]);

    const todayOrders = await qb.clone()
      .andWhere('order.createdAt >= :today', { today })
      .andWhere('order.status = :status', { status: OrderStatus.COMPLETED })
      .getCount();

    const revenueResult = await qb.clone()
      .select('SUM(order.total)', 'total')
      .andWhere('order.status = :status', { status: OrderStatus.COMPLETED })
      .getRawOne();

    const todayRevenueResult = await qb.clone()
      .select('SUM(order.total)', 'total')
      .andWhere('order.createdAt >= :today', { today })
      .andWhere('order.status = :status', { status: OrderStatus.COMPLETED })
      .getRawOne();

    return {
      totalOrders,
      completedOrders,
      todayOrders,
      totalRevenue: parseFloat(revenueResult?.total || '0'),
      todayRevenue: parseFloat(todayRevenueResult?.total || '0'),
    };
  }
}
