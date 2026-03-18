const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { validateRequest } = require('../middleware/validation');
const { orderValidation } = require('../middleware/validations');
const { auth, authorize, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Get user's orders
router.get('/my', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status;

    const filters = { customerId: req.user._id };
    if (status) filters.status = status;

    const orders = await Order.find(filters)
      .populate('items.productId', 'name price images')
      .populate('items.variantId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments(filters);

    res.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all orders (admin/seller only)
router.get('/', auth, authorize('admin', 'seller'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const customerId = req.query.customerId;

    const filters = {};
    if (status) filters.status = status;
    if (customerId) filters.customerId = customerId;

    const orders = await Order.find(filters)
      .populate('customerId', 'username email')
      .populate('items.productId', 'name price images')
      .populate('items.variantId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments(filters);

    res.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get order by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customerId', 'username email profile')
      .populate('items.productId', 'name price images variants')
      .populate('items.variantId');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if user has permission to view this order
    if (!req.user || (req.user._id.toString() !== order.customerId._id.toString() && !req.user.role.includes('admin'))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new order
router.post('/', auth, validateRequest(orderValidation.create), async (req, res) => {
  try {
    const { items, shippingAddress, billingAddress, shippingMethod, notes } = req.body;

    // Calculate totals and validate inventory
    let subtotal = 0;
    const processedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(400).json({ error: `Product ${item.productId} not found` });
      }

      if (product.inventory.available < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient inventory for product ${product.name}. Available: ${product.inventory.available}` 
        });
      }

      const itemPrice = item.price || product.price;
      const totalPrice = itemPrice * item.quantity;
      
      processedItems.push({
        productId: product._id,
        variantId: item.variantId,
        quantity: item.quantity,
        price: itemPrice,
        totalPrice,
        sku: item.sku || product.sku
      });

      subtotal += totalPrice;
    }

    // Calculate shipping (this would be more complex in a real system)
    const shippingCost = shippingMethod ? shippingMethod.cost : 0;
    
    // Calculate tax (this would be more complex in a real system)
    const taxRate = 0.13; // 13% tax rate
    const tax = subtotal * taxRate;

    const total = subtotal + tax + shippingCost;

    // Create order
    const order = new Order({
      orderNumber: `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`,
      customerId: req.user._id,
      items: processedItems,
      subtotal,
      tax,
      shipping: shippingCost,
      total,
      currency: 'CNY',
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      shippingMethod,
      notes,
      metadata: {
        createdBy: req.user._id,
        updatedBy: req.user._id
      }
    });

    await order.save();

    // Update inventory
    for (const item of processedItems) {
      await Product.findByIdAndUpdate(
        item.productId,
        {
          $inc: {
            'inventory.total': -item.quantity,
            'inventory.reserved': item.quantity
          }
        }
      );
    }

    res.status(201).json({
      message: 'Order created successfully',
      order
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update order status (admin/seller only)
router.patch('/:id/status', auth, authorize('admin', 'seller'), async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'partially_refunded'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { 
        status,
        metadata: {
          updatedBy: req.user._id
        }
      },
      { new: true }
    ).populate('items.productId', 'name price images');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add tracking information (admin/seller only)
router.patch('/:id/tracking', auth, authorize('admin', 'seller'), async (req, res) => {
  try {
    const { trackingNumber, carrier } = req.body;
    
    if (!trackingNumber || !carrier) {
      return res.status(400).json({ error: 'Tracking number and carrier are required' });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { 
        'shippingMethod.trackingNumber': trackingNumber,
        'shippingMethod.carrier': carrier,
        status: 'shipped',
        metadata: {
          updatedBy: req.user._id
        }
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      message: 'Tracking information added successfully',
      order
    });
  } catch (error) {
    console.error('Add tracking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel order
router.patch('/:id/cancel', auth, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      customerId: req.user._id,
      status: 'pending'
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found or cannot be cancelled' });
    }

    // Restore inventory
    for (const item of order.items) {
      await Product.findByIdAndUpdate(
        item.productId,
        {
          $inc: {
            'inventory.total': item.quantity,
            'inventory.reserved': -item.quantity
          }
        }
      );
    }

    order.status = 'cancelled';
    await order.save();

    res.json({
      message: 'Order cancelled successfully',
      order
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get order statistics (admin only)
router.get('/stats/overview', auth, authorize('admin'), async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const processingOrders = await Order.countDocuments({ status: 'processing' });
    const shippedOrders = await Order.countDocuments({ status: 'shipped' });
    const deliveredOrders = await Order.countDocuments({ status: 'delivered' });
    const cancelledOrders = await Order.countDocuments({ status: 'cancelled' });
    const refundedOrders = await Order.countDocuments({ status: 'refunded' });

    const totalRevenue = await Order.aggregate([
      { $match: { status: { $in: ['delivered', 'shipped'] } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);

    const todayOrders = await Order.countDocuments({
      createdAt: { $gte: new Date().setHours(0, 0, 0, 0) }
    });

    res.json({
      totalOrders,
      pendingOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      refundedOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      todayOrders
    });
  } catch (error) {
    console.error('Get order stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;