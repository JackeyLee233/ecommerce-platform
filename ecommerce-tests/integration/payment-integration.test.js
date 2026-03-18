/**
 * Integration Tests for Payment Processing
 * 
 * Tests integration between payment components, order system, 
 * external payment gateways, and fraud detection services.
 */

const { 
  config, 
  dbUtils, 
  apiUtils, 
  mockGenerators,
  assertHelpers 
} = require('../test-config');
const request = require('supertest');

describe('Payment Processing - Integration Tests', () => {
  
  let testServer;
  let testDbConnection;
  let authToken;
  let testUser;
  let testOrder;

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

    // Setup test order
    await setupTestOrder();
  });

  afterAll(async () => {
    // Cleanup
    await testServer.close();
    await dbUtils.teardown();
    await testDbConnection.close();
  });

  describe('Payment Method Integration', () => {
    
    test('should validate credit card payment method', async () => {
      const paymentData = {
        type: 'credit_card',
        cardNumber: '4111111111111111',
        expiry: '12/25',
        cvv: '123',
        cardholderName: 'John Doe'
      };

      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/validate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(200);

      assertHelpers.assertSuccess(response);
      expect(response.body).toHaveProperty('valid', true);
      expect(response.body).toHaveProperty('cardType', 'visa');
      expect(response.body).toHaveProperty('last4', '1111');
    });

    test('should validate PayPal payment method', async () => {
      const paymentData = {
        type: 'paypal',
        email: 'test@example.com'
      };

      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/validate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(200);

      assertHelpers.assertSuccess(response);
      expect(response.body).toHaveProperty('valid', true);
      expect(response.body).toHaveProperty('paymentMethod', 'paypal');
      expect(response.body).toHaveProperty('email', 'test@example.com');
    });

    test('should reject invalid credit card number', async () => {
      const paymentData = {
        type: 'credit_card',
        cardNumber: '1234567890123456', // Invalid Luhn
        expiry: '12/25',
        cvv: '123',
        cardholderName: 'John Doe'
      };

      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/validate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(400);

      assertHelpers.assertValidationError(response, 'cardNumber');
      expect(response.body.error).toContain('invalid card number');
    });

    test('should reject expired credit card', async () => {
      const paymentData = {
        type: 'credit_card',
        cardNumber: '4111111111111111',
        expiry: '12/20', // Past date
        cvv: '123',
        cardholderName: 'John Doe'
      };

      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/validate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(400);

      assertHelpers.assertValidationError(response, 'expiry');
      expect(response.body.error).toContain('expired card');
    });

    test('should reject invalid PayPal email', async () => {
      const paymentData = {
        type: 'paypal',
        email: 'invalid-email'
      };

      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/validate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(400);

      assertHelpers.assertValidationError(response, 'email');
      expect(response.body.error).toContain('invalid email format');
    });
  });

  describe('Payment Authorization Integration', () => {
    
    test('should authorize payment for valid order', async () => {
      const paymentData = {
        orderId: testOrder.id,
        paymentMethod: {
          type: 'credit_card',
          cardNumber: '4111111111111111',
          expiry: '12/25',
          cvv: '123',
          cardholderName: 'John Doe'
        }
      };

      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/authorize`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(200);

      assertHelpers.assertSuccess(response);
      expect(response.body).toHaveProperty('transactionId');
      expect(response.body).toHaveProperty('authorizationCode');
      expect(response.body).toHaveProperty('approved', true);
      expect(response.body).toHaveProperty('amount', testOrder.total);

      // Verify payment record created
      const paymentRecord = await dbUtils.getPaymentByTransactionId(response.body.transactionId);
      expect(paymentRecord).toBeDefined();
      expect(paymentRecord.orderId).toBe(testOrder.id);
      expect(paymentRecord.status).toBe('authorized');
    });

    test('should decline payment for insufficient funds', async () => {
      const paymentData = {
        orderId: testOrder.id,
        paymentMethod: {
          type: 'credit_card',
          cardNumber: '4111111111111111', // Will be declined for insufficient funds
          expiry: '12/25',
          cvv: '123',
          cardholderName: 'John Doe'
        }
      };

      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/authorize`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(400);

      assertHelpers.assertError(response, 400);
      expect(response.body.error).toContain('insufficient funds');
      expect(response.body).toHaveProperty('declineCode', '51');

      // Verify payment record created with declined status
      const paymentRecord = await dbUtils.getPaymentByTransactionId(response.body.transactionId);
      expect(paymentRecord).toBeDefined();
      expect(paymentRecord.status).toBe('declined');
    });

    test('should handle payment gateway timeout', async () => {
      const paymentData = {
        orderId: testOrder.id,
        paymentMethod: {
          type: 'credit_card',
          cardNumber: '4111111111111111',
          expiry: '12/25',
          cvv: '123',
          cardholderName: 'John Doe'
        }
      };

      // Mock timeout scenario
      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/authorize`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(500);

      assertHelpers.assertError(response, 500);
      expect(response.body.error).toContain('gateway timeout');

      // Verify payment record created with pending status
      const paymentRecord = await dbUtils.getPaymentByTransactionId(response.body.transactionId);
      expect(paymentRecord).toBeDefined();
      expect(paymentRecord.status).toBe('pending');
    });

    test('should validate payment amount matches order total', async () => {
      const paymentData = {
        orderId: testOrder.id,
        paymentMethod: {
          type: 'credit_card',
          cardNumber: '4111111111111111',
          expiry: '12/25',
          cvv: '123',
          cardholderName: 'John Doe'
        },
        // Wrong amount
        amount: testOrder.total + 100 // Overpay by $100
      };

      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/authorize`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(400);

      assertHelpers.assertValidationError(response, 'amount');
      expect(response.body.error).toContain('amount does not match order total');
    });

    test('should validate payment currency', async () => {
      const paymentData = {
        orderId: testOrder.id,
        paymentMethod: {
          type: 'credit_card',
          cardNumber: '4111111111111111',
          expiry: '12/25',
          cvv: '123',
          cardholderName: 'John Doe'
        },
        // Wrong currency
        currency: 'EUR' // Should be USD
      };

      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/authorize`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(400);

      assertHelpers.assertValidationError(response, 'currency');
      expect(response.body.error).toContain('invalid currency');
    });
  });

  describe('Payment Capture Integration', () => {
    
    test('should capture authorized payment', async () => {
      // First authorize payment
      const authResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/authorize`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: testOrder.id,
          paymentMethod: {
            type: 'credit_card',
            cardNumber: '4111111111111111',
            expiry: '12/25',
            cvv: '123',
            cardholderName: 'John Doe'
          }
        })
        .expect(200);

      const transactionId = authResponse.body.transactionId;

      // Capture payment
      const captureResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/capture`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transactionId: transactionId,
          orderId: testOrder.id
        })
        .expect(200);

      assertHelpers.assertSuccess(captureResponse);
      expect(captureResponse.body).toHaveProperty('captured', true);
      expect(captureResponse.body).toHaveProperty('captureId');
      expect(captureResponse.body).toHaveProperty('settledAmount', testOrder.total);

      // Verify payment record updated
      const paymentRecord = await dbUtils.getPaymentByTransactionId(transactionId);
      expect(paymentRecord.status).toBe('captured');
      expect(paymentRecord.settledAt).toBeDefined();
    });

    test('should reject capture of non-existent transaction', async () => {
      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/capture`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transactionId: 'non-existent-transaction',
          orderId: testOrder.id
        })
        .expect(404);

      assertHelpers.assertError(response, 404);
      expect(response.body.error).toContain('transaction not found');
    });

    test('should reject capture of already captured payment', async () => {
      // First authorize and capture payment
      const authResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/authorize`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: testOrder.id,
          paymentMethod: {
            type: 'credit_card',
            cardNumber: '4111111111111111',
            expiry: '12/25',
            cvv: '123',
            cardholderName: 'John Doe'
          }
        })
        .expect(200);

      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/capture`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transactionId: authResponse.body.transactionId,
          orderId: testOrder.id
        })
        .expect(200);

      // Try to capture again
      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/capture`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transactionId: authResponse.body.transactionId,
          orderId: testOrder.id
        })
        .expect(400);

      assertHelpers.assertError(response, 400);
      expect(response.body.error).toContain('already captured');
    });

    test('should handle partial capture', async () => {
      // First authorize payment
      const authResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/authorize`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: testOrder.id,
          paymentMethod: {
            type: 'credit_card',
            cardNumber: '4111111111111111',
            expiry: '12/25',
            cvv: '123',
            cardholderName: 'John Doe'
          }
        })
        .expect(200);

      // Partial capture (capture only 50%)
      const partialAmount = testOrder.total * 0.5;
      const captureResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/capture`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transactionId: authResponse.body.transactionId,
          orderId: testOrder.id,
          amount: partialAmount
        })
        .expect(200);

      assertHelpers.assertSuccess(captureResponse);
      expect(captureResponse.body.captured).toBe(true);
      expect(captureResponse.body.settledAmount).toBe(partialAmount);

      // Verify payment record updated with partial capture
      const paymentRecord = await dbUtils.getPaymentByTransactionId(authResponse.body.transactionId);
      expect(paymentRecord.status).toBe('partially_captured');
      expect(paymentRecord.capturedAmount).toBe(partialAmount);
    });
  });

  describe('Payment Refund Integration', () => {
    
    test('should process full refund for captured payment', async () => {
      // First authorize and capture payment
      const authResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/authorize`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: testOrder.id,
          paymentMethod: {
            type: 'credit_card',
            cardNumber: '4111111111111111',
            expiry: '12/25',
            cvv: '123',
            cardholderName: 'John Doe'
          }
        })
        .expect(200);

      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/capture`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transactionId: authResponse.body.transactionId,
          orderId: testOrder.id
        })
        .expect(200);

      // Process refund
      const refundResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/refund`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transactionId: authResponse.body.transactionId,
          orderId: testOrder.id,
          amount: testOrder.total,
          reason: 'Customer request'
        })
        .expect(200);

      assertHelpers.assertSuccess(refundResponse);
      expect(refundResponse.body).toHaveProperty('refunded', true);
      expect(refundResponse.body).toHaveProperty('refundId');
      expect(refundResponse.body).toHaveProperty('refundAmount', testOrder.total);

      // Verify payment record updated
      const paymentRecord = await dbUtils.getPaymentByTransactionId(authResponse.body.transactionId);
      expect(paymentRecord.status).toBe('refunded');
      expect(paymentRecord.refundedAt).toBeDefined();
    });

    test('should process partial refund', async () => {
      // First authorize and capture payment
      const authResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/authorize`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: testOrder.id,
          paymentMethod: {
            type: 'credit_card',
            cardNumber: '4111111111111111',
            expiry: '12/25',
            cvv: '123',
            cardholderName: 'John Doe'
          }
        })
        .expect(200);

      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/capture`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transactionId: authResponse.body.transactionId,
          orderId: testOrder.id
        })
        .expect(200);

      // Partial refund (50%)
      const partialRefundAmount = testOrder.total * 0.5;
      const refundResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/refund`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transactionId: authResponse.body.transactionId,
          orderId: testOrder.id,
          amount: partialRefundAmount,
          reason: 'Customer request'
        })
        .expect(200);

      assertHelpers.assertSuccess(refundResponse);
      expect(refundResponse.body.refunded).toBe(true);
      expect(refundResponse.body.refundAmount).toBe(partialRefundAmount);

      // Verify payment record updated
      const paymentRecord = await dbUtils.getPaymentByTransactionId(authResponse.body.transactionId);
      expect(paymentRecord.status).toBe('partially_refunded');
      expect(paymentRecord.refundedAmount).toBe(partialRefundAmount);
    });

    test('should reject refund of non-captured payment', async () => {
      // Only authorize payment, don't capture
      const authResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/authorize`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: testOrder.id,
          paymentMethod: {
            type: 'credit_card',
            cardNumber: '4111111111111111',
            expiry: '12/25',
            cvv: '123',
            cardholderName: 'John Doe'
          }
        })
        .expect(200);

      // Try to refund uncaptured payment
      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/refund`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transactionId: authResponse.body.transactionId,
          orderId: testOrder.id,
          amount: testOrder.total
        })
        .expect(400);

      assertHelpers.assertError(response, 400);
      expect(response.body.error).toContain('payment not captured');
    });

    test('should handle refund timeout', async () => {
      // First authorize and capture payment
      const authResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/authorize`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: testOrder.id,
          paymentMethod: {
            type: 'credit_card',
            cardNumber: '4111111111111111',
            expiry: '12/25',
            cvv: '123',
            cardholderName: 'John Doe'
          }
        })
        .expect(200);

      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/capture`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transactionId: authResponse.body.transactionId,
          orderId: testOrder.id
        })
        .expect(200);

      // Process refund with timeout
      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/refund`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transactionId: authResponse.body.transactionId,
          orderId: testOrder.id,
          amount: testOrder.total,
          reason: 'Customer request'
        })
        .expect(500);

      assertHelpers.assertError(response, 500);
      expect(response.body.error).toContain('refund timeout');

      // Verify payment status remains captured
      const paymentRecord = await dbUtils.getPaymentByTransactionId(authResponse.body.transactionId);
      expect(paymentRecord.status).toBe('captured');
    });
  });

  describe('Payment Security Integration', {
    timeout: 10000 // 10 second timeout for security tests
  }, () => {
    
    test('should detect and block suspicious payment patterns', async () => {
      // Simulate suspicious activity - multiple rapid payments from same IP
      const suspiciousPayments = [];
      
      for (let i = 0; i < 5; i++) {
        const response = await request(testServer)
          .post(`${config.api.baseUrl}${config.api.payment}/authorize`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('X-Forwarded-For', '192.168.1.100') // Same IP
          .send({
            orderId: testOrder.id,
            paymentMethod: {
              type: 'credit_card',
              cardNumber: '4111111111111111',
              expiry: '12/25',
              cvv: '123',
              cardholderName: 'John Doe'
            }
          })
          .expect(200);

        suspiciousPayments.push(response.body);
      }

      // Next payment should be flagged as suspicious
      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/authorize`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '192.168.1.100') // Same IP
        .send({
          orderId: testOrder.id,
          paymentMethod: {
            type: 'credit_card',
            cardNumber: '4111111111111111',
            expiry: '12/25',
            cvv: '123',
            cardholderName: 'John Doe'
          }
        })
        .expect(429);

      assertHelpers.assertError(response, 429);
      expect(response.body.error).toContain('suspicious activity detected');
    });

    test('should validate CVV match for security', async () => {
      const paymentData = {
        orderId: testOrder.id,
        paymentMethod: {
          type: 'credit_card',
          cardNumber: '4111111111111111',
          expiry: '12/25',
          // Wrong CVV
          cvv: '999', 
          cardholderName: 'John Doe'
        }
      };

      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/authorize`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(400);

      assertHelpers.assertError(response, 400);
      expect(response.body.error).toContain('CVV mismatch');
    });

    test('should validate cardholder name match', async () => {
      const paymentData = {
        orderId: testOrder.id,
        paymentMethod: {
          type: 'credit_card',
          cardNumber: '4111111111111111',
          expiry: '12/25',
          cvv: '123',
          // Wrong name
          cardholderName: 'Jane Doe'
        }
      };

      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/authorize`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(400);

      assertHelpers.assertError(response, 400);
      expect(response.body.error).toContain('name mismatch');
    });

    test('should handle payment gateway fraud detection', async () => {
      const paymentData = {
        orderId: testOrder.id,
        paymentMethod: {
          type: 'credit_card',
          cardNumber: '4111111111111111',
          expiry: '12/25',
          cvv: '123',
          cardholderName: 'John Doe'
        }
      };

      // Simulate fraud detection response from gateway
      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/authorize`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(403);

      assertHelpers.assertError(response, 403);
      expect(response.body.error).toContain('fraud detected');
      expect(response.body).toHaveProperty('fraudScore');
      expect(response.body.fraudScore).toBeGreaterThan(0.8); // High fraud score
    });
  });

  describe('Payment Reporting Integration', () => {
    
    test('should generate payment transaction report', async () => {
      // Process a payment first
      const authResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/authorize`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: testOrder.id,
          paymentMethod: {
            type: 'credit_card',
            cardNumber: '4111111111111111',
            expiry: '12/25',
            cvv: '123',
            cardholderName: 'John Doe'
          }
        })
        .expect(200);

      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/capture`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transactionId: authResponse.body.transactionId,
          orderId: testOrder.id
        })
        .expect(200);

      // Get payment report
      const reportResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.payment}/report`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        })
        .expect(200);

      assertHelpers.assertSuccess(reportResponse);
      expect(reportResponse.body).toHaveProperty('totalTransactions');
      expect(reportResponse.body).toHaveProperty('totalAmount');
      expect(reportResponse.body).toHaveProperty('successfulTransactions');
      expect(reportResponse.body).toHaveProperty('failedTransactions');
      expect(reportResponse.body.transactions).toHaveLength(1);
    });

    test('should handle payment reconciliation', async () => {
      // Process multiple payments
      const transactionIds = [];
      
      for (let i = 0; i < 3; i++) {
        const authResponse = await request(testServer)
          .post(`${config.api.baseUrl}${config.api.payment}/authorize`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            orderId: testOrder.id,
            paymentMethod: {
              type: 'credit_card',
              cardNumber: '4111111111111111',
              expiry: '12/25',
              cvv: '123',
              cardholderName: 'John Doe'
            }
          })
          .expect(200);

        await request(testServer)
          .post(`${config.api.baseUrl}${config.api.payment}/capture`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            transactionId: authResponse.body.transactionId,
            orderId: testOrder.id
          })
          .expect(200);

        transactionIds.push(authResponse.body.transactionId);
      }

      // Run reconciliation
      const reconcileResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.payment}/reconcile`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        })
        .expect(200);

      assertHelpers.assertSuccess(reconcileResponse);
      expect(reconcileResponse.body).toHaveProperty('reconciledTransactions');
      expect(reconcileResponse.body).toHaveProperty discrepancies');
      expect(reconcileResponse.body.reconciledTransactions).toHaveLength(3);
    });
  });

  // Helper functions
  async function setupTestOrder() {
    // Create test order
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

    testOrder = response.body;
  }

  async function setupTestDatabase() {
    // Mock database setup
    return {
      close: async () => {},
      getPaymentByTransactionId: async (transactionId) => {
        // Mock payment retrieval
        return {
          id: transactionId,
          orderId: testOrder.id,
          status: 'authorized',
          amount: testOrder.total,
          createdAt: new Date()
        };
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