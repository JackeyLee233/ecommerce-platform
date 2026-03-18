const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'CNY',
    uppercase: true
  },
  sku: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  brand: {
    type: String,
    trim: true
  },
  images: [{
    url: { type: String, required: true },
    alt: { type: String, trim: true },
    isPrimary: { type: Boolean, default: false }
  }],
  variants: [{
    name: { type: String, required: true },
    value: { type: String, required: true },
    price: { type: Number, min: 0 },
    sku: { type: String, required: true },
    inventory: { type: Number, min: 0, default: 0 }
  }],
  inventory: {
    total: { type: Number, min: 0, default: 0 },
    reserved: { type: Number, min: 0, default: 0 },
    available: { type: Number, min: 0, default: 0 }
  },
  weight: {
    value: { type: Number, min: 0 },
    unit: { type: String, default: 'g' }
  },
  dimensions: {
    length: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    unit: { type: String, default: 'cm' }
  },
  shipping: {
    weight: { type: Number, min: 0 },
    dimensions: {
      length: { type: Number, min: 0 },
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 }
    },
    fragile: { type: Boolean, default: false },
    requiresSpecialHandling: { type: Boolean, default: false }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'discontinued', 'out_of_stock'],
    default: 'active'
  },
  tags: [{
    type: String,
    trim: true
  }],
  seo: {
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    keywords: [{ type: String, trim: true }]
  },
  ratings: {
    average: { type: Number, min: 0, max: 5, default: 0 },
    count: { type: Number, min: 0, default: 0 }
  },
  sales: {
    total: { type: Number, min: 0, default: 0 },
    monthly: { type: Number, min: 0, default: 0 }
  },
  metadata: {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }
}, {
  timestamps: true
});

// Update available inventory when total or reserved changes
productSchema.pre('save', function(next) {
  this.inventory.available = this.inventory.total - this.inventory.reserved;
  next();
});

// Search index
productSchema.index({ 
  name: 'text', 
  description: 'text',
  'seo.title': 'text',
  'seo.description': 'text',
  tags: 'text'
});

module.exports = mongoose.model('Product', productSchema);