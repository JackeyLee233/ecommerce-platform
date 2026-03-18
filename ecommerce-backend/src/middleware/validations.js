const { body } = require('express-validator');

const userValidation = {
  register: [
    body('username')
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be between 3 and 30 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores'),
    
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),
    
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    
    body('profile.firstName')
      .optional()
      .isLength({ max: 50 })
      .withMessage('First name must be less than 50 characters'),
    
    body('profile.lastName')
      .optional()
      .isLength({ max: 50 })
      .withMessage('Last name must be less than 50 characters'),
    
    body('profile.phone')
      .optional()
      .isMobilePhone('zh-CN')
      .withMessage('Please provide a valid Chinese phone number')
  ],
  
  login: [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),
    
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],
  
  updateProfile: [
    body('profile.firstName')
      .optional()
      .isLength({ max: 50 })
      .withMessage('First name must be less than 50 characters'),
    
    body('profile.lastName')
      .optional()
      .isLength({ max: 50 })
      .withMessage('Last name must be less than 50 characters'),
    
    body('profile.phone')
      .optional()
      .isMobilePhone('zh-CN')
      .withMessage('Please provide a valid Chinese phone number'),
    
    body('profile.address.street')
      .optional()
      .isLength({ max: 100 })
      .withMessage('Street address must be less than 100 characters'),
    
    body('profile.address.city')
      .optional()
      .isLength({ max: 50 })
      .withMessage('City must be less than 50 characters'),
    
    body('profile.address.state')
      .optional()
      .isLength({ max: 50 })
      .withMessage('State must be less than 50 characters'),
    
    body('profile.address.zipCode')
      .optional()
      .isLength({ min: 4, max: 10 })
      .withMessage('Zip code must be between 4 and 10 characters')
  ]
};

const productValidation = {
  create: [
    body('name')
      .isLength({ min: 1, max: 200 })
      .withMessage('Product name must be between 1 and 200 characters'),
    
    body('description')
      .isLength({ min: 1, max: 2000 })
      .withMessage('Description must be between 1 and 2000 characters'),
    
    body('price')
      .isFloat({ min: 0 })
      .withMessage('Price must be a positive number'),
    
    body('sku')
      .isLength({ min: 1, max: 50 })
      .withMessage('SKU must be between 1 and 50 characters'),
    
    body('category')
      .isMongoId()
      .withMessage('Invalid category ID'),
    
    body('inventory.total')
      .isInt({ min: 0 })
      .withMessage('Total inventory must be a non-negative integer')
  ],
  
  update: [
    body('name')
      .optional()
      .isLength({ min: 1, max: 200 })
      .withMessage('Product name must be between 1 and 200 characters'),
    
    body('description')
      .optional()
      .isLength({ min: 1, max: 2000 })
      .withMessage('Description must be between 1 and 2000 characters'),
    
    body('price')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Price must be a positive number'),
    
    body('inventory.total')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Total inventory must be a non-negative integer')
  ]
};

const orderValidation = {
  create: [
    body('items')
      .isArray({ min: 1 })
      .withMessage('Order must contain at least one item'),
    
    body('items.*.productId')
      .isMongoId()
      .withMessage('Invalid product ID'),
    
    body('items.*.quantity')
      .isInt({ min: 1 })
      .withMessage('Quantity must be a positive integer'),
    
    body('shippingAddress.name')
      .notEmpty()
      .withMessage('Recipient name is required'),
    
    body('shippingAddress.phone')
      .notEmpty()
      .withMessage('Phone number is required'),
    
    body('shippingAddress.email')
      .isEmail()
      .withMessage('Invalid email address'),
    
    body('shippingAddress.address.street')
      .notEmpty()
      .withMessage('Street address is required'),
    
    body('shippingAddress.address.city')
      .notEmpty()
      .withMessage('City is required'),
    
    body('shippingAddress.address.state')
      .notEmpty()
      .withMessage('State is required'),
    
    body('shippingAddress.address.zipCode')
      .notEmpty()
      .withMessage('Zip code is required')
  ]
};

module.exports = {
  userValidation,
  productValidation,
  orderValidation
};