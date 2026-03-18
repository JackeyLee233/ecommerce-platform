const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'CNY',
    uppercase: true
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'paypal', 'alipay', 'wechat_pay', 'bank_transfer'],
    required: true
  },
  paymentGateway: {
    provider: {
      type: String,
      enum: ['stripe', 'alipay', 'wechat', 'paypal'],
      required: true
    },
    transactionId: { type: String, required: true }
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded'],
    default: 'pending'
  },
  details: {
    card: {
      last4: { type: String },
      brand: { type: String },
      expMonth: { type: Number },
      expYear: { type: Number }
    },
    bank: {
      account: { type: String },
      bankName: { type: String }
    },
    alipay: {
      tradeNo: { type: String }
    },
    wechat: {
      transactionId: { type: String }
    }
  },
  refunds: [{
    amount: { type: Number, min: 0 },
    reason: { type: String },
    refundId: { type: String },
    processedAt: { type: Date },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending'
    }
  }],
  metadata: {
    ip: { type: String },
    userAgent: { type: String },
    fraudScore: { type: Number },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low'
    }
  },
  processedAt: { type: Date },
  completedAt: { type: Date },
  cancelledAt: { type: Date },
  errorMessage: { type: String },
  failureReason: { type: String }
}, {
  timestamps: true
});

// Update timestamps based on status changes
paymentSchema.pre('save', function(next) {
  const now = new Date();
  
  if (this.status === 'completed' && !this.completedAt) {
    this.completedAt = now;
  } else if (this.status === 'processing' && !this.processedAt) {
    this.processedAt = now;
  } else if (this.status === 'cancelled' && !this.cancelledAt) {
    this.cancelledAt = now;
  }
  
  next();
});

// Add refund amount calculation
paymentSchema.virtual('totalRefunded').get(function() {
  return this.refunds.reduce((total, refund) => total + refund.amount, 0);
});

paymentSchema.virtual('netAmount').get(function() {
  return this.amount - this.totalRefunded;
});

// Search index
paymentSchema.index({ orderId: 1, customerId: 1, status: 1 });
paymentSchema.index({ 'paymentGateway.transactionId': 1 });

module.exports = mongoose.model('Payment', paymentSchema);