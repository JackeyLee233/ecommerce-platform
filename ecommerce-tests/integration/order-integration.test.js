/**
 * Integration Tests for Order Processing
 * 
 * Tests integration between order components, payment system, 
 * inventory management, and shipping services for complete order processing.
 */

const { 
  config, 
  dbUtils, 
  apiUtils, 
  mockGenerators,
  assertHelpers 
} = require('../test-config');
const request = require('supertest');

describe('Order Processing - Integration Tests', () => {
  
  let testServer;
  let testDbConnection;
  let authToken;
  let testUser;
  let testCart;

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

    // Setup test cart
    await setupTestCart();
  });

  afterAll(async () => {
    // Cleanup
    await testServer.close();
    await dbUtils.teardown();
    await testDbConnection.close();
  });

  describe('Order Creation Integration', () => {
    
    test('should create order from cart', async () => {
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
          cvv: '123'
        }
      };

      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/create`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      assertHelpers.assertSuccess(response);
      expect(response.body).toHaveProperty('orderId');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('status', 'confirmed');
      expect(response.body).toHaveProperty('items');
      expect(response.body.items).toHaveLength(testCart.length);

      // Verify order created in database
      const dbOrder = await dbUtils.getOrderById(response.body.orderId);
      expect(dbOrder).toBeDefined();
      expect(dbOrder.userId).toBe(testUser.id);
      expect(dbOrder.status).toBe('confirmed');
    });

    test('should validate shipping address format', async () => {
      const invalidAddress = {
        street: '123',
        city: 'NY',
        zipCode: '1',
        country: 'US'
      };

      const orderData = {
        shippingAddress: invalidAddress,
        paymentMethod: {
          type: 'credit_card',
          cardNumber: '4111111111111111',
          expiry: '12/25',
          cvv: '123'
        }
      };

      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/create`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(400);

      assertHelpers.assertValidationError(response, 'shippingAddress');
    });

    test('should validate payment method', async () => {
      const invalidPayment = {
        type: 'credit_card',
        cardNumber: '1234567890123456', // Invalid card number
        expiry: '12/25',
        cvv: '123'
      };

      const orderData = {
        shippingAddress: {
          street: '123 Main St',
          city: 'New York',
          zipCode: '10001',
          country: 'USA'
        },
        paymentMethod: invalidPayment
      };

      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/create`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(400);

      assertHelpers.assertValidationError(response, 'paymentMethod');
    });

    test('should validate cart is not empty', async () => {
      // Clear cart first
      await request(testServer)
        .delete(`${config.api.baseUrl}${config.api.cart}/clear`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

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
          cvv: '123'
        }
      };

      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/create`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(400);

      assertHelpers.assertError(response, 400);
      expect(response.body.error).toContain('empty cart');
    });

    test('should calculate order total correctly', async () => {
      // Setup cart with known items
      await request(testServer)
        .delete(`${config.api.baseUrl}${config.api.cart}/clear`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

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
          cvv: '123'
        }
      };

      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/create`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      // Expected total: (10.99 * 2) + (25.50 * 1) + tax + shipping
      const expectedSubtotal = 47.48;
      const expectedTax = expectedSubtotal * 0.08; // 8% tax
      const expectedShipping = 5.99; // Domestic shipping
      const expectedTotal = expectedSubtotal + expectedTax + expectedShipping;

      expect(response.body.total).toBeCloseTo(expectedTotal, 2);
    });
  });

  describe('Order Payment Integration', () {
    
    test('should process payment for order', async () => {
      // Create order first
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
          cvv: '123'
        }
      };

      const createResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/create`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      const orderId = createResponse.body.orderId;

      // Process payment
      const paymentResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/${orderId}/process-payment`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      assertHelpers.assertSuccess(paymentResponse);
      expect(paymentResponse.body).toHaveProperty('paymentId');
      expect(paymentResponse.body).toHaveProperty('status', 'paid');

      // Verify order status updated
      const updatedOrder = await dbUtils.getOrderById(orderId);
      expect(updatedOrder.status).toBe('processing');
    });

    test('should handle payment failure gracefully', async () => {
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
          cardNumber: '4111111111111111', // Will be declined in mock
          expiry: '12/25',
          cvv: '123'
        }
      };

      const createResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/create`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      const orderId = createResponse.body.orderId;

      // Process payment (will fail)
      const paymentResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/${orderId}/process-payment`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      assertHelpers.assertError(paymentResponse, 400);
      expect(paymentResponse.body.error).toContain('payment failed');

      // Verify order status remains pending
      const updatedOrder = await dbUtils.getOrderById(orderId);
      expect(updatedOrder.status).toBe('confirmed');
    });

    test('should handle duplicate payment attempts', async () => {
      // Create and pay for order
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
          cvv: '123'
        }
      };

      const createResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/create`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      const orderId = createResponse.body.orderId;

      // Process payment first time (should succeed)
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/${orderId}/process-payment`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Try to process payment again (should fail)
      const duplicateResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/${orderId}/process-payment`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      assertHelpers.assertError(duplicateResponse, 400);
      expect(duplicateResponse.body.error).toContain('already paid');
    });
  });

  describe('Order Inventory Integration', () => {
    
    test('should reserve inventory when order is created', async () => {
      const product = config.testProducts[0];
      const originalStock = product.stock;
      
      // Create order with product
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
          cvv: '123'
        }
      };

      const createResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/create`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      // Verify inventory reserved
      const updatedProduct = await dbUtils.getProductById(product.id);
      expect(updatedProduct.stock).toBeLessThan(originalStock);
    });

    test('should update inventory when order is paid', async () => {
      const product = config.testProducts[0];
      const originalStock = product.stock;
      
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
          cvv: '123'
        }
      };

      const createResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/create`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      const orderId = createResponse.body.orderId;

      // Process payment
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/${orderId}/process-payment`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify inventory updated
      const updatedProduct = await dbUtils.getProductById(product.id);
      expect(updatedProduct.stock).toBe(originalStock - 2); // Assuming quantity 2
    });

    test('should restore inventory when order is cancelled', async () => {
      const product = config.testProducts[0];
      const originalStock = product.stock;
      
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
          cvv: '123'
        }
      };

      const createResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/create`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      const orderId = createResponse.body.orderId;

      // Cancel order
      const cancelResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/${orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Customer request' })
        .expect(200);

      assertHelpers.assertSuccess(cancelResponse);

      // Verify inventory restored
      const updatedProduct = await dbUtils.getProductById(product.id);
      expect(updatedProduct.stock).toBe(originalStock);
    });

    test('should handle insufficient inventory during order creation', async () => {
      // Create product with low stock
      const lowStockProduct = {
        id: 999,
        name: 'Low Stock Item',
        price: 19.99,
        stock: 1
      };

      // Add to cart
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.cart}/add`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: lowStockProduct.id,
          quantity: 2, // More than available
          price: lowStockProduct.price
        })
        .expect(400);

      // Try to create order (should fail due to insufficient inventory)
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
          cvv: '123'
        }
      };

      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/create`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(400);

      assertHelpers.assertError(response, 400);
      expect(response.body.error).toContain('insufficient inventory');
    });
  });

  describe('Order Status Management Integration', () => {
    
    test('should update order status through workflow', async () => {
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
          cvv: '123'
        }
      };

      const createResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/create`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      const orderId = createResponse.body.orderId;

      // Process payment
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/${orderId}/process-payment`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Mark as shipped
      const shipResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/${orderId}/ship`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ trackingNumber: 'TRACK123456' })
        .expect(200);

      assertHelpers.assertSuccess(shipResponse);
      expect(shipResponse.body.status).toBe('shipped');

      // Mark as delivered
      const deliverResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/${orderId}/deliver`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      assertHelpers.assertSuccess(deliverResponse);
      expect(deliverResponse.body.status).toBe('delivered');

      // Verify status history
      const order = await dbUtils.getOrderById(orderId);
      expect(order.statusHistory).toHaveLength(4); // created, confirmed, shipped, delivered
    });

    test('should validate status transitions', async () => {
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
          cvv: '123'
        }
      };

      const createResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/create`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      const orderId = createResponse.body.orderId;

      // Try invalid transition: directly from confirmed to delivered
      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/${orderId}/deliver`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      assertHelpers.assertError(response, 400);
      expect(response.body.error).toContain('invalid status transition');
    });

    test('should handle order cancellation', async () => {
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
          cvv: '123'
        }
      };

      const createResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/create`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      const orderId = createResponse.body.orderId;

      // Cancel order
      const cancelResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/${orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Customer request' })
        .expect(200);

      assertHelpers.assertSuccess(cancelResponse);
      expect(cancelResponse.body.status).toBe('cancelled');

      // Verify inventory restored
      const order = await dbUtils.getOrderById(orderId);
      expect(order.status).toBe('cancelled');
      expect(order.statusHistory).toHaveLength(2); // created, cancelled
    });

    test('should prevent cancellation of shipped orders', async () => {
      // Create and process order
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
          cvv: '123'
        }
      };

      const createResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/create`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      const orderId = createResponse.body.orderId;

      // Process payment and ship
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/${orderId}/process-payment`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/${orderId}/ship`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ trackingNumber: 'TRACK123456' })
        .expect(200);

      // Try to cancel shipped order
      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/${orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Customer request' })
        .expect(400);

      assertHelpers.assertError(response, 400);
      expect(response.body.error).toContain('cannot cancel shipped order');
    });
  });

  describe('Order Tracking Integration', () => {
    
    test('should generate tracking number for shipped orders', async () => {
      // Create and ship order
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
          cvv: '123'
        }
      };

      const createResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/create`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      const orderId = createResponse.body.orderId;

      // Process payment
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/${orderId}/process-payment`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Ship order
      const shipResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/${orderId}/ship`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ trackingNumber: 'TRACK123456' })
        .expect(200);

      assertHelpers.assertSuccess(shipResponse);
      expect(shipResponse.body).toHaveProperty('trackingNumber', 'TRACK123456');
    });

    test('should provide order tracking information', async () => {
      // Create and ship order
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
          cvv: '123'
        }
      };

      const createResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/create`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      const orderId = createResponse.body.orderId;

      // Process payment and ship
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/${orderId}/process-payment`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.orders}/${orderId}/ship`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ trackingNumber: 'TRACK123456' })
        .expect(200);

      // Get tracking information
      const trackingResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.orders}/${orderId}/tracking`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      assertHelpers.assertSuccess(trackingResponse);
      expect(trackingResponse.body).toHaveProperty('trackingNumber', 'TRACK123456');
      expect(trackingResponse.body).toHaveProperty('status', 'shipped');
      expect(trackingResponse.body).toHaveProperty('estimatedDelivery');
    });

    test('should handle invalid tracking requests', async () => {
      const response = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.orders}/invalid/tracking`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      assertHelpers.assertError(response, 404);
      expect(response.body.error).toContain('order not found');
    });
  });

  // Helper functions
  async function setupTestCart() {
    // Clear existing cart
    await request(testServer)
      .delete(`${config.api.baseUrl}${config.api.cart}/clear`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    // Add test items to cart
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

    // Get current cart
    const cartResponse = await request(testServer)
      .get(`${config.api.baseUrl}${config.api.cart}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    testCart = cartResponse.body.cart;
  }

  async function setupTestDatabase() {
    // Mock database setup
    return {
      close: async () => {},
      getOrderById: async (orderId) => {
        // Mock order retrieval
        return {
          id: orderId,
          userId: testUser.id,
          status: 'confirmed',
          statusHistory: []
        };
      },
      getProductById: async (productId) => {
        // Mock product retrieval
        return config.testProducts.find(p => p.id === productId);
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