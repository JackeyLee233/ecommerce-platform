/**
 * Integration Tests for User Authentication
 * 
 * Tests integration between authentication components, database, 
 * and external services for user registration and login functionality.
 */

const { 
  config, 
  dbUtils, 
  apiUtils, 
  mockGenerators,
  assertHelpers 
} = require('../test-config');
const request = require('supertest');

describe('User Authentication - Integration Tests', () => {
  
  let testServer;
  let testDbConnection;

  beforeAll(async () => {
    // Setup test database and server
    testDbConnection = await setupTestDatabase();
    testServer = await setupTestServer();
    
    // Clear database before tests
    await dbUtils.clearDatabase();
  });

  afterAll(async () => {
    // Cleanup
    await testServer.close();
    await dbUtils.teardown();
    await testDbConnection.close();
  });

  describe('User Registration Integration', () => {
    
    test('should register new user with valid data', async () => {
      const userData = mockGenerators.generateUser();
      
      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/register`)
        .send(userData)
        .expect(201);

      assertHelpers.assertSuccess(response);
      expect(response.body).toHaveProperty('userId');
      expect(response.body).toHaveProperty('email', userData.email);
      expect(response.body).toHaveProperty('token');
      
      // Verify user exists in database
      const userRecord = await dbUtils.findUserByEmail(userData.email);
      expect(userRecord).toBeDefined();
      expect(userRecord.email).toBe(userData.email);
      expect(userRecord.password).not.toBe(userData.password); // Should be hashed
    });

    test('should reject duplicate email registration', async () => {
      const userData = mockGenerators.generateUser();
      
      // First registration should succeed
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/register`)
        .send(userData)
        .expect(201);

      // Second registration with same email should fail
      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/register`)
        .send(userData)
        .expect(409);

      assertHelpers.assertError(response, 409);
      expect(response.body.error).toContain('already exists');
    });

    test('should validate email format on registration', async () => {
      const invalidEmails = [
        'invalid-email',
        'test@',
        '@example.com',
        'test.example.com',
        ''
      ];

      for (const email of invalidEmails) {
        const userData = mockGenerators.generateUser({ email });
        
        const response = await request(testServer)
          .post(`${config.api.baseUrl}${config.api.auth}/register`)
          .send(userData)
          .expect(400);

        assertHelpers.assertValidationError(response, 'email');
      }
    });

    test('should validate password strength on registration', async () => {
      const weakPasswords = [
        'weak',
        'password123',
        'PASSWORD123!',
        'Testpassword!',
        'TestPassword123',
        ''
      ];

      for (const password of weakPasswords) {
        const userData = mockGenerators.generateUser({ password });
        
        const response = await request(testServer)
          .post(`${config.api.baseUrl}${config.api.auth}/register`)
          .send(userData)
          .expect(400);

        assertHelpers.assertValidationError(response, 'password');
      }
    });

    test('should validate user name format on registration', async () => {
      const invalidNames = [
        '',
        'A',
        'A'.repeat(51),
        'John123',
        'John@Doe',
        '  '
      ];

      for (const name of invalidNames) {
        const userData = mockGenerators.generateUser({ name });
        
        const response = await request(testServer)
          .post(`${config.api.baseUrl}${config.api.auth}/register`)
          .send(userData)
          .expect(400);

        assertHelpers.assertValidationError(response, 'name');
      }
    });

    test('should hash password before storing in database', async () => {
      const userData = mockGenerators.generateUser();
      const plainPassword = userData.password;
      
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/register`)
        .send(userData)
        .expect(201);

      const userRecord = await dbUtils.findUserByEmail(userData.email);
      expect(userRecord.password).not.toBe(plainPassword);
      expect(userRecord.password).toContain('hashed'); // Should be hashed
    });

    test('should create user profile with registration', async () => {
      const userData = mockGenerators.generateUser();
      
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/register`)
        .send(userData)
        .expect(201);

      const userProfile = await dbUtils.findUserProfileByEmail(userData.email);
      expect(userProfile).toBeDefined();
      expect(userProfile.email).toBe(userData.email);
      expect(userProfile.name).toBe(userData.name);
      expect(userProfile.createdAt).toBeDefined();
    });
  });

  describe('User Login Integration', () => {
    
    test('should login with valid credentials', async () => {
      const userData = mockGenerators.generateUser();
      
      // Register user first
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/register`)
        .send(userData)
        .expect(201);

      // Login with same credentials
      const loginResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/login`)
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);

      assertHelpers.assertSuccess(loginResponse);
      expect(loginResponse.body).toHaveProperty('token');
      expect(loginResponse.body).toHaveProperty('user');
      expect(loginResponse.body.user.email).toBe(userData.email);
    });

    test('should reject invalid email login', async () => {
      const userData = mockGenerators.generateUser();
      
      // Register user first
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/register`)
        .send(userData)
        .expect(201);

      // Login with wrong email
      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/login`)
        .send({
          email: 'wrong@example.com',
          password: userData.password
        })
        .expect(401);

      assertHelpers.assertError(response, 401);
      expect(response.body.error).toContain('invalid credentials');
    });

    test('should reject invalid password login', async () => {
      const userData = mockGenerators.generateUser();
      
      // Register user first
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/register`)
        .send(userData)
        .expect(201);

      // Login with wrong password
      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/login`)
        .send({
          email: userData.email,
          password: 'wrongpassword'
        })
        .expect(401);

      assertHelpers.assertError(response, 401);
      expect(response.body.error).toContain('invalid credentials');
    });

    test('should track failed login attempts', async () => {
      const userData = mockGenerators.generateUser();
      
      // Register user first
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/register`)
        .send(userData)
        .expect(201);

      // Multiple failed login attempts
      for (let i = 0; i < 3; i++) {
        await request(testServer)
          .post(`${config.api.baseUrl}${config.api.auth}/login`)
          .send({
            email: userData.email,
            password: 'wrongpassword'
          })
          .expect(401);
      }

      // Check failed attempts in database
      const userRecord = await dbUtils.findUserByEmail(userData.email);
      expect(userRecord.failedLoginAttempts).toBe(3);
    });

    test('should lock account after too many failed attempts', async () => {
      const userData = mockGenerators.generateUser();
      
      // Register user first
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/register`)
        .send(userData)
        .expect(201);

      // Multiple failed login attempts (more than threshold)
      for (let i = 0; i < 6; i++) {
        await request(testServer)
          .post(`${config.api.baseUrl}${config.api.auth}/login`)
          .send({
            email: userData.email,
            password: 'wrongpassword'
          })
          .expect(401);
      }

      // Account should be locked
      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/login`)
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(423);

      assertHelpers.assertError(response, 423);
      expect(response.body.error).toContain('account locked');
    });

    test('should generate JWT token on successful login', async () => {
      const userData = mockGenerators.generateUser();
      
      // Register user first
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/register`)
        .send(userData)
        .expect(201);

      // Login
      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/login`)
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);

      const token = response.body.token;
      expect(token).toBeDefined();
      expect(token).toMatch(/^eyJ/); // JWT format
      expect(token).toContain('.'); // JWT has dots
      expect(token).toContain(userData.email); // Should contain user info
    });

    test('should validate JWT token format', async () => {
      const userData = mockGenerators.generateUser();
      
      // Register and login
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/register`)
        .send(userData)
        .expect(201);

      const loginResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/login`)
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);

      const token = loginResponse.body.token;
      
      // Validate token structure
      const parts = token.split('.');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBeDefined(); // Header
      expect(parts[1]).toBeDefined(); // Payload
      expect(parts[2]).toBeDefined(); // Signature
    });
  });

  describe('Session Management Integration', () => {
    
    test('should validate JWT token for protected routes', async () => {
      const userData = mockGenerators.generateUser();
      
      // Register and login
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/register`)
        .send(userData)
        .expect(201);

      const loginResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/login`)
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);

      const token = loginResponse.body.token;

      // Test protected route with valid token
      const protectedResponse = await request(testServer)
        .get(`${config.api.baseUrl}/profile`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      assertHelpers.assertSuccess(protectedResponse);
      expect(protectedResponse.body).toHaveProperty('user');
      expect(protectedResponse.body.user.email).toBe(userData.email);
    });

    test('should reject invalid JWT token', async () => {
      const response = await request(testServer)
        .get(`${config.api.baseUrl}/profile`)
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      assertHelpers.assertError(response, 401);
      expect(response.body.error).toContain('invalid token');
    });

    test('should reject missing JWT token', async () => {
      const response = await request(testServer)
        .get(`${config.api.baseUrl}/profile`)
        .expect(401);

      assertHelpers.assertError(response, 401);
      expect(response.body.error).toContain('authorization required');
    });

    test('should reject expired JWT token', async () => {
      const userData = mockGenerators.generateUser();
      
      // Register and login
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/register`)
        .send(userData)
        .expect(201);

      const loginResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/login`)
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);

      // Use expired token (simulate by tampering with expiration)
      const expiredToken = loginResponse.body.token.replace(/\.([^.]*)$/, '.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9.invalid');
      
      const response = await request(testServer)
        .get(`${config.api.baseUrl}/profile`)
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      assertHelpers.assertError(response, 401);
      expect(response.body.error).toContain('token expired');
    });

    test('should refresh JWT token before expiration', async () => {
      const userData = mockGenerators.generateUser();
      
      // Register and login
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/register`)
        .send(userData)
        .expect(201);

      const loginResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/login`)
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);

      const originalToken = loginResponse.body.token;

      // Refresh token
      const refreshResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/refresh`)
        .set('Authorization', `Bearer ${originalToken}`)
        .expect(200);

      assertHelpers.assertSuccess(refreshResponse);
      const newToken = refreshResponse.body.token;
      
      expect(newToken).toBeDefined();
      expect(newToken).not.toBe(originalToken); // Should be different token
    });
  });

  describe('Password Reset Integration', () => {
    
    test('should initiate password reset flow', async () => {
      const userData = mockGenerators.generateUser();
      
      // Register user first
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/register`)
        .send(userData)
        .expect(201);

      // Initiate password reset
      const resetResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/reset-password`)
        .send({ email: userData.email })
        .expect(200);

      assertHelpers.assertSuccess(resetResponse);
      expect(resetResponse.body).toHaveProperty('message');
      expect(resetResponse.body.message).toContain('reset link');

      // Verify reset token was created in database
      const resetToken = await dbUtils.findResetTokenByEmail(userData.email);
      expect(resetToken).toBeDefined();
      expect(resetToken).toHaveProperty('token');
      expect(resetToken).toHaveProperty('expiresAt');
    });

    test('should validate password reset token', async () => {
      const userData = mockGenerators.generateUser();
      
      // Register user first
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/register`)
        .send(userData)
        .expect(201);

      // Initiate password reset
      const resetResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/reset-password`)
        .send({ email: userData.email })
        .expect(200);

      const resetToken = resetResponse.body.resetToken;

      // Validate reset token
      const validateResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/validate-reset-token`)
        .send({ token: resetToken })
        .expect(200);

      assertHelpers.assertSuccess(validateResponse);
      expect(validateResponse.body).toHaveProperty('valid', true);
      expect(validateResponse.body).toHaveProperty('userId');
    });

    test('should reset password with valid token', async () => {
      const userData = mockGenerators.generateUser();
      const newPassword = 'NewPassword123!';
      
      // Register user first
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/register`)
        .send(userData)
        .expect(201);

      // Initiate password reset
      const resetResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/reset-password`)
        .send({ email: userData.email })
        .expect(200);

      const resetToken = resetResponse.body.resetToken;

      // Reset password
      const resetPasswordResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/confirm-reset-password`)
        .send({
          token: resetToken,
          newPassword: newPassword
        })
        .expect(200);

      assertHelpers.assertSuccess(resetPasswordResponse);
      expect(resetPasswordResponse.body).toHaveProperty('message');
      expect(resetPasswordResponse.body.message).toContain('password updated');

      // Verify login with new password
      const loginResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/login`)
        .send({
          email: userData.email,
          password: newPassword
        })
        .expect(200);

      assertHelpers.assertSuccess(loginResponse);
    });

    test('should reject expired reset token', async () => {
      const userData = mockGenerators.generateUser();
      
      // Register user first
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/register`)
        .send(userData)
        .expect(201);

      // Create expired token manually
      const expiredToken = 'expired-token-' + Date.now();
      await dbUtils.createResetToken(userData.email, expiredToken, Date.now() - 3600000); // 1 hour ago

      // Try to use expired token
      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/validate-reset-token`)
        .send({ token: expiredToken })
        .expect(400);

      assertHelpers.assertError(response, 400);
      expect(response.body.error).toContain('expired');
    });

    test('should reject invalid reset token', async () => {
      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/validate-reset-token`)
        .send({ token: 'invalid-token' })
        .expect(400);

      assertHelpers.assertError(response, 400);
      expect(response.body.error).toContain('invalid');
    });
  });

  // Helper functions
  async function setupTestDatabase() {
    // Mock database setup
    return {
      close: async () => {},
      findUserByEmail: async (email) => {
        // Mock database query
        return null; // Return null for testing
      },
      findUserProfileByEmail: async (email) => {
        return null;
      },
      findResetTokenByEmail: async (email) => {
        return null;
      },
      createResetToken: async (email, token, expiresAt) => {
        // Mock token creation
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