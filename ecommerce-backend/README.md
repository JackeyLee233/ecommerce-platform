# E-commerce Backend API

A comprehensive RESTful API for an e-commerce platform built with Node.js, Express, and MongoDB.

## Features

- **User Authentication & Management**: JWT-based authentication, user registration, login, profile management
- **Product Management**: CRUD operations for products, inventory management, category organization
- **Order Processing**: Order creation, status tracking, payment integration
- **Payment Processing**: Multiple payment gateways (Stripe, Alipay, WeChat Pay, Bank Transfer)
- **Role-based Access Control**: Customer, Admin, and Seller roles
- **Comprehensive Validation**: Input validation and error handling
- **Security Features**: Rate limiting, CORS, helmet security headers

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Express-validator
- **Security**: Helmet, CORS, Rate Limiting
- **Payment**: Stripe, Alipay, WeChat Pay APIs

## Project Structure

```
ecommerce-backend/
├── src/
│   ├── controllers/          # Route controllers
│   ├── models/              # MongoDB models
│   │   ├── User.js
│   │   ├── Product.js
│   │   ├── Order.js
│   │   ├── Payment.js
│   │   └── Category.js
│   ├── routes/              # API routes
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── products.js
│   │   ├── orders.js
│   │   └── payments.js
│   ├── middleware/          # Custom middleware
│   │   ├── auth.js
│   │   ├── validation.js
│   │   └── validations.js
│   ├── utils/               # Utility functions
│   │   └── helpers.js
│   └── server.js            # Main server file
├── tests/                   # Test files
├── config/                  # Configuration files
├── package.json
├── .env.example             # Environment variables example
└── README.md
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ecommerce-backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the server:
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API Endpoints

### Authentication

#### Register User
```
POST /api/auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "Password123!",
  "profile": {
    "firstName": "John",
    "lastName": "Doe",
    "phone": "13800138000"
  }
}
```

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "Password123!"
}
```

#### Get Profile
```
GET /api/auth/profile
Authorization: Bearer <token>
```

#### Update Profile
```
PUT /api/auth/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "profile": {
    "firstName": "John",
    "phone": "13900139000"
  }
}
```

### Users (Admin Only)

#### Get All Users
```
GET /api/users
Authorization: Bearer <admin_token>
```

#### Get User by ID
```
GET /api/users/:id
Authorization: Bearer <admin_token>
```

#### Update User
```
PUT /api/users/:id
Authorization: Bearer <admin_token>
Content-Type: application/json
```

#### Deactivate/Activate User
```
PATCH /api/users/:id/status
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "isActive": false
}
```

### Products

#### Get All Products
```
GET /api/products?page=1&limit=10&category=60d5b41b3b4b3a001f8e4cde&minPrice=100&maxPrice=1000&search=laptop&sort=price:desc
```

#### Get Product by ID
```
GET /api/products/:id
```

#### Create Product (Admin/Seller)
```
POST /api/products
Authorization: Bearer <admin_or_seller_token>
Content-Type: application/json

{
  "name": "Laptop",
  "description": "High performance laptop",
  "price": 999.99,
  "sku": "LAP001",
  "category": "60d5b41b3b4b3a001f8e4cde",
  "inventory": {
    "total": 100
  }
}
```

#### Update Product (Admin/Seller)
```
PUT /api/products/:id
Authorization: Bearer <admin_or_seller_token>
Content-Type: application/json
```

#### Update Inventory (Admin/Seller)
```
PATCH /api/products/:id/inventory
Authorization: Bearer <admin_or_seller_token>
Content-Type: application/json

{
  "total": 150,
  "reserved": 5
}
```

### Orders

#### Get User's Orders
```
GET /api/orders/my?page=1&limit=10&status=pending
Authorization: Bearer <user_token>
```

#### Get All Orders (Admin/Seller)
```
GET /api/orders?page=1&limit=10&status=pending&customerId=60d5b41b3b4b3a001f8e4cde
Authorization: Bearer <admin_or_seller_token>
```

#### Get Order by ID
```
GET /api/orders/:id
Authorization: Bearer <user_token>
```

#### Create Order
```
POST /api/orders
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "items": [
    {
      "productId": "60d5b41b3b4b3a001f8e4cde",
      "quantity": 2,
      "price": 99.99
    }
  ],
  "shippingAddress": {
    "name": "John Doe",
    "phone": "13800138000",
    "email": "john@example.com",
    "address": {
      "street": "123 Main St",
      "city": "Beijing",
      "state": "Beijing",
      "zipCode": "100000"
    }
  },
  "shippingMethod": {
    "name": "Standard Shipping",
    "cost": 10.00
  }
}
```

#### Update Order Status (Admin/Seller)
```
PATCH /api/orders/:id/status
Authorization: Bearer <admin_or_seller_token>
Content-Type: application/json

{
  "status": "shipped"
}
```

#### Add Tracking Information (Admin/Seller)
```
PATCH /api/orders/:id/tracking
Authorization: Bearer <admin_or_seller_token>
Content-Type: application/json

{
  "trackingNumber": "SF1234567890",
  "carrier": "SF Express"
}
```

#### Cancel Order
```
PATCH /api/orders/:id/cancel
Authorization: Bearer <user_token>
```

### Payments

#### Create Payment
```
POST /api/payments/create
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "orderId": "60d5b41b3b4b3a001f8e4cde",
  "paymentMethod": "credit_card",
  "paymentGateway": {
    "provider": "stripe",
    "transactionId": "ch_1234567890"
  }
}
```

#### Process Refund (Admin Only)
```
POST /api/payments/:id/refund
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "amount": 50.00,
  "reason": "Customer request"
}
```

#### Get Payment Methods
```
GET /api/payments/methods/list
```

## Database Models

### User
- username, email, password, role
- profile information (name, phone, address)
- account status and verification

### Product
- name, description, price, SKU
- category, inventory management
- images, variants, shipping info
- SEO and metadata

### Order
- order number, customer information
- order items and pricing
- shipping and billing addresses
- status tracking and payment info

### Payment
- order and customer reference
- payment method and gateway
- transaction details and status
- refund information

### Category
- hierarchical category structure
- SEO and display information

## Environment Variables

```bash
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/ecommerce
JWT_SECRET=your-super-secret-jwt-key
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
ALIPAY_APP_ID=your_alipay_app_id
WECHAT_APP_ID=your_wechat_app_id
```

## Security Features

- JWT-based authentication
- Role-based access control
- Input validation and sanitization
- Rate limiting
- CORS protection
- Helmet security headers
- Password hashing with bcrypt

## Error Handling

The API uses standardized error responses:

```json
{
  "success": false,
  "message": "Error description",
  "details": ["Additional error details"]
}
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License

## Support

For support and questions, please open an issue in the repository.