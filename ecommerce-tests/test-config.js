/**
 * Test Configuration and Utilities for E-commerce Platform
 */

// Test environment configuration
const config = {
  // API endpoints
  api: {
    baseUrl: 'http://localhost:3000/api',
    auth: '/auth',
    products: '/products',
    cart: '/cart',
    orders: '/orders',
    payment: '/payment'
  },

  // Test user data
  testUsers: {
    validUser: {
      email: 'test@example.com',
      password: 'TestPassword123!',
      name: 'Test User'
    },
    existingUser: {
      email: 'existing@example.com',
      password: 'ExistingPassword123!'
    }
  },

  // Test product data
  testProducts: [
    {
      id: 1,
      name: 'Laptop',
      price: 999.99,
      category: 'Electronics',
      stock: 10
    },
    {
      id: 2,
      name: 'Smartphone',
      price: 699.99,
      category: 'Electronics',
      stock: 15
    },
    {
      id: 3,
      name: 'Headphones',
      price: 199.99,
      category: 'Audio',
      stock: 25
    }
  ],

  // Test payment methods
  testPaymentMethods: {
    creditCard: {
      number: '4111111111111111',
      expiry: '12/25',
      cvv: '123',
      name: 'Test User'
    },
    paypal: {
      email: 'test@example.com'
    }
  }
};

// Database setup and teardown utilities
const dbUtils = {
  // Clear test database
  async clearDatabase() {
    // Implementation depends on your database
    // Example for MongoDB:
    // await mongoose.connection.collections.users.deleteMany({});
    // await mongoose.connection.collections.products.deleteMany({});
    // await mongoose.connection.collections.orders.deleteMany({});
    // await mongoose.connection.collections.carts.deleteMany({});
  },

  // Setup test data
  async setupTestData() {
    await this.clearDatabase();
    // Insert test users, products, etc.
  },

  // Teardown after tests
  async teardown() {
    await this.clearDatabase();
  }
};

// API test utilities
const apiUtils = {
  // Generate authentication token
  async getAuthToken(user) {
    const response = await fetch(`${config.api.baseUrl}${config.api.auth}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: user.email,
        password: user.password
      })
    });
    
    const data = await response.json();
    return data.token;
  },

  // Create authenticated request
  async createAuthRequest(user, method = 'GET', endpoint = '', data = null) {
    const token = await this.getAuthToken(user);
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const options = {
      method,
      headers
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    return fetch(`${config.api.baseUrl}${endpoint}`, options);
  }
};

// Mock data generators
const mockGenerators = {
  // Generate random user data
  generateUser(overrides = {}) {
    return {
      email: `user-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      name: 'Test User',
      ...overrides
    };
  },

  // Generate random product data
  generateProduct(overrides = {}) {
    return {
      name: `Product ${Date.now()}`,
      price: Math.random() * 1000 + 10,
      category: 'Electronics',
      stock: Math.floor(Math.random() * 50) + 1,
      ...overrides
    };
  },

  // Generate random order data
  generateOrder(userId, items = []) {
    return {
      userId,
      items: items.length > 0 ? items : [
        {
          productId: 1,
          quantity: 1,
          price: 99.99
        }
      ],
      total: 99.99,
      status: 'pending',
      shippingAddress: {
        street: '123 Test St',
        city: 'Test City',
        zipCode: '12345',
        country: 'Test Country'
      }
    };
  }
};

// Test assertion helpers
const assertHelpers = {
  // Assert successful API response
  assertSuccess(response, expectedStatusCode = 200) {
    expect(response.status).toBe(expectedStatusCode);
    expect(response.body).toHaveProperty('success');
    expect(response.body.success).toBe(true);
  },

  // Assert error response
  assertError(response, expectedStatusCode = 400) {
    expect(response.status).toBe(expectedStatusCode);
    expect(response.body).toHaveProperty('error');
  },

  // Assert validation error
  assertValidationError(response, field) {
    this.assertError(response, 400);
    expect(response.body.errors).toBeDefined();
    expect(response.body.errors).toContainEqual(
      expect.objectContaining({
        field,
        message: expect.any(String)
      })
    );
  }
};

module.exports = {
  config,
  dbUtils,
  apiUtils,
  mockGenerators,
  assertHelpers
};