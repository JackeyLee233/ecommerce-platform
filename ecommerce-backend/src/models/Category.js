const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  level: {
    type: Number,
    min: 0,
    default: 0
  },
  children: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  icon: {
    type: String,
    trim: true
  },
  image: {
    url: { type: String, trim: true },
    alt: { type: String, trim: true }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  seo: {
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    keywords: [{ type: String, trim: true }]
  },
  metadata: {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }
}, {
  timestamps: true
});

// Auto-calculate level based on parent
categorySchema.pre('save', async function(next) {
  if (this.parent) {
    const parent = await mongoose.model('Category').findById(this.parent);
    if (parent) {
      this.level = parent.level + 1;
    }
  } else {
    this.level = 0;
  }
  next();
});

// Update children when parent changes
categorySchema.pre('save', async function(next) {
  if (this.isModified('parent') && this.parent) {
    // Add this category to parent's children array
    await mongoose.model('Category').updateOne(
      { _id: this.parent },
      { $addToSet: { children: this._id } }
    );
  }
  next();
});

// Search index
categorySchema.index({ name: 'text', description: 'text', 'seo.title': 'text' });
categorySchema.index({ parent: 1, displayOrder: 1 });

module.exports = mongoose.model('Category', categorySchema);