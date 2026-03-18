/**
 * End-to-End Tests for Complete User Flow
 * 
 * Tests the complete user journey from registration to purchase,
 * including all interactions between frontend, backend, and external services.
 */

const { 
  config, 
  dbUtils, 
  apiUtils, 
  mockGenerators,
  assertHelpers 
} = require('../test-config');
const request = require('supertest');

describe('E-commerce Platform - End-to-End Tests', () => {
  
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
    
    // Create test user
    testUser = mockGenerators.generateUser();
  });

  afterAll(async () => {
    // Cleanup
    await testServer.close();
    await dbUtils.teardown();
    await testDbConnection.close();
  });

  describe('Complete User Registration to Purchase Flow', () => {
    
    test('should complete full user journey from registration to purchase', async () => {
      // Step 1: User Registration
      const registerResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/register`)
        .send(testUser)
        .expect(201);

      assertHelpers.assertSuccess(registerResponse);
      expect(registerResponse.body).toHaveProperty('userId');
      expect(registerResponse.body).toHaveProperty('token');
      expect(registerResponse.body.email).toBe(testUser.email);

      const registrationToken = registerResponse.body.token;

      // Step 2: User Login
      const loginResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/login`)
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      assertHelpers.assertSuccess(loginResponse);
      expect(loginResponse.body).toHaveProperty('token');
      expect(loginResponse.body.user.email).toBe(testUser.email);

      authToken = loginResponse.body.token;

      // Step 3: Browse Products
      const productsResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.products}`)
        .expect(200);

      assertHelpers.assertSuccess(productsResponse);
      expect(productsResponse.body).toHaveProperty('products');
      expect(productsResponse.body.products.length).toBeGreaterThan(0);

      const availableProducts = productsResponse.body.products;

      // Step 4: Add Items to Cart
      const cartItems = [
        {
          productId: availableProducts[0].id,
          quantity: 2,
          price: availableProducts[0].price
        },
        {
          productId: availableProducts[1].id,
          quantity: 1,
          price: availableProducts[1].price
        }
      ];

      for (const item of cartItems) {
        const addToCartResponse = await request(testServer)
          .post(`${config.api.baseUrl}${config.api.cart}/add`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(item)
          .expect(200);

        assertHelpers.assertSuccess(addToCartResponse);
      }

      // Step 5: View Cart
      const cartResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.cart}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      assertHelpers.assertSuccess(cartResponse);
      expect(cartResponse.body.cart).toHaveLength(2);
      expect(cartResponse.body.cart[0].quantity).toBe(2);
      expect(cartResponse.body.cart[1].quantity).toBe(1);

      // Step 6: Calculate Order Total
      const calculateResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.cart}/calculate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      assertHelpers.assertSuccess(calculateResponse);
      expect(calculateResponse.body).toHaveProperty('subtotal');
      expect(calculateResponse.body).toHaveProperty('tax');
      expect(calculateResponse.body).toHaveProperty('total');

      const orderTotal = calculateResponse.body.total;

      // Step 7: Create Order
      const orderData = {
        shippingAddress: {
          street: '123 Main St',
          city: 'New York',
          zipCode: '10001',
          country: 'USA'
        },
        paymentMethod: {
          type: 'credit_card',
          cardNumber: '4111111111111111',
          expiry: '12/25',
          cvv: '123',
          cardholderName: testUser.name
        }
      };

      const orderResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/create`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      assertHelpers.assertSuccess(orderResponse);
      expect(orderResponse.body).toHaveProperty('orderId');
      expect(orderResponse.body).toHaveProperty('total');
      expect(orderResponse.body.total).toBe(orderTotal);
      expect(orderResponse.body.status).toBe('confirmed');

      const orderId = orderResponse.body.orderId;

      // Step 8: Process Payment
      const paymentResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/${orderId}/process-payment`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      assertHelpers.assertSuccess(paymentResponse);
      expect(paymentResponse.body).toHaveProperty('paymentId');
      expect(paymentResponse.body.status).toBe('paid');

      // Step 9: Update Order Status to Processing
      const processResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/${orderId}/process`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      assertHelpers.assertSuccess(processResponse);
      expect(processResponse.body.status).toBe('processing');

      // Step 10: Ship Order
      const shipResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/${orderId}/ship`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          trackingNumber: 'TRACK123456789',
          shippingProvider: 'UPS'
        })
        .expect(200);

      assertHelpers.assertSuccess(shipResponse);
      expect(shipResponse.body.status).toBe('shipped');
      expect(shipResponse.body).toHaveProperty('trackingNumber', 'TRACK123456789');

      // Step 11: Mark Order as Delivered
      const deliverResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/${orderId}/deliver`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      assertHelpers.assertSuccess(deliverResponse);
      expect(deliverResponse.body.status).toBe('delivered');

      // Step 12: Verify Order History
      const orderHistoryResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.orders}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      assertHelpers.assertSuccess(orderHistoryResponse);
      expect(orderHistoryResponse.body.orders).toHaveLength(1);
      expect(orderHistoryResponse.body.orders[0].id).toBe(orderId);
      expect(orderHistoryResponse.body.orders[0].status).toBe('delivered');

      // Step 13: Verify Order Tracking
      const trackingResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.orders}/${orderId}/tracking`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      assertHelpers.assertSuccess(trackingResponse);
      expect(trackingResponse.body).toHaveProperty('trackingNumber', 'TRACK123456789');
      expect(trackingResponse.body).toHaveProperty('status', 'delivered');

      // Step 14: Generate Order Receipt
      const receiptResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.orders}/${orderId}/receipt`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      assertHelpers.assertSuccess(receiptResponse);
      expect(receiptResponse.body).toHaveProperty('orderId');
      expect(receiptResponse.body).toHaveProperty('items');
      expect(receiptResponse.body).toHaveProperty('total');
      expect(receiptResponse.body).toHaveProperty('purchaseDate');

      // Summary of completed flow
      console.log('✅ Complete user journey completed successfully');
      console.log(`📋 Order ${orderId} created and delivered`);
      console.log(`💰 Total amount: $${orderTotal.toFixed(2)}`);
      console.log(`📦 Tracking: TRACK123456789`);
    });

    test('should handle user login and cart persistence across sessions', async () => {
      // Step 1: Register and login user
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

      // Step 2: Add items to cart
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: 1,
          quantity: 1,
          price: 99.99
        })
        .expect(200);

      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: 2,
          quantity: 2,
          price: 49.99
        })
        .expect(200);

      // Step 3: Logout (simulate session end)
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/logout`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Step 4: Login again (new session)
      const newLoginResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/login`)
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      const newAuthToken = newLoginResponse.body.token;

      // Step 5: Verify cart persists
      const cartResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.cart}`)
        .set('Authorization', `Bearer ${newAuthToken}`)
        .expect(200);

      assertHelpers.assertSuccess(cartResponse);
      expect(cartResponse.body.cart).toHaveLength(2);
      expect(cartResponse.body.cart[0].quantity).toBe(1);
      expect(cartResponse.body.cart[1].quantity).toBe(2);

      console.log('✅ Cart persistence across sessions verified');
    });

    test('should handle guest checkout with account creation', async () => {
      // Step 1: Start as guest (no auth token)
      const guestCartResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.cart}`)
        .expect(401);

      assertHelpers.assertError(guestCartResponse, 401);
      expect(guestCartResponse.body.error).toContain('authorization required');

      // Step 2: Guest adds items to cart (should fail without auth)
      const guestAddResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .send({
          productId: 1,
          quantity: 1,
          price: 99.99
        })
        .expect(401);

      assertHelpers.assertError(guestAddResponse, 401);

      // Step 3: Guest creates account during checkout
      const guestUser = mockGenerators.generateUser();
      const registerResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/register`)
        .send(guestUser)
        .expect(201);

      const guestAuthToken = registerResponse.body.token;

      // Step 4: Guest adds items to cart after registration
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${guestAuthToken}`)
        .send({
          productId: 1,
          quantity: 1,
          price: 99.99
        })
        .expect(200);

      // Step 5: Guest completes purchase
      const orderData = {
        shippingAddress: {
          street: '456 Guest St',
          city: 'Guest City',
          zipCode: '54321',
          country: 'USA'
        },
        paymentMethod: {
          type: 'credit_card',
          cardNumber: '4111111111111111',
          expiry: '12/25',
          cvv: '123',
          cardholderName: guestUser.name
        }
      };

      const orderResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/create`)
        .set('Authorization', `Bearer ${guestAuthToken}`)
        .send(orderData)
        .expect(201);

      assertHelpers.assertSuccess(orderResponse);
      expect(orderResponse.body).toHaveProperty('orderId');

      console.log('✅ Guest checkout with account creation completed');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    
    test('should handle payment failure gracefully', async () => {
      // Register and login user
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

      // Add items to cart
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: 1,
          quantity: 1,
          price: 99.99
        })
        .expect(200);

      // Create order
      const orderData = {
        shippingAddress: {
          street: '123 Main St',
          city: 'New York',
          zipCode: '10001',
          country: 'USA'
        },
        paymentMethod: {
          type: 'credit_card',
          cardNumber: '4111111111111111', // Will be declined
          expiry: '12/25',
          cvv: '123',
          cardholderName: testUser.name
        }
      };

      const orderResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/create`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      const orderId = orderResponse.body.orderId;

      // Attempt to process payment (will fail)
      const paymentResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/${orderId}/process-payment`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      assertHelpers.assertError(paymentResponse, 400);
      expect(paymentResponse.body.error).toContain('payment failed');

      // Verify order status remains confirmed
      const orderStatusResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.orders}/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(orderStatusResponse.body.status).toBe('confirmed');

      // User should be able to try payment again with different method
      const alternativePaymentData = {
        shippingAddress: {
          street: '123 Main St',
          city: 'New York',
          zipCode: '10001',
          country: 'USA'
        },
        paymentMethod: {
          type: 'paypal',
          email: 'alternative@example.com'
        }
      };

      const retryOrderResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/${orderId}/retry-payment`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(alternativePaymentData)
        .expect(200);

      assertHelpers.assertSuccess(retryOrderResponse);
      expect(retryOrderResponse.body.status).toBe('paid');

      console.log('✅ Payment failure and retry handled gracefully');
    });

    test('should handle inventory unavailability during checkout', async () => {
      // Register and login user
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

      // Add item to cart
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: 1,
          quantity: 1,
          price: 99.99
        })
        .expect(200);

      // Simulate inventory depletion (set stock to 0)
      await dbUtils.updateProductStock(1, 0);

      // Attempt to create order (should fail due to insufficient inventory)
      const orderData = {
        shippingAddress: {
          street: '123 Main St',
          city: 'New York',
          zipCode: '10001',
          country: 'USA'
        },
        paymentMethod: {
          type: 'credit_card',
          cardNumber: '4111111111111111',
          expiry: '12/25',
          cvv: '123',
          cardholderName: testUser.name
        }
      };

      const orderResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/create`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(400);

      assertHelpers.assertError(orderResponse, 400);
      expect(orderResponse.body.error).toContain('insufficient inventory');

      // Cart should be cleared or updated to reflect unavailable items
      const cartResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.cart}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(cartResponse.body.cart).toHaveLength(0); // Should be empty or without unavailable items

      console.log('✅ Inventory unavailability handled correctly');
    });

    test('should handle order cancellation and refund process', async () => {
      // Register and login user
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

      // Add items to cart
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: 1,
          quantity: 1,
          price: 99.99
        })
        .expect(200);

      // Create order
      const orderData = {
        shippingAddress: {
          street: '123 Main St',
          city: 'New York',
          zipCode: '10001',
          country: 'USA'
        },
        paymentMethod: {
          type: 'credit_card',
          cardNumber: '4111111111111111',
          expiry: '12/25',
          cvv: '123',
          cardholderName: testUser.name
        }
      };

      const orderResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/create`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      const orderId = orderResponse.body.orderId;

      // Process payment
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/${orderId}/process-payment`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Cancel order
      const cancelResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/${orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Customer changed mind' })
        .expect(200);

      assertHelpers.assertSuccess(cancelResponse);
      expect(cancelResponse.body.status).toBe('cancelled');

      // Verify refund process initiated
      const refundResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.orders}/${orderId}/refund`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      assertHelpers.assertSuccess(refundResponse);
      expect(refundResponse.body).toHaveProperty('refundStatus');
      expect(refundResponse.body.refundStatus).toBe('initiated');

      console.log('✅ Order cancellation and refund process completed');
    });
  });

  describe('Performance and Load Testing', {
    timeout: 30000 // 30 second timeout for performance tests
  }, () => {
    
    test('should handle concurrent user registrations', async () => {
      const concurrentUsers = 10;
      const registrationPromises = [];

      // Create multiple concurrent user registrations
      for (let i = 0; i < concurrentUsers; i++) {
        const user = mockGenerators.generateUser();
        registrationPromises.push(
          request(testServer)
            .post(`${config.api.baseUrl}${config.api.auth}/register`)
            .send(user)
            .expect(201)
        );
      }

      // Wait for all registrations to complete
      const results = await Promise.all(registrationPromises);
      
      // Verify all registrations succeeded
      results.forEach((response, index) => {
        assertHelpers.assertSuccess(response);
        expect(response.body).toHaveProperty('userId');
        expect(response.body).toHaveProperty('token');
      });

      console.log(`✅ Concurrent registration of ${concurrentUsers} users completed`);
    });

    test('should handle high traffic on product catalog', async () => {
      const concurrentRequests = 20;
      const requests = [];

      // Create multiple concurrent requests to product catalog
      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(
          request(testServer)
            .get(`${config.api.baseUrl}${config.api.products}`)
            .expect(200)
        );
      }

      // Wait for all requests to complete
      const results = await Promise.all(requests);
      
      // Verify all requests succeeded
      results.forEach(response => {
        assertHelpers.assertSuccess(response);
        expect(response.body).toHaveProperty('products');
      });

      console.log(`✅ High traffic on product catalog handled (${concurrentRequests} concurrent requests)`);
    });

    test('should handle cart operations under load', async () => {
      // Register and login user
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

      const concurrentCartOperations = 15;
      const cartPromises = [];

      // Create multiple concurrent cart operations
      for (let i = 0; i < concurrentCartOperations; i++) {
        cartPromises.push(
          request(testServer)
            .post(`${config.api.baseUrl}${config.api.cart}/add`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              productId: (i % 3) + 1, // Cycle through products 1, 2, 3
              quantity: 1,
              price: 99.99
            })
            .expect(200)
        );
      }

      // Wait for all cart operations to complete
      const results = await Promise.all(cartPromises);
      
      // Verify all operations succeeded
      results.forEach(response => {
        assertHelpers.assertSuccess(response);
      });

      // Verify final cart state
      const cartResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.cart}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      assertHelpers.assertSuccess(cartResponse);
      expect(cartResponse.body.cart.length).toBeGreaterThan(0);

      console.log(`✅ Cart operations under load completed (${concurrentCartOperations} concurrent operations)`);
    });
  });

  // Helper functions
  async function setupTestDatabase() {
    // Mock database setup
    return {
      close: async () => {},
      updateProductStock: async (productId, newStock) => {
        // Mock stock update
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