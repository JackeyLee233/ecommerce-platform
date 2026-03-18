const express = require('express');
const Product = require('../models/Product');
const Category = require('../models/Category');
const { validateRequest } = require('../middleware/validation');
const { productValidation } = require('../middleware/validations');
const { auth, authorize, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Get all products with pagination and filtering
router.get('/', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filters = {};
    
    // Category filter
    if (req.query.category) {
      filters.category = req.query.category;
    }
    
    // Price range filter
    if (req.query.minPrice || req.query.maxPrice) {
      filters.price = {};
      if (req.query.minPrice) filters.price.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice) filters.price.$lte = parseFloat(req.query.maxPrice);
    }
    
    // Status filter
    if (req.query.status) {
      filters.status = req.query.status;
    }
    
    // Search filter
    if (req.query.search) {
      filters.$text = { $search: req.query.search };
    }

    const sort = {};
    if (req.query.sort) {
      const [field, order] = req.query.sort.split(':');
      sort[field] = order === 'desc' ? -1 : 1;
    } else {
      sort.createdAt = -1;
    }

    const products = await Product.find(filters)
      .populate('category', 'name slug')
      .skip(skip)
      .limit(limit)
      .sort(sort);

    const total = await Product.countDocuments(filters);

    res.json({
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get product by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name slug')
      .populate('metadata.createdBy', 'username')
      .populate('metadata.updatedBy', 'username');

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create product (admin/seller only)
router.post('/', auth, authorize('admin', 'seller'), validateRequest(productValidation.create), async (req, res) => {
  try {
    const productData = {
      ...req.body,
      metadata: {
        createdBy: req.user._id,
        updatedBy: req.user._id
      }
    };

    // Check if category exists
    const category = await Category.findById(req.body.category);
    if (!category) {
      return res.status(400).json({ error: 'Category not found' });
    }

    const product = new Product(productData);
    await product.save();

    res.status(201).json({
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update product (admin/seller only)
router.put('/:id', auth, authorize('admin', 'seller'), validateRequest(productValidation.update), async (req, res) => {
  try {
    const updates = {
      ...req.body,
      metadata: {
        updatedBy: req.user._id
      }
    };

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('category', 'name slug');

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete product (admin only)
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update product inventory (admin/seller only)
router.patch('/:id/inventory', auth, authorize('admin', 'seller'), async (req, res) => {
  try {
    const { total, reserved } = req.body;
    
    if (total === undefined && reserved === undefined) {
      return res.status(400).json({ error: 'Either total or reserved inventory must be provided' });
    }

    const updates = {};
    if (total !== undefined) updates['inventory.total'] = total;
    if (reserved !== undefined) updates['inventory.reserved'] = reserved;

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({
      message: 'Inventory updated successfully',
      product
    });
  } catch (error) {
    console.error('Update inventory error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update product status (admin/seller only)
router.patch('/:id/status', auth, authorize('admin', 'seller'), async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['active', 'inactive', 'discontinued', 'out_of_stock'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({
      message: 'Product status updated successfully',
      product
    });
  } catch (error) {
    console.error('Update product status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get product categories
router.get('/categories/list', async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .select('name slug description level parent displayOrder')
      .sort({ displayOrder: 1, level: 1 });

    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get product statistics (admin only)
router.get('/stats/overview', auth, authorize('admin'), async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ status: 'active' });
    const outOfStockProducts = await Product.countDocuments({ status: 'out_of_stock' });
    const lowStockProducts = await Product.countDocuments({
      'inventory.available': { $lt: 10 }
    });

    res.json({
      totalProducts,
      activeProducts,
      outOfStockProducts,
      lowStockProducts
    });
  } catch (error) {
    console.error('Get product stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;