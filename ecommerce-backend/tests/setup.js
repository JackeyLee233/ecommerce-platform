// Test setup file
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Global test variables
let mongoServer;

// Before all tests
beforeAll(async () => {
  // Start in-memory MongoDB server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Connect to the in-memory database
  await mongoose.connect(mongoUri);
});

// After all tests
afterAll(async () => {
  // Disconnect from database
  await mongoose.disconnect();
  
  // Stop in-memory MongoDB server
  if (mongoServer) {
    await mongoServer.stop();
  }
});

// Before each test
beforeEach(async () => {
  // Clear all collections
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

// Global test utilities
global.createTestUser = async (userData = {}) => {
  const defaultData = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'Password123!'
  };
  
  const user = new mongoose.models.User({
    ...defaultData,
    ...userData
  });
  
  return await user.save();
};

global.createTestProduct = async (productData = {}) => {
  const defaultData = {
    name: 'Test Product',
    description: 'Test product description',
    price: 99.99,
    sku: 'TEST001',
    category: new mongoose.Types.ObjectId(),
    inventory: { total: 100 }
  };
  
  const product = new mongoose.models.Product({
    ...defaultData,
    ...productData
  });
  
  return await product.save();
};

global.createTestOrder = async (orderData = {}) => {
  const user = await createTestUser();
  const product = await createTestProduct();
  
  const defaultData = {
    customerId: user._id,
    items: [{
      productId: product._id,
      quantity: 2,
      price: product.price,
      totalPrice: product.price * 2,
      sku: product.sku
    }],
    subtotal: product.price * 2,
    tax: 0,
    shipping: 0,
    total: product.price * 2,
    currency: 'CNY',
    status: 'pending'
  };
  
  const order = new mongoose.models.Order({
    ...defaultData,
    ...orderData
  });
  
  return await order.save();
};