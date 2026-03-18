const express = require('express');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Get payment by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('orderId')
      .populate('customerId', 'username email');

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Check permissions
    if (req.user.role !== 'admin' && payment.customerId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(payment);
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create payment for order
router.post('/create', auth, async (req, res) => {
  try {
    const { orderId, paymentMethod, paymentGateway } = req.body;

    // Find and validate order
    const order = await Order.findOne({
      _id: orderId,
      customerId: req.user._id,
      status: 'pending'
    });

    if (!order) {
      return res.status(400).json({ error: 'Invalid order or order cannot be paid for' });
    }

    // Create payment record
    const payment = new Payment({
      orderId: order._id,
      customerId: req.user._id,
      amount: order.total,
      currency: order.currency,
      paymentMethod,
      paymentGateway,
      status: 'pending'
    });

    await payment.save();

    // Process payment based on gateway (simplified for demo)
    try {
      let paymentResult;
      
      switch (paymentGateway.provider) {
        case 'stripe':
          // In a real implementation, you would use Stripe API
          paymentResult = {
            success: true,
            transactionId: `stripe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          };
          break;
          
        case 'alipay':
          // In a real implementation, you would use Alipay API
          paymentResult = {
            success: true,
            transactionId: `alipay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          };
          break;
          
        case 'wechat':
          // In a real implementation, you would use WeChat Pay API
          paymentResult = {
            success: true,
            transactionId: `wechat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          };
          break;
          
        default:
          throw new Error('Unsupported payment gateway');
      }

      // Update payment with result
      payment.paymentGateway.transactionId = paymentResult.transactionId;
      payment.status = paymentResult.success ? 'completed' : 'failed';
      payment.processedAt = new Date();
      
      if (paymentResult.success) {
        payment.completedAt = new Date();
        
        // Update order status
        order.status = 'confirmed';
        order.payment.status = 'completed';
        order.payment.paidAt = new Date();
        await order.save();
      } else {
        payment.errorMessage = 'Payment processing failed';
      }

      await payment.save();

      res.json({
        message: paymentResult.success ? 'Payment successful' : 'Payment failed',
        payment
      });

    } catch (paymentError) {
      payment.status = 'failed';
      payment.errorMessage = paymentError.message;
      payment.failureReason = 'Payment gateway error';
      await payment.save();

      res.status(400).json({
        message: 'Payment failed',
        error: paymentError.message,
        payment
      });
    }

  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Process refund (admin only)
router.post('/:id/refund', auth, authorize('admin'), async (req, res) => {
  try {
    const { amount, reason } = req.body;

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status !== 'completed') {
      return res.status(400).json({ error: 'Only completed payments can be refunded' });
    }

    // Calculate refund amount
    const refundAmount = amount || payment.netAmount;
    if (refundAmount <= 0) {
      return res.status(400).json({ error: 'Refund amount must be positive' });
    }

    if (refundAmount > payment.netAmount) {
      return res.status(400).json({ error: 'Refund amount cannot exceed payment amount' });
    }

    // Process refund (simplified for demo)
    try {
      // In a real implementation, you would call the payment gateway's refund API
      const refundResult = {
        success: true,
        refundId: `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      // Add refund record
      payment.refunds.push({
        amount: refundAmount,
        reason: reason || 'Customer request',
        refundId: refundResult.refundId,
        processedAt: new Date(),
        status: 'completed'
      });

      // Update payment status
      if (payment.netAmount - refundAmount <= 0) {
        payment.status = 'refunded';
        payment.refundedAt = new Date();
      } else {
        payment.status = 'partially_refunded';
      }

      await payment.save();

      // Update order
      const order = await Order.findById(payment.orderId);
      if (order) {
        order.payment.refundAmount = payment.totalRefunded;
        if (payment.status === 'refunded') {
          order.status = 'refunded';
        } else {
          order.status = 'partially_refunded';
        }
        await order.save();
      }

      res.json({
        message: 'Refund processed successfully',
        payment
      });

    } catch (refundError) {
      payment.refunds[payment.refunds.length - 1].status = 'failed';
      await payment.save();

      res.status(400).json({
        message: 'Refund failed',
        error: refundError.message,
        payment
      });
    }

  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get payment methods
router.get('/methods/list', (req, res) => {
  const methods = [
    {
      id: 'credit_card',
      name: 'Credit Card',
      description: 'Pay with Visa, MasterCard, or other credit cards',
      currencies: ['CNY', 'USD', 'EUR']
    },
    {
      id: 'debit_card',
      name: 'Debit Card',
      description: 'Pay with your debit card',
      currencies: ['CNY', 'USD', 'EUR']
    },
    {
      id: 'alipay',
      name: 'Alipay',
      description: 'Pay with Alipay',
      currencies: ['CNY']
    },
    {
      id: 'wechat_pay',
      name: 'WeChat Pay',
      description: 'Pay with WeChat Pay',
      currencies: ['CNY']
    },
    {
      id: 'bank_transfer',
      name: 'Bank Transfer',
      description: 'Pay via bank transfer',
      currencies: ['CNY', 'USD', 'EUR']
    }
  ];

  res.json(methods);
});

// Get payment statistics (admin only)
router.get('/stats/overview', auth, authorize('admin'), async (req, res) => {
  try {
    const totalPayments = await Payment.countDocuments();
    const successfulPayments = await Payment.countDocuments({ status: 'completed' });
    const failedPayments = await Payment.countDocuments({ status: 'failed' });
    const refundedPayments = await Payment.countDocuments({ status: 'refunded' });
    const partiallyRefundedPayments = await Payment.countDocuments({ status: 'partially_refunded' });

    const totalRevenue = await Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalRefunds = await Payment.aggregate([
      { $match: { status: { $in: ['refunded', 'partially_refunded'] } } },
      { $group: { _id: null, total: { $sum: '$totalRefunded' } } }
    ]);

    const todayPayments = await Payment.countDocuments({
      createdAt: { $gte: new Date().setHours(0, 0, 0, 0) }
    });

    res.json({
      totalPayments,
      successfulPayments,
      failedPayments,
      refundedPayments,
      partiallyRefundedPayments,
      totalRevenue: totalRevenue[0]?.total || 0,
      totalRefunds: totalRefunds[0]?.total || 0,
      todayPayments
    });
  } catch (error) {
    console.error('Get payment stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;