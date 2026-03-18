/**
 * End-to-End Tests for Admin Product Management Flow
 * 
 * Tests the complete admin journey from product creation to management,
 * including CRUD operations, inventory management, and catalog maintenance.
 */

const { 
  config, 
  dbUtils, 
  apiUtils, 
  mockGenerators,
  assertHelpers 
} = require('../test-config');
const request = require('supertest');

describe('E-commerce Platform - Admin Product Management Flow', () => {
  
  let testServer;
  let testDbConnection;
  let adminToken;
  let adminUser;
  let testProducts;

  beforeAll(async () => {
    // Setup test database and server
    testDbConnection = await setupTestDatabase();
    testServer = await setupTestServer();
    
    // Clear database before tests
    await dbUtils.clearDatabase();
    
    // Create admin user
    adminUser = mockGenerators.generateUser({
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin'
    });
    
    // Register admin user
    await request(testServer)
      .post(`${config.api.baseUrl}${config.api.auth}/register`)
      .send(adminUser)
      .expect(201);

    // Login as admin
    const loginResponse = await request(testServer)
      .post(`${config.api.baseUrl}${config.api.auth}/login`)
      .send({
        email: adminUser.email,
        password: adminUser.password
      })
      .expect(200);

    adminToken = loginResponse.body.token;

    // Create some initial test products
    testProducts = [
      mockGenerators.generateProduct({ name: 'Existing Product 1', category: 'Electronics' }),
      mockGenerators.generateProduct({ name: 'Existing Product 2', category: 'Clothing' })
    ];

    // Add initial products to database
    for (const product of testProducts) {
      await dbUtils.createProduct(product);
    }
  });

  afterAll(async () => {
    // Cleanup
    await testServer.close();
    await dbUtils.teardown();
    await testDbConnection.close();
  });

  describe('Product Management - Admin CRUD Operations', () => {
    
    test('should create new product with valid data', async () => {
      const newProduct = mockGenerators.generateProduct({
        name: 'New Laptop',
        category: 'Electronics',
        price: 1299.99,
        stock: 25,
        description: 'High-performance laptop for professionals'
      });

      const response = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.products}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newProduct)
        .expect(201);

      assertHelpers.assertSuccess(response);
      expect(response.body).toHaveProperty('productId');
      expect(response.body.name).toBe(newProduct.name);
      expect(response.body.category).toBe(newProduct.category);
      expect(response.body.price).toBe(newProduct.price);
      expect(response.body.stock).toBe(newProduct.stock);

      // Verify product created in database
      const createdProduct = await dbUtils.getProductById(response.body.productId);
      expect(createdProduct).toBeDefined();
      expect(createdProduct.name).toBe(newProduct.name);
    });

    test('should validate product creation data', async () => {
      const invalidProducts = [
        // Invalid name
        { name: '', category: 'Electronics', price: 99.99, stock: 10 },
        // Invalid category
        { name: 'Product', category: 'Invalid', price: 99.99, stock: 10 },
        // Invalid price
        { name: 'Product', category: 'Electronics', price: -10, stock: 10 },
        // Invalid stock
        { name: 'Product', category: 'Electronics', price: 99.99, stock: -5 }
      ];

      for (const product of invalidProducts) {
        const response = await request(testServer)
          .post(`${config.api.baseUrl}${config.api.products}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(product)
          .expect(400);

        assertHelpers.assertError(response, 400);
        expect(response.body.error).toContain('validation failed');
      }
    });

    test('should update existing product', async () => {
      const productToUpdate = testProducts[0];
      const updateData = {
        name: 'Updated Product Name',
        price: 199.99,
        stock: 50,
        description: 'Updated product description'
      };

      const response = await request(testServer)
        .put(`${config.api.baseUrl}${config.api.products}/${productToUpdate.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      assertHelpers.assertSuccess(response);
      expect(response.body.name).toBe(updateData.name);
      expect(response.body.price).toBe(updateData.price);
      expect(response.body.stock).toBe(updateData.stock);
      expect(response.body.description).toBe(updateData.description);

      // Verify product updated in database
      const updatedProduct = await dbUtils.getProductById(productToUpdate.id);
      expect(updatedProduct.name).toBe(updateData.name);
      expect(updatedProduct.price).toBe(updateData.price);
    });

    test('should update product inventory', async () => {
      const product = testProducts[0];
      const stockUpdateData = {
        operation: 'add', // add, subtract, set
        quantity: 10
      };

      const response = await request(testServer)
        .patch(`${config.api.baseUrl}${config.api.products}/${product.id}/inventory`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(stockUpdateData)
        .expect(200);

      assertHelpers.assertSuccess(response);
      expect(response.body.stock).toBe(product.stock + stockUpdateData.quantity);

      // Verify inventory updated in database
      const updatedProduct = await dbUtils.getProductById(product.id);
      expect(updatedProduct.stock).toBe(product.stock + stockUpdateData.quantity);
    });

    test('should delete product', async () => {
      const productToDelete = testProducts[1];
      
      // Delete product
      const response = await request(testServer)
        .delete(`${config.api.baseUrl}${config.api.products}/${productToDelete.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assertHelpers.assertSuccess(response);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('deleted');

      // Verify product deleted from database
      const deletedProduct = await dbUtils.getProductById(productToDelete.id);
      expect(deletedProduct).toBeNull();
    });

    test('should handle product not found scenarios', async () => {
      const nonExistentProductId = 99999;
      
      // Try to update non-existent product
      const updateResponse = await request(testServer)
        .put(`${config.api.baseUrl}${config.api.products}/${nonExistentProductId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Name' })
        .expect(404);

      assertHelpers.assertError(updateResponse, 404);
      expect(updateResponse.body.error).toContain('product not found');

      // Try to delete non-existent product
      const deleteResponse = await request(testServer)
        .delete(`${config.api.baseUrl}${config.api.products}/${nonExistentProductId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      assertHelpers.assertError(deleteResponse, 404);
      expect(deleteResponse.body.error).toContain('product not found');
    });
  });

  describe('Product Catalog Management', () => {
    
    test('should manage product categories', async () => {
      // Create new category
      const newCategory = {
        name: 'Sports & Outdoors',
        description: 'Equipment and gear for sports and outdoor activities'
      };

      const categoryResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.products}/categories`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newCategory)
        .expect(201);

      assertHelpers.assertSuccess(categoryResponse);
      expect(categoryResponse.body).toHaveProperty('categoryId');
      expect(categoryResponse.body.name).toBe(newCategory.name);

      const categoryId = categoryResponse.body.categoryId;

      // Create product in new category
      const productInNewCategory = mockGenerators.generateProduct({
        name: 'Basketball',
        category: newCategory.name,
        price: 29.99,
        stock: 15
      });

      const productResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.products}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(productInNewCategory)
        .expect(201);

      assertHelpers.assertSuccess(productResponse);
      expect(productResponse.body.category).toBe(newCategory.name);

      // List all categories
      const categoriesResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.products}/categories`)
        .expect(200);

      assertHelpers.assertSuccess(categoriesResponse);
      expect(categoriesResponse.body.categories).toContain(newCategory.name);

      // Update category
      const updateCategoryData = {
        name: 'Sports & Recreation',
        description: 'Updated description for sports and recreation'
      };

      const updateCategoryResponse = await request(testServer)
        .put(`${config.api.baseUrl}${config.api.products}/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateCategoryData)
        .expect(200);

      assertHelpers.assertSuccess(updateCategoryResponse);
      expect(updateCategoryResponse.body.name).toBe(updateCategoryData.name);

      // Delete category
      const deleteCategoryResponse = await request(testServer)
        .delete(`${config.api.baseUrl}${config.api.products}/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assertHelpers.assertSuccess(deleteCategoryResponse);
      expect(deleteCategoryResponse.body).toHaveProperty('message');
    });

    test('should manage product attributes', async () => {
      const product = testProducts[0];
      
      // Add product attributes
      const attributesData = {
        color: 'Blue',
        size: 'Medium',
        weight: '2.5 kg',
        warranty: '2 years'
      };

      const attributesResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.products}/${product.id}/attributes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(attributesData)
        .expect(200);

      assertHelpers.assertSuccess(attributesResponse);
      expect(attributesResponse.body).toHaveProperty('attributes');
      expect(attributesResponse.body.attributes.color).toBe('Blue');
      expect(attributesResponse.body.attributes.size).toBe('Medium');

      // Get product with attributes
      const getProductResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.products}/${product.id}`)
        .expect(200);

      assertHelpers.assertSuccess(getProductResponse);
      expect(getProductResponse.body).toHaveProperty('attributes');
      expect(getProductResponse.body.attributes.color).toBe('Blue');

      // Update product attributes
      const updateAttributesData = {
        color: 'Red',
        size: 'Large',
        material: 'Aluminum'
      };

      const updateAttributesResponse = await request(testServer)
        .put(`${config.api.baseUrl}${config.api.products}/${product.id}/attributes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateAttributesData)
        .expect(200);

      assertHelpers.assertSuccess(updateAttributesResponse);
      expect(updateAttributesResponse.body.attributes.color).toBe('Red');
      expect(updateAttributesResponse.body.attributes.material).toBe('Aluminum');
    });

    test('should manage product images', async () => {
      const product = testProducts[0];
      
      // Upload product image
      const imageData = {
        url: 'https://example.com/images/product1.jpg',
        alt: 'Product image',
        isPrimary: true
      };

      const imageResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.products}/${product.id}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(imageData)
        .expect(201);

      assertHelpers.assertSuccess(imageResponse);
      expect(imageResponse.body).toHaveProperty('imageId');
      expect(imageResponse.body.url).toBe(imageData.url);

      // Get product images
      const imagesResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.products}/${product.id}/images`)
        .expect(200);

      assertHelpers.assertSuccess(imagesResponse);
      expect(imagesResponse.body.images).toHaveLength(1);
      expect(imagesResponse.body.images[0].url).toBe(imageData.url);

      // Set primary image
      const setPrimaryResponse = await request(testServer)
        .put(`${config.api.baseUrl}${config.api.products}/${product.id}/images/${imageResponse.body.imageId}/primary`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assertHelpers.assertSuccess(setPrimaryResponse);
      expect(setPrimaryResponse.body.isPrimary).toBe(true);

      // Delete product image
      const deleteImageResponse = await request(testServer)
        .delete(`${config.api.baseUrl}${config.api.products}/${product.id}/images/${imageResponse.body.imageId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assertHelpers.assertSuccess(deleteImageResponse);
      expect(deleteImageResponse.body).toHaveProperty('message');
    });
  });

  describe('Product Search and Filtering', () => {
    
    test('should search products by name', async () => {
      // Create test products for search
      const searchProducts = [
        mockGenerators.generateProduct({ name: 'Wireless Mouse', category: 'Electronics' }),
        mockGenerators.generateProduct({ name: 'Wireless Keyboard', category: 'Electronics' }),
        mockGenerators.generateProduct({ name: 'Gaming Mouse', category: 'Electronics' })
      ];

      for (const product of searchProducts) {
        await request(testServer)
          .post(`${config.api.baseUrl}${config.api.products}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(product)
          .expect(201);
      }

      // Search for wireless products
      const searchResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.products}`)
        .query({ search: 'wireless' })
        .expect(200);

      assertHelpers.assertSuccess(searchResponse);
      expect(searchResponse.body.products).toHaveLength(2);
      expect(searchResponse.body.products.every(p => p.name.toLowerCase().includes('wireless'))).toBe(true);
    });

    test('should filter products by category', async () => {
      // Search for electronics products
      const categoryResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.products}`)
        .query({ category: 'Electronics' })
        .expect(200);

      assertHelpers.assertSuccess(categoryResponse);
      expect(categoryResponse.body.products.every(p => p.category === 'Electronics')).toBe(true);
    });

    test('should filter products by price range', async () => {
      // Search for products in price range
      const priceResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.products}`)
        .query({ minPrice: 50, maxPrice: 200 })
        .expect(200);

      assertHelpers.assertSuccess(priceResponse);
      expect(priceResponse.body.products.every(p => p.price >= 50 && p.price <= 200)).toBe(true);
    });

    test('should sort products', async () => {
      // Sort by price ascending
      const sortAscResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.products}`)
        .query({ sortBy: 'price', sortOrder: 'asc' })
        .expect(200);

      assertHelpers.assertSuccess(sortAscResponse);
      const prices = sortAscResponse.body.products.map(p => p.price);
      expect(prices).toEqual([...prices].sort((a, b) => a - b));

      // Sort by price descending
      const sortDescResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.products}`)
        .query({ sortBy: 'price', sortOrder: 'desc' })
        .expect(200);

      assertHelpers.assertSuccess(sortDescResponse);
      const descPrices = sortDescResponse.body.products.map(p => p.price);
      expect(descPrices).toEqual([...descPrices].sort((a, b) => b - a));
    });

    test('should paginate product results', async () => {
      // Get first page
      const page1Response = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.products}`)
        .query({ page: 1, limit: 5 })
        .expect(200);

      assertHelpers.assertSuccess(page1Response);
      expect(page1Response.body.products).toHaveLength(5);
      expect(page1Response.body).toHaveProperty('pagination');
      expect(page1Response.body.pagination.page).toBe(1);
      expect(page1Response.body.pagination.limit).toBe(5);

      // Get second page
      const page2Response = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.products}`)
        .query({ page: 2, limit: 5 })
        .expect(200);

      assertHelpers.assertSuccess(page2Response);
      expect(page2Response.body.pagination.page).toBe(2);
    });
  });

  describe('Product Analytics and Reporting', () => {
    
    test('should generate product sales report', async () => {
      const reportResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.products}/analytics/sales`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        })
        .expect(200);

      assertHelpers.assertSuccess(reportResponse);
      expect(reportResponse.body).toHaveProperty('totalSales');
      expect(reportResponse.body).toHaveProperty('totalProducts');
      expect(reportResponse.body).toHaveProperty('topSellingProducts');
      expect(reportResponse.body).toHaveProperty('salesByCategory');
    });

    test('should generate inventory report', async () => {
      const inventoryResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.products}/analytics/inventory`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assertHelpers.assertSuccess(inventoryResponse);
      expect(inventoryResponse.body).toHaveProperty('totalProducts');
      expect(inventoryResponse.body).toHaveProperty('lowStockProducts');
      expect(inventoryResponse.body).toHaveProperty('outOfStockProducts');
      expect(inventoryResponse.body).toHaveProperty('totalInventoryValue');
    });

    test('should generate performance metrics', async () => {
      const metricsResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.products}/analytics/performance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assertHelpers.assertSuccess(metricsResponse);
      expect(metricsResponse.body).toHaveProperty('viewCount');
      expect(metricsResponse.body).toHaveProperty('conversionRate');
      expect(metricsResponse.body).toHaveProperty('averageRating');
      expect(metricsResponse.body).toHaveProperty('popularProducts');
    });
  });

  describe('Bulk Operations', () => {
    
    test('should bulk update products', async () => {
      // Create test products for bulk update
      const bulkProducts = [
        mockGenerators.generateProduct({ name: 'Bulk Product 1', category: 'Electronics' }),
        mockGenerators.generateProduct({ name: 'Bulk Product 2', category: 'Electronics' }),
        mockGenerators.generateProduct({ name: 'Bulk Product 3', category: 'Electronics' })
      ];

      const createdProductIds = [];
      for (const product of bulkProducts) {
        const response = await request(testServer)
          .post(`${config.api.baseUrl}${config.api.products}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(product)
          .expect(201);
        
        createdProductIds.push(response.body.productId);
      }

      // Bulk update products
      const bulkUpdateData = {
        category: 'Electronics & Gadgets',
        priceMultiplier: 1.1 // Increase prices by 10%
      };

      const bulkResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.products}/bulk-update`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productIds: createdProductIds,
          updates: bulkUpdateData
        })
        .expect(200);

      assertHelpers.assertSuccess(bulkResponse);
      expect(bulkResponse.body.updatedCount).toBe(3);

      // Verify products were updated
      for (const productId of createdProductIds) {
        const product = await dbUtils.getProductById(productId);
        expect(product.category).toBe('Electronics & Gadgets');
      }
    });

    test('should bulk delete products', async () => {
      // Create test products for bulk delete
      const bulkProducts = [
        mockGenerators.generateProduct({ name: 'Delete Product 1', category: 'Electronics' }),
        mockGenerators.generateProduct({ name: 'Delete Product 2', category: 'Electronics' })
      ];

      const createdProductIds = [];
      for (const product of bulkProducts) {
        const response = await request(testServer)
          .post(`${config.api.baseUrl}${config.api.products}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(product)
          .expect(201);
        
        createdProductIds.push(response.body.productId);
      }

      // Bulk delete products
      const bulkDeleteResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.products}/bulk-delete`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ productIds: createdProductIds })
        .expect(200);

      assertHelpers.assertSuccess(bulkDeleteResponse);
      expect(bulkDeleteResponse.body.deletedCount).toBe(2);

      // Verify products were deleted
      for (const productId of createdProductIds) {
        const product = await dbUtils.getProductById(productId);
        expect(product).toBeNull();
      }
    });

    test('should export product catalog', async () => {
      const exportResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.products}/export`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ format: 'csv' })
        .expect(200);

      assertHelpers.assertSuccess(exportResponse);
      expect(exportResponse.headers['content-type']).toContain('text/csv');
      expect(exportResponse.body).toContain('name,category,price,stock');
    });
  });

  describe('Admin Access Control', () => {
    
    test('should restrict admin-only endpoints to authenticated admins', async () => {
      // Create regular user
      const regularUser = mockGenerators.generateUser();
      await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/register`)
        .send(regularUser)
        .expect(201);

      const regularLoginResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/login`)
        .send({
          email: regularUser.email,
          password: regularUser.password
        })
        .expect(200);

      const regularToken = regularLoginResponse.body.token;

      // Regular user should not be able to access admin endpoints
      const createProductResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.products}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send(mockGenerators.generateProduct())
        .expect(403);

      assertHelpers.assertError(createProductResponse, 403);
      expect(createProductResponse.body.error).toContain('admin access required');

      // Admin should be able to access admin endpoints
      const adminCreateResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.products}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(mockGenerators.generateProduct())
        .expect(201);

      assertHelpers.assertSuccess(adminCreateResponse);
    });

    test('should handle admin session management', async () => {
      // Admin logout
      const logoutResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/logout`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assertHelpers.assertSuccess(logoutResponse);

      // Admin should not be able to access admin endpoints after logout
      const adminAccessResponse = await request(testServer)
        .get(`${config.api.baseUrl}${config.api.products}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(401);

      assertHelpers.assertError(adminAccessResponse, 401);
      expect(adminAccessResponse.body.error).toContain('invalid token');

      // Admin should be able to login again
      const reloginResponse = await request(testServer)
        .post(`${config.api.baseUrl}${config.api.auth}/login`)
        .send({
          email: adminUser.email,
          password: adminUser.password
        })
        .expect(200);

      assertHelpers.assertSuccess(reloginResponse);
      expect(reloginResponse.body).toHaveProperty('token');
    });
  });

  // Helper functions
  async function setupTestDatabase() {
    // Mock database setup
    return {
      close: async () => {},
      createProduct: async (product) => {
        // Mock product creation
        return { id: Date.now(), ...product };
      },
      getProductById: async (productId) => {
        // Mock product retrieval
        return testProducts.find(p => p.id === productId) || null;
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