/**
 * Integration Tests for Shopping Cart
 * 
 * Tests integration between cart components, product catalog, 
 * inventory system, and user authentication for shopping cart functionality.
 */

const { 
  config, 
  dbUtils, 
  apiUtils, 
  mockGenerators,
  assertHelpers 
} = require('../test-config');
const request = require('supertest');

describe('Shopping Cart - Integration Tests', () => {
  
  let testServer;
  let testDbConnection;
  let authToken;
  let testUser;

  beforeAll(async () => {
    // Setup test database and server
    testDbConnection = await setupTestDatabase();
    testServer = await setupTestServer();
    
    // Clear database before tests
    await dbUtils.clearDatabase();
    
    // Create test user and get auth token
    testUser = mockGenerators.generateUser();
    await request(testServer)
      .post(`${config.api.baseUrl}${config.api.auth}/register`)
      .send(testUser)
      .expect(201);
    
    const loginResponse = await request(testServer)
      .post(`${config.api.baseUrl}${config.api.auth}/login`)
      .send({
        email: testUser.email,
        password: testUser.password
      })
      .expect(200);
    
    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    // Cleanup
    await testServer.close();
    await dbUtils.teardown();
    await testDbConnection.close();
  });

  describe('Cart Operations Integration', () => {
    
    test('should add item to cart with valid data', async () => {
      const product = config.testProducts[0];
      const cartData = {
        productId: product.id,
        quantity: 2,
        price: product.price
      };

      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(cartData)
        .expect(200);

      assertHelpers.assertSuccess(response);
      expect(response.body).toHaveProperty('cart');
      expect(response.body.cart).toHaveLength(1);
      expect(response.body.cart[0]).toEqual({
        productId: product.id,
        quantity: 2,
        price: product.price
      });

      // Verify cart in database
      const dbCart = await dbUtils.getUserCart(testUser.id);
      expect(dbCart).toHaveLength(1);
      expect(dbCart[0].productId).toBe(product.id);
    });

    test('should add multiple items to cart', async () => {
      // Add first item
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: config.testProducts[0].id,
          quantity: 1,
          price: config.testProducts[0].price
        })
        .expect(200);

      // Add second item
      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: config.testProducts[1].id,
          quantity: 3,
          price: config.testProducts[1].price
        })
        .expect(200);

      assertHelpers.assertSuccess(response);
      expect(response.body.cart).toHaveLength(2);
      
      // Verify both items in cart
      const dbCart = await dbUtils.getUserCart(testUser.id);
      expect(dbCart).toHaveLength(2);
      expect(dbCart.map(item => item.productId)).toContain(config.testProducts[0].id);
      expect(dbCart.map(item => item.productId)).toContain(config.testProducts[1].id);
    });

    test('should increase quantity when adding existing item', async () => {
      const productId = config.testProducts[0].id;
      
      // Add item first time
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: productId,
          quantity: 2,
          price: config.testProducts[0].price
        })
        .expect(200);

      // Add same item again
      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: productId,
          quantity: 1,
          price: config.testProducts[0].price
        })
        .expect(200);

      assertHelpers.assertSuccess(response);
      expect(response.body.cart).toHaveLength(1); // Still one item
      expect(response.body.cart[0].quantity).toBe(3); // 2 + 1

      // Verify in database
      const dbCart = await dbUtils.getUserCart(testUser.id);
      expect(dbCart).toHaveLength(1);
      expect(dbCart[0].quantity).toBe(3);
    });

    test('should remove item from cart', async () => {
      // Add item first
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: config.testProducts[0].id,
          quantity: 2,
          price: config.testProducts[0].price
        })
        .expect(200);

      // Remove item
      const response = await request(testServer)
        .delete(`${config.api.baseUrl}${config.api.cart}/remove/${config.testProducts[0].id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      assertHelpers.assertSuccess(response);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('removed');

      // Verify item removed from database
      const dbCart = await dbUtils.getUserCart(testUser.id);
      expect(dbCart).toHaveLength(0);
    });

    test('should update item quantity in cart', async () => {
      const productId = config.testProducts[0].id;
      
      // Add item first
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: productId,
          quantity: 2,
          price: config.testProducts[0].price
        })
        .expect(200);

      // Update quantity
      const response = await request(testServer)
        .put(`${config.api.baseUrl}${config.api.cart}/update/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quantity: 5 })
        .expect(200);

      assertHelpers.assertSuccess(response);
      expect(response.body.cart).toHaveLength(1);
      expect(response.body.cart[0].quantity).toBe(5);

      // Verify in database
      const dbCart = await dbUtils.getUserCart(testUser.id);
      expect(dbCart).toHaveLength(1);
      expect(dbCart[0].quantity).toBe(5);
    });

    test('should clear entire cart', async () => {
      // Add multiple items
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: config.testProducts[0].id,
          quantity: 2,
          price: config.testProducts[0].price
        })
        .expect(200);

      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: config.testProducts[1].id,
          quantity: 1,
          price: config.testProducts[1].price
        })
        .expect(200);

      // Clear cart
      const response = await request(testServer)
        .delete(`${config.api.baseUrl}${config.api.cart}/clear`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      assertHelpers.assertSuccess(response);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('cleared');

      // Verify cart is empty
      const dbCart = await dbUtils.getUserCart(testUser.id);
      expect(dbCart).toHaveLength(0);
    });
  });

  describe('Cart Validation Integration', () => {
    
    test('should validate product ID exists', async () => {
      const invalidProductId = 99999; // Non-existent product
      
      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: invalidProductId,
          quantity: 1,
          price: 10.99
        })
        .expect(400);

      assertHelpers.assertError(response, 400);
      expect(response.body.error).toContain('product not found');
    });

    test('should validate quantity is positive', async () => {
      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: config.testProducts[0].id,
          quantity: -1,
          price: config.testProducts[0].price
        })
        .expect(400);

      assertHelpers.assertValidationError(response, 'quantity');
    });

    test('should validate quantity maximum limit', async () => {
      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: config.testProducts[0].id,
          quantity: 100, // Exceeds maximum
          price: config.testProducts[0].price
        })
        .expect(400);

      assertHelpers.assertValidationError(response, 'quantity');
    });

    test('should validate price format', async () => {
      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: config.testProducts[0].id,
          quantity: 1,
          price: -10.99
        })
        .expect(400);

      assertHelpers.assertValidationError(response, 'price');
    });

    test('should validate cart total maximum limit', async () => {
      // Add expensive items to exceed limit
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: config.testProducts[0].id,
          quantity: 10,
          price: 1000 // Total would be 10,000
        })
        .expect(400);

      // Verify cart remains empty
      const dbCart = await dbUtils.getUserCart(testUser.id);
      expect(dbCart).toHaveLength(0);
    });
  });

  describe('Cart Inventory Integration', () => {
    
    test('should check stock availability before adding', async () => {
      // Mock low stock product
      const lowStockProduct = {
        id: 999,
        name: 'Low Stock Item',
        price: 19.99,
        stock: 2
      };
      
      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: lowStockProduct.id,
          quantity: 3, // More than available stock
          price: lowStockProduct.price
        })
        .expect(400);

      assertHelpers.assertError(response, 400);
      expect(response.body.error).toContain('insufficient stock');
    });

    test('should update inventory when items are added to cart', async () => {
      const product = config.testProducts[0];
      const originalStock = product.stock;
      
      // Add item to cart
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: product.id,
          quantity: 2,
          price: product.price
        })
        .expect(200);

      // Verify inventory decreased
      const updatedProduct = await dbUtils.getProductById(product.id);
      expect(updatedProduct.stock).toBe(originalStock - 2);
    });

    test('should restore inventory when items are removed from cart', async () => {
      const product = config.testProducts[0];
      const originalStock = product.stock;
      
      // Add item to cart
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: product.id,
          quantity: 2,
          price: product.price
        })
        .expect(200);

      // Remove item from cart
      await request(testServer)
        .delete(`${config.api.baseUrl}${config.api.cart}/remove/${product.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify inventory restored
      const updatedProduct = await dbUtils.getProductById(product.id);
      expect(updatedProduct.stock).toBe(originalStock);
    });

    test('should handle inventory reservation during cart operations', async () => {
      const product = config.testProducts[0];
      const originalStock = product.stock;
      
      // Add item to cart (reserve inventory)
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: product.id,
          quantity: 3,
          price: product.price
        })
        .expect(200);

      // Try to add same item from different user (should fail due to reserved stock)
      const otherUser = mockGenerators.generateUser();
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/register`)
        .send(otherUser)
        .expect(201);

      const otherUserLogin = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/login`)
        .send({
          email: otherUser.email,
          password: otherUser.password
        })
        .expect(200);

      const otherUserToken = otherUserLogin.body.token;

      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          productId: product.id,
          quantity: 1,
          price: product.price
        })
        .expect(400);

      expect(response.body.error).toContain('insufficient stock');
    });
  });

  describe('Cart Persistence Integration', () {
    
    test('should persist cart across user sessions', async () => {
      // Add items to cart
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: config.testProducts[0].id,
          quantity: 2,
          price: config.testProducts[0].price
        })
        .expect(200);

      // Get fresh token (simulate new session)
      const freshLogin = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/login`)
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      const freshToken = freshLogin.body.token;

      // Verify cart persists with new token
      const response = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.cart}`)
        .set('Authorization', `Bearer ${freshToken}`)
        .expect(200);

      assertHelpers.assertSuccess(response);
      expect(response.body.cart).toHaveLength(1);
      expect(response.body.cart[0].quantity).toBe(2);
    });

    test('should merge carts from different sessions', async () => {
      // Add item with first token
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: config.testProducts[0].id,
          quantity: 2,
          price: config.testProducts[0].price
        })
        .expect(200);

      // Get fresh token and add different item
      const freshLogin = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/login`)
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      const freshToken = freshLogin.body.token;

      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${freshToken}`)
        .send({
          productId: config.testProducts[1].id,
          quantity: 1,
          price: config.testProducts[1].price
        })
        .expect(200);

      // Verify merged cart
      const response = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.cart}`)
        .set('Authorization', `Bearer ${freshToken}`)
        .expect(200);

      assertHelpers.assertSuccess(response);
      expect(response.body.cart).toHaveLength(2);
      expect(response.body.cart.map(item => item.productId)).toContain(config.testProducts[0].id);
      expect(response.body.cart.map(item => item.productId)).toContain(config.testProducts[1].id);
    });

    test('should handle cart data corruption gracefully', async () => {
      // Simulate corrupted cart data
      await dbUtils.corruptUserCart(testUser.id);

      // Cart operations should still work
      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: config.testProducts[0].id,
          quantity: 1,
          price: config.testProducts[0].price
        })
        .expect(200);

      assertHelpers.assertSuccess(response);
      expect(response.body.cart).toHaveLength(1);
    });
  });

  describe('Cart Calculations Integration', () {
    
    test('should calculate cart subtotal correctly', async () => {
      // Add multiple items with different prices
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: config.testProducts[0].id,
          quantity: 2,
          price: 10.99
        })
        .expect(200);

      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: config.testProducts[1].id,
          quantity: 1,
          price: 25.50
        })
        .expect(200);

      const response = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.cart}/calculate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      assertHelpers.assertSuccess(response);
      expect(response.body).toHaveProperty('subtotal');
      expect(response.body).toHaveProperty('tax');
      expect(response.body).toHaveProperty('total');
      
      // Verify calculations: (10.99 * 2) + (25.50 * 1) = 47.48
      expect(response.body.subtotal).toBe(47.48);
      expect(response.body.tax).toBe(47.48 * 0.08); // 8% tax
      expect(response.body.total).toBe(47.48 + (47.48 * 0.08));
    });

    test('should apply discount codes to cart total', async () => {
      // Add items to cart
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: config.testProducts[0].id,
          quantity: 2,
          price: 50.00
        })
        .expect(200);

      // Apply discount code
      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/apply-discount`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ code: 'SAVE10' })
        .expect(200);

      assertHelpers.assertSuccess(response);
      expect(response.body).toHaveProperty('discountedTotal');
      expect(response.body.discountedTotal).toBe(90.00); // 100 - 10% discount
    });

    test('should calculate shipping cost based on cart total', async () => {
      // Add small items (below free shipping threshold)
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: config.testProducts[0].id,
          quantity: 1,
          price: 25.00
        })
        .expect(200);

      const response = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.cart}/calculate-shipping`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      assertHelpers.assertSuccess(response);
      expect(response.body).toHaveProperty('shippingCost');
      expect(response.body.shippingCost).toBeGreaterThan(0); // Should charge shipping

      // Add more items to qualify for free shipping
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: config.testProducts[1].id,
          quantity: 3,
          price: 30.00
        })
        .expect(200);

      const freeShippingResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.cart}/calculate-shipping`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(freeShippingResponse.body.shippingCost).toBe(0); // Free shipping
    });
  });

  describe('Cart API Endpoints Integration', () => {
    
    test('should get current cart contents', async () => {
      // Add items first
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: config.testProducts[0].id,
          quantity: 2,
          price: config.testProducts[0].price
        })
        .expect(200);

      const response = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.cart}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      assertHelpers.assertSuccess(response);
      expect(response.body).toHaveProperty('cart');
      expect(response.body.cart).toHaveLength(1);
      expect(response.body.cart[0]).toHaveProperty('productId');
      expect(response.body.cart[0]).toHaveProperty('quantity');
      expect(response.body.cart[0]).toHaveProperty('price');
    });

    test('should handle unauthorized cart access', async () => {
      const response = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.cart}`)
        .expect(401);

      assertHelpers.assertError(response, 401);
      expect(response.body.error).toContain('authorization required');
    });

    test('should handle non-existent user cart', async () => {
      const newUser = mockGenerators.generateUser();
      
      const response = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.cart}`)
        .set('Authorization', `Bearer ${authToken}`) // Using existing token
        .expect(200);

      assertHelpers.assertSuccess(response);
      expect(response.body.cart).toHaveLength(0); // Empty cart for new user
    });
  });

  // Helper functions
  async function setupTestDatabase() {
    // Mock database setup
    return {
      close: async () => {},
      getUserCart: async (userId) => {
        // Mock cart retrieval
        return [];
      },
      getProductById: async (productId) => {
        // Mock product retrieval
        return config.testProducts.find(p => p.id === productId);
      },
      corruptUserCart: async (userId) => {
        // Mock cart corruption
      }
    };
  }

  async function setupTestServer() {
    // Mock test server
    return {
      close: async () => {},
      listen: () => {},
      on: () => {}
    };
  }
});