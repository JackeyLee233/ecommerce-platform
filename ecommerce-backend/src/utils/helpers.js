// Utility functions for the e-commerce backend

// Generate unique order number
const generateOrderNumber = () => {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD${timestamp.slice(-8)}${random}`;
};

// Calculate tax amount
const calculateTax = (amount, taxRate = 0.13) => {
  return parseFloat((amount * taxRate).toFixed(2));
};

// Calculate shipping cost (simplified)
const calculateShipping = (weight, distance = 0, isFragile = false) => {
  const baseRate = 5; // Base shipping cost
  const weightRate = weight * 0.1; // Cost per kg
  const distanceRate = distance * 0.01; // Cost per km
  const fragileSurcharge = isFragile ? 10 : 0; // Fragile item surcharge
  
  return parseFloat((baseRate + weightRate + distanceRate + fragileSurcharge).toFixed(2));
};

// Format currency
const formatCurrency = (amount, currency = 'CNY') => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: currency
  }).format(amount);
};

// Validate Chinese phone number
const isValidChinesePhone = (phone) => {
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
};

// Validate Chinese ID card number
const isValidChineseIdCard = (idCard) => {
  const idCardRegex = /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}(\d|X|x)$/;
  return idCardRegex.test(idCard);
};

// Sanitize input data
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  // Remove potentially dangerous characters
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
};

// Pagination helper
const getPagination = (page = 1, limit = 10) => {
  const offset = (page - 1) * limit;
  return { offset, limit };
};

// Build search query
const buildSearchQuery = (searchTerm, fields) => {
  if (!searchTerm) return {};
  
  const searchRegex = new RegExp(searchTerm, 'i');
  const query = {};
  
  if (fields && fields.length > 0) {
    query.$or = fields.map(field => ({
      [field]: searchRegex
    }));
  }
  
  return query;
};

// Error handler
const errorHandler = (error, req, res, next) => {
  console.error('Error:', error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: Object.values(error.errors).map(err => err.message)
    });
  }
  
  if (error.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID format'
    });
  }
  
  if (error.code === 11000) {
    return res.status(400).json({
      error: 'Duplicate entry',
      field: Object.keys(error.keyPattern)[0]
    });
  }
  
  res.status(500).json({
    error: 'Internal server error'
  });
};

// Success response helper
const successResponse = (res, message, data = null, status = 200) => {
  const response = { success: true, message };
  if (data !== null) {
    response.data = data;
  }
  return res.status(status).json(response);
};

// Error response helper
const errorResponse = (res, message, status = 400, details = null) => {
  const response = { success: false, message };
  if (details) {
    response.details = details;
  }
  return res.status(status).json(response);
};

module.exports = {
  generateOrderNumber,
  calculateTax,
  calculateShipping,
  formatCurrency,
  isValidChinesePhone,
  isValidChineseIdCard,
  sanitizeInput,
  getPagination,
  buildSearchQuery,
  errorHandler,
  successResponse,
  errorResponse
};