# E-commerce Platform Test Suite

This directory contains comprehensive test cases for an e-commerce platform, including unit tests, integration tests, and end-to-end tests.

## Test Structure

```
ecommerce-tests/
├── README.md                 # This file
├── test-config.js           # Test configuration and utilities
├── unit/                    # Unit tests
│   ├── auth.test.js         # User registration and login tests
│   ├── products.test.js     # Product browsing and management tests
│   ├── cart.test.js         # Shopping cart functionality tests
│   ├── orders.test.js       # Order placement and management tests
│   └── payment.test.js      # Payment processing tests
├── integration/              # Integration tests
│   ├── auth-integration.test.js
│   ├── cart-integration.test.js
│   ├── order-integration.test.js
│   └── payment-integration.test.js
└── e2e/                     # End-to-end tests
    ├── user-flow.test.js    # Complete user registration to purchase flow
    ├── admin-flow.test.js   # Admin product management flow
    └── api-flow.test.js     # API integration flow
```

## Test Features Covered

### 1. User Registration & Login
- Unit tests for validation logic
- Integration tests with database
- E2E tests for complete authentication flow

### 2. Product Browsing
- Unit tests for product filtering/sorting
- Integration tests with product catalog
- E2E tests for search and navigation

### 3. Shopping Cart
- Unit tests for cart operations
- Integration tests with inventory system
- E2E tests for cart management

### 4. Order Placement
- Unit tests for order validation
- Integration tests with order processing
- E2E tests for checkout process

### 5. Payment Processing
- Unit tests for payment validation
- Integration tests with payment gateway
- E2E tests for payment completion

## Testing Framework

- **Unit Tests**: Jest with React Testing Library (for frontend)
- **Integration Tests**: Supertest with Express (for API)
- **E2E Tests**: Cypress or Playwright (for full user flows)
- **Database**: Test database with Jest setup/teardown

## Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run e2e tests
npm run test:e2e

# Run tests with coverage
npm run test:coverage
```

## Test Data

Mock data is stored in `test-data/` directory for consistent testing across all test types.