/**
 * Unit Tests for Order Placement and Management
 * 
 * Tests order validation, processing, status management, and business rules
 * for the e-commerce order system.
 */

const { 
  mockGenerators, 
  assertHelpers 
} = require('../test-config');

describe('Order Management - Unit Tests', () => {
  
  describe('Order Validation', () => {
    
    test('should validate order structure', () => {
      const orderValidator = (order) => {
        return order && 
               typeof order.userId === 'string' && 
               order.userId.length > 0 &&
               Array.isArray(order.items) && 
               order.items.length > 0 &&
               typeof order.total === 'number' && 
               order.total > 0 &&
               typeof order.status === 'string' &&
               ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].includes(order.status) &&
               order.shippingAddress && 
               typeof order.shippingAddress.street === 'string' &&
               typeof order.shippingAddress.city === 'string' &&
               typeof order.shippingAddress.zipCode === 'string' &&
               typeof order.shippingAddress.country === 'string';
      };

      // Valid order
      const validOrder = {
        userId: 'user123',
        items: [
          { productId: 1, quantity: 2, price: 10.99 }
        ],
        total: 21.98,
        status: 'pending',
        shippingAddress: {
          street: '123 Main St',
          city: 'New York',
          zipCode: '10001',
          country: 'USA'
        }
      };
      expect(orderValidator(validOrder)).toBe(true);

      // Invalid orders
      expect(orderValidator(null)).toBe(false);
      expect(orderValidator({})).toBe(false);
      expect(orderValidator({ userId: '', items: [], total: 0, status: 'invalid' })).toBe(false);
    });

    test('should validate shipping address', () => {
      const addressValidator = (address) => {
        return address && 
               typeof address.street === 'string' && 
               address.street.trim().length >= 5 &&
               typeof address.city === 'string' && 
               address.city.trim().length >= 2 &&
               typeof address.zipCode === 'string' && 
               /^\d{5}(-\d{4})?$/.test(address.zipCode) &&
               typeof address.country === 'string' && 
               address.country.trim().length >= 2;
      };

      // Valid addresses
      const validAddress1 = {
        street: '123 Main Street',
        city: 'New York',
        zipCode: '10001',
        country: 'USA'
      };
      expect(addressValidator(validAddress1)).toBe(true);

      const validAddress2 = {
        street: '456 Oak Avenue',
        city: 'Los Angeles',
        zipCode: '90210-1234',
        country: 'United States'
      };
      expect(addressValidator(validAddress2)).toBe(true);

      // Invalid addresses
      expect(addressValidator(null)).toBe(false);
      expect(addressValidator({})).toBe(false);
      expect(addressValidator({ street: '123', city: 'NY', zipCode: '1', country: 'US' })).toBe(false);
      expect(addressValidator({ street: '', city: 'New York', zipCode: '10001', country: 'USA' })).toBe(false);
    });

    test('should validate order items', () => {
      const orderItemsValidator = (items) => {
        if (!Array.isArray(items) || items.length === 0) {
          return false;
        }

        return items.every(item => 
          item && 
          typeof item.productId === 'number' && 
          item.productId > 0 &&
          typeof item.quantity === 'number' && 
          item.quantity >= 1 &&
          typeof item.price === 'number' && 
          item.price > 0
        );
      };

      // Valid items
      const validItems = [
        { productId: 1, quantity: 2, price: 10.99 },
        { productId: 2, quantity: 1, price: 25.50 }
      ];
      expect(orderItemsValidator(validItems)).toBe(true);

      // Invalid items
      expect(orderItemsValidator([])).toBe(false);
      expect(orderItemsValidator(null)).toBe(false);
      expect(orderItemsValidator([{ productId: 0, quantity: 1, price: 10 }])).toBe(false);
      expect(orderItemsValidator([{ productId: 1, quantity: 0, price: 10 }])).toBe(false);
      expect(orderItemsValidator([{ productId: 1, quantity: 1, price: -10 }])).toBe(false);
    });

    test('should validate order total calculation', () => {
      const items = [
        { productId: 1, quantity: 2, price: 10.99 },
        { productId: 2, quantity: 1, price: 25.50 },
        { productId: 3, quantity: 3, price: 8.99 }
      ];

      const calculateOrderTotal = (items, taxRate = 0.08, shippingCost = 0) => {
        const subtotal = items.reduce((total, item) => total + (item.price * item.quantity), 0);
        const tax = subtotal * taxRate;
        return subtotal + tax + shippingCost;
      };

      const calculatedTotal = calculateOrderTotal(items, 0.08, 5.99);
      const expectedTotal = 64.47 + 5.16 + 5.99; // (21.98 + 25.50 + 17.97) + tax + shipping
      expect(calculatedTotal).toBeCloseTo(expectedTotal, 2);
    });
  });

  describe('Order Processing', () => {
    
    test('should generate order ID', () => {
      const generateOrderId = () => {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `ORD-${timestamp}-${random}`;
      };

      const orderId1 = generateOrderId();
      const orderId2 = generateOrderId();
      
      expect(orderId1).toMatch(/^ORD-\d+-[a-z0-9]+$/);
      expect(orderId2).toMatch(/^ORD-\d+-[a-z0-9]+$/);
      expect(orderId1).not.toBe(orderId2);
    });

    test('should calculate order tax', () => {
      const calculateTax = (subtotal, taxRate) => {
        return subtotal * taxRate;
      };

      expect(calculateTax(100, 0.08)).toBe(8);
      expect(calculateTax(250.99, 0.06)).toBe(15.06);
      expect(calculateTax(0, 0.08)).toBe(0);
    });

    test('should apply discount codes', () => {
      const applyDiscount = (total, discountCode) => {
        const discounts = {
          'SAVE10': 0.10,
          'SAVE20': 0.20,
          'WELCOME': 0.15
        };

        const discountRate = discounts[discountCode] || 0;
        return total * (1 - discountRate);
      };

      expect(applyDiscount(100, 'SAVE10')).toBe(90);
      expect(applyDiscount(100, 'SAVE20')).toBe(80);
      expect(applyDiscount(100, 'WELCOME')).toBe(85);
      expect(applyDiscount(100, 'INVALID')).toBe(100); // no discount
    });

    test('should calculate shipping cost based on location', () => {
      const calculateShipping = (subtotal, shippingZone) => {
        const shippingRates = {
          'domestic': 5.99,
          'international': 15.99,
          'express': 12.99
        };

        // Free shipping for orders over $100
        if (subtotal >= 100) {
          return 0;
        }

        return shippingRates[shippingZone] || shippingRates.domestic;
      };

      expect(calculateShipping(50, 'domestic')).toBe(5.99);
      expect(calculateShipping(150, 'domestic')).toBe(0); // free shipping
      expect(calculateShipping(50, 'international')).toBe(15.99);
      expect(calculateShipping(50, 'express')).toBe(12.99);
    });
  });

  describe('Order Status Management', () => {
    
    test('should validate order status transitions', () => {
      const validTransitions = {
        'pending': ['confirmed', 'cancelled'],
        'confirmed': ['processing', 'cancelled'],
        'processing': ['shipped', 'cancelled'],
        'shipped': ['delivered'],
        'delivered': [],
        'cancelled': []
      };

      const isValidTransition = (fromStatus, toStatus) => {
        return validTransitions[fromStatus].includes(toStatus);
      };

      // Valid transitions
      expect(isValidTransition('pending', 'confirmed')).toBe(true);
      expect(isValidTransition('confirmed', 'processing')).toBe(true);
      expect(isValidTransition('processing', 'shipped')).toBe(true);
      expect(isValidTransition('shipped', 'delivered')).toBe(true);

      // Invalid transitions
      expect(isValidTransition('pending', 'processing')).toBe(false);
      expect(isValidTransition('delivered', 'shipped')).toBe(false);
      expect(isValidTransition('cancelled', 'pending')).toBe(false);
    });

    test('should update order status', () => {
      const order = {
        id: 'ORD-123',
        status: 'pending',
        statusHistory: [
          { status: 'pending', timestamp: Date.now() }
        ]
      };

      const updateOrderStatus = (order, newStatus, reason = '') => {
        const oldStatus = order.status;
        order.status = newStatus;
        order.statusHistory.push({
          status: newStatus,
          timestamp: Date.now(),
          reason,
          previousStatus: oldStatus
        });
        return order;
      };

      updateOrderStatus(order, 'confirmed', 'Payment received');
      expect(order.status).toBe('confirmed');
      expect(order.statusHistory).toHaveLength(2);
      expect(order.statusHistory[1].status).toBe('confirmed');
      expect(order.statusHistory[1].reason).toBe('Payment received');
    });

    test('should track order status history', () => {
      const order = {
        id: 'ORD-123',
        status: 'pending',
        statusHistory: [
          { status: 'pending', timestamp: Date.now(), reason: 'Order created' }
        ]
      };

      const updateOrderStatus = (order, newStatus, reason = '') => {
        order.status = newStatus;
        order.statusHistory.push({
          status: newStatus,
          timestamp: Date.now(),
          reason
        });
        return order;
      };

      updateOrderStatus(order, 'confirmed', 'Payment successful');
      updateOrderStatus(order, 'processing', 'Order being prepared');
      updateOrderStatus(order, 'shipped', 'Order dispatched');

      expect(order.statusHistory).toHaveLength(4);
      expect(order.statusHistory[3].status).toBe('shipped');
      expect(order.statusHistory[3].reason).toBe('Order dispatched');
    });
  });

  describe('Order Fulfillment', () => {
    
    test('should check inventory for order fulfillment', () => {
      const inventory = {
        1: 10,
        2: 5,
        3: 0
      };

      const checkInventory = (orderItems, inventory) => {
        const result = {
          canFulfill: true,
          insufficientItems: []
        };

        orderItems.forEach(item => {
          const available = inventory[item.productId] || 0;
          if (available < item.quantity) {
            result.canFulfill = false;
            result.insufficientItems.push({
              productId: item.productId,
              requested: item.quantity,
              available: available
            });
          }
        });

        return result;
      };

      const orderItems = [
        { productId: 1, quantity: 5 },
        { productId: 2, quantity: 3 },
        { productId: 3, quantity: 1 }
      ];

      const inventoryCheck = checkInventory(orderItems, inventory);
      expect(inventoryCheck.canFulfill).toBe(false);
      expect(inventoryCheck.insufficientItems).toHaveLength(1);
      expect(inventoryCheck.insufficientItems[0].productId).toBe(3);
    });

    test('should update inventory after order fulfillment', () => {
      const inventory = {
        1: 10,
        2: 5,
        3: 15
      };

      const fulfillOrder = (orderItems, inventory) => {
        orderItems.forEach(item => {
          if (inventory[item.productId] !== undefined) {
            inventory[item.productId] -= item.quantity;
          }
        });
        return inventory;
      };

      const orderItems = [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 1 }
      ];

      const updatedInventory = fulfillOrder(orderItems, inventory);
      expect(updatedInventory[1]).toBe(8); // 10 - 2
      expect(updatedInventory[2]).toBe(4); // 5 - 1
      expect(updatedInventory[3]).toBe(15); // unchanged
    });

    test('should generate packing slip', () => {
      const order = {
        id: 'ORD-123',
        userId: 'user456',
        items: [
          { productId: 1, quantity: 2, name: 'Laptop' },
          { productId: 2, quantity: 1, name: 'Mouse' }
        ],
        shippingAddress: {
          name: 'John Doe',
          street: '123 Main St',
          city: 'New York',
          zipCode: '10001'
        }
      };

      const generatePackingSlip = (order) => {
        return `
PACKING SLIP
Order ID: ${order.id}
Customer: ${order.shippingAddress.name}
Address: ${order.shippingAddress.street}, ${order.shippingAddress.city} ${order.shippingAddress.zipCode}

Items:
${order.items.map(item => 
  `- ${item.name}: ${item.quantity} unit(s)`
).join('\n')}
        `.trim();
      };

      const packingSlip = generatePackingSlip(order);
      expect(packingSlip).toContain('Order ID: ORD-123');
      expect(packingSlip).toContain('Customer: John Doe');
      expect(packingSlip).toContain('Laptop: 2 unit(s)');
      expect(packingSlip).toContain('Mouse: 1 unit(s)');
    });
  });

  describe('Order Cancellation', () => {
    
    test('should validate cancellation eligibility', () => {
      const order = {
        id: 'ORD-123',
        status: 'confirmed',
        createdAt: Date.now() - 3600000, // 1 hour ago
        items: [
          { productId: 1, quantity: 2, price: 10.99 }
        ]
      };

      const canCancelOrder = (order, cancellationWindow = 24 * 60 * 60 * 1000) => {
        const now = Date.now();
        const timeSinceCreation = now - order.createdAt;
        
        return order.status === 'confirmed' && 
               order.status !== 'cancelled' &&
               timeSinceCreation <= cancellationWindow;
      };

      expect(canCancelOrder(order)).toBe(true);
      
      // Order too old
      const oldOrder = { ...order, createdAt: Date.now() - 48 * 60 * 60 * 1000 };
      expect(canCancelOrder(oldOrder)).toBe(false);
      
      // Already cancelled
      const cancelledOrder = { ...order, status: 'cancelled' };
      expect(canCancelOrder(cancelledOrder)).toBe(false);
    });

    test('should process order cancellation', () => {
      const order = {
        id: 'ORD-123',
        status: 'confirmed',
        items: [
          { productId: 1, quantity: 2, price: 10.99 }
        ],
        statusHistory: [
          { status: 'confirmed', timestamp: Date.now() }
        ]
      };

      const cancelOrder = (order, reason = 'Customer request') => {
        order.status = 'cancelled';
        order.statusHistory.push({
          status: 'cancelled',
          timestamp: Date.now(),
          reason,
          refundAmount: order.total
        });
        return order;
      };

      const cancelledOrder = cancelOrder(order, 'Out of stock');
      expect(cancelledOrder.status).toBe('cancelled');
      expect(cancelledOrder.statusHistory).toHaveLength(2);
      expect(cancelledOrder.statusHistory[1].reason).toBe('Out of stock');
      expect(cancelledOrder.statusHistory[1].refundAmount).toBeDefined();
    });
  });

  describe('Order History and Tracking', () => {
    
    test('should filter orders by status', () => {
      const orders = [
        { id: 'ORD-1', status: 'delivered' },
        { id: 'ORD-2', status: 'shipped' },
        { id: 'ORD-3', status: 'pending' },
        { id: 'ORD-4', status: 'delivered' }
      ];

      const filterOrdersByStatus = (orders, status) => {
        return orders.filter(order => order.status === status);
      };

      const deliveredOrders = filterOrdersByStatus(orders, 'delivered');
      expect(deliveredOrders).toHaveLength(2);
      expect(deliveredOrders.map(o => o.id)).toEqual(['ORD-1', 'ORD-4']);

      const pendingOrders = filterOrdersByStatus(orders, 'pending');
      expect(pendingOrders).toHaveLength(1);
      expect(pendingOrders[0].id).toBe('ORD-3');
    });

    test('should sort orders by date', () => {
      const orders = [
        { id: 'ORD-1', createdAt: Date.now() - 86400000 }, // 1 day ago
        { id: 'ORD-2', createdAt: Date.now() - 3600000 },  // 1 hour ago
        { id: 'ORD-3', createdAt: Date.now() - 172800000 } // 2 days ago
      ];

      const sortOrdersByDate = (orders, ascending = false) => {
        return [...orders].sort((a, b) => {
          return ascending ? a.createdAt - b.createdAt : b.createdAt - a.createdAt;
        });
      };

      const newestFirst = sortOrdersByDate(orders);
      expect(newestFirst[0].id).toBe('ORD-2');
      expect(newestFirst[1].id).toBe('ORD-1');
      expect(newestFirst[2].id).toBe('ORD-3');

      const oldestFirst = sortOrdersByDate(orders, true);
      expect(oldestFirst[0].id).toBe('ORD-3');
      expect(oldestFirst[1].id).toBe('ORD-1');
      expect(oldestFirst[2].id).toBe('ORD-2');
    });

    test('should calculate order statistics', () => {
      const orders = [
        { id: 'ORD-1', status: 'delivered', total: 100 },
        { id: 'ORD-2', status: 'shipped', total: 200 },
        { id: 'ORD-3', status: 'cancelled', total: 50 },
        { id: 'ORD-4', status: 'delivered', total: 150 }
      ];

      const calculateOrderStats = (orders) => {
        const delivered = orders.filter(o => o.status === 'delivered');
        const cancelled = orders.filter(o => o.status === 'cancelled');
        const totalRevenue = delivered.reduce((sum, order) => sum + order.total, 0);
        
        return {
          totalOrders: orders.length,
          deliveredOrders: delivered.length,
          cancelledOrders: cancelled.length,
          totalRevenue,
          averageOrderValue: delivered.length > 0 ? totalRevenue / delivered.length : 0
        };
      };

      const stats = calculateOrderStats(orders);
      expect(stats.totalOrders).toBe(4);
      expect(stats.deliveredOrders).toBe(2);
      expect(stats.cancelledOrders).toBe(1);
      expect(stats.totalRevenue).toBe(250); // 100 + 150
      expect(stats.averageOrderValue).toBe(125); // 250 / 2
    });
  });
});