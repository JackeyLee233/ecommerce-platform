/**
 * Unit Tests for Product Browsing and Management
 * 
 * Tests product filtering, sorting, search, and display logic
 * for the e-commerce product catalog.
 */

const { 
  mockGenerators, 
  assertHelpers 
} = require('../test-config');

describe('Product Browsing - Unit Tests', () => {
  
  describe('Product Validation', () => {
    
    test('should validate product name', () => {
      const productNameValidator = (name) => {
        const minLength = 2;
        const maxLength = 100;
        const hasValidChars = /^[a-zA-Z0-9\s\-_]+$/.test(name);
        
        return name && 
               name.length >= minLength && 
               name.length <= maxLength && 
               hasValidChars;
      };

      // Valid product names
      expect(productNameValidator('Laptop')).toBe(true);
      expect(productNameValidator('Gaming Mouse - Wireless')).toBe(true);
      expect(productNameValidator('123 Product')).toBe(true);

      // Invalid product names
      expect(productNameValidator('')).toBe(false);
      expect(productNameValidator('A')).toBe(false); // too short
      expect(productNameValidator('A'.repeat(101))).toBe(false); // too long
      expect(productNameValidator('Product@Name')).toBe(false); // special chars
    });

    test('should validate product price', () => {
      const priceValidator = (price) => {
        const isValidNumber = typeof price === 'number' && !isNaN(price);
        const isPositive = price > 0;
        const hasMaxDecimals = price.toString().split('.')[1]?.length <= 2 || false;
        
        return isValidNumber && isPositive && hasMaxDecimals;
      };

      // Valid prices
      expect(priceValidator(99.99)).toBe(true);
      expect(priceValidator(1000)).toBe(true);
      expect(priceValidator(0.01)).toBe(true);

      // Invalid prices
      expect(priceValidator(-50)).toBe(false); // negative
      expect(priceValidator(0)).toBe(false); // zero
      expect(priceValidator('99.99')).toBe(false); // string
      expect(priceValidator(99.999)).toBe(false); // too many decimals
      expect(priceValidator(NaN)).toBe(false);
    });

    test('should validate product category', () => {
      const validCategories = [
        'Electronics', 
        'Clothing', 
        'Home & Garden', 
        'Sports', 
        'Books',
        'Beauty',
        'Automotive',
        'Toys'
      ];

      const categoryValidator = (category) => {
        return validCategories.includes(category);
      };

      // Valid categories
      expect(categoryValidator('Electronics')).toBe(true);
      expect(categoryValidator('Clothing')).toBe(true);
      expect(categoryValidator('Home & Garden')).toBe(true);

      // Invalid categories
      expect(categoryValidator('Invalid Category')).toBe(false);
      expect(categoryValidator('')).toBe(false);
      expect(categoryValidator('electronics')).toBe(false); // case sensitive
    });

    test('should validate product stock quantity', () => {
      const stockValidator = (stock) => {
        const isValidNumber = Number.isInteger(stock);
        const isNonNegative = stock >= 0;
        const hasMaxLimit = stock <= 10000;
        
        return isValidNumber && isNonNegative && hasMaxLimit;
      };

      // Valid stock quantities
      expect(stockValidator(0)).toBe(true);
      expect(stockValidator(10)).toBe(true);
      expect(stockValidator(10000)).toBe(true);

      // Invalid stock quantities
      expect(stockValidator(-1)).toBe(false); // negative
      expect(stockValidator(10001)).toBe(false); // too high
      expect(stockValidator(10.5)).toBe(false); // not integer
      expect(stockValidator('10')).toBe(false); // string
    });
  });

  describe('Product Filtering', () => {
    
    test('should filter products by category', () => {
      const products = [
        { id: 1, name: 'Laptop', category: 'Electronics' },
        { id: 2, name: 'T-Shirt', category: 'Clothing' },
        { id: 3, name: 'Headphones', category: 'Electronics' },
        { id: 4, name: 'Jeans', category: 'Clothing' }
      ];

      const filterByCategory = (products, category) => {
        return products.filter(product => product.category === category);
      };

      const electronics = filterByCategory(products, 'Electronics');
      expect(electronics).toHaveLength(2);
      expect(electronics[0].name).toBe('Laptop');
      expect(electronics[1].name).toBe('Headphones');

      const clothing = filterByCategory(products, 'Clothing');
      expect(clothing).toHaveLength(2);
      expect(clothing[0].name).toBe('T-Shirt');
      expect(clothing[1].name).toBe('Jeans');
    });

    test('should filter products by price range', () => {
      const products = [
        { id: 1, name: 'Cheap Item', price: 10.99 },
        { id: 2, name: 'Mid Item', price: 50.00 },
        { id: 3, name: 'Expensive Item', price: 200.00 },
        { id: 4, name: 'Very Expensive', price: 500.00 }
      ];

      const filterByPriceRange = (products, min, max) => {
        return products.filter(product => 
          product.price >= min && product.price <= max
        );
      };

      const midRange = filterByPriceRange(products, 25, 100);
      expect(midRange).toHaveLength(1);
      expect(midRange[0].name).toBe('Mid Item');

      const expensive = filterByPriceRange(products, 150, 600);
      expect(expensive).toHaveLength(2);
      expect(expensive[0].name).toBe('Expensive Item');
      expect(expensive[1].name).toBe('Very Expensive');
    });

    test('should filter products by availability (in stock)', () => {
      const products = [
        { id: 1, name: 'Available Item', stock: 5 },
        { id: 2, name: 'Out of Stock', stock: 0 },
        { id: 3, name: 'Low Stock', stock: 1 },
        { id: 4, name: 'In Stock', stock: 10 }
      ];

      const filterByAvailability = (products, inStock = true) => {
        return products.filter(product => 
          inStock ? product.stock > 0 : product.stock === 0
        );
      };

      const available = filterByAvailability(products, true);
      expect(available).toHaveLength(3);
      expect(available.map(p => p.name)).toEqual(['Available Item', 'Low Stock', 'In Stock']);

      const outOfStock = filterByAvailability(products, false);
      expect(outOfStock).toHaveLength(1);
      expect(outOfStock[0].name).toBe('Out of Stock');
    });
  });

  describe('Product Sorting', () => {
    
    test('should sort products by price (ascending)', () => {
      const products = [
        { id: 1, name: 'Expensive', price: 100.00 },
        { id: 2, name: 'Cheap', price: 25.00 },
        { id: 3, name: 'Mid', price: 50.00 }
      ];

      const sortByPriceAsc = (products) => {
        return [...products].sort((a, b) => a.price - b.price);
      };

      const sorted = sortByPriceAsc(products);
      expect(sorted[0].name).toBe('Cheap');
      expect(sorted[1].name).toBe('Mid');
      expect(sorted[2].name).toBe('Expensive');
    });

    test('should sort products by price (descending)', () => {
      const products = [
        { id: 1, name: 'Expensive', price: 100.00 },
        { id: 2, name: 'Cheap', price: 25.00 },
        { id: 3, name: 'Mid', price: 50.00 }
      ];

      const sortByPriceDesc = (products) => {
        return [...products].sort((a, b) => b.price - a.price);
      };

      const sorted = sortByPriceDesc(products);
      expect(sorted[0].name).toBe('Expensive');
      expect(sorted[1].name).toBe('Mid');
      expect(sorted[2].name).toBe('Cheap');
    });

    test('should sort products by name (alphabetical)', () => {
      const products = [
        { id: 1, name: 'Zebra' },
        { id: 2, name: 'Apple' },
        { id: 3, name: 'Banana' }
      ];

      const sortByName = (products) => {
        return [...products].sort((a, b) => a.name.localeCompare(b.name));
      };

      const sorted = sortByName(products);
      expect(sorted[0].name).toBe('Apple');
      expect(sorted[1].name).toBe('Banana');
      expect(sorted[2].name).toBe('Zebra');
    });

    test('should sort products by stock quantity (low to high)', () => {
      const products = [
        { id: 1, name: 'High Stock', stock: 50 },
        { id: 2, name: 'Low Stock', stock: 5 },
        { id: 3, name: 'Medium Stock', stock: 20 }
      ];

      const sortByStock = (products) => {
        return [...products].sort((a, b) => a.stock - b.stock);
      };

      const sorted = sortByStock(products);
      expect(sorted[0].name).toBe('Low Stock');
      expect(sorted[1].name).toBe('Medium Stock');
      expect(sorted[2].name).toBe('High Stock');
    });
  });

  describe('Product Search', () => {
    
    test('should search products by name (case insensitive)', () => {
      const products = [
        { id: 1, name: 'Laptop Computer' },
        { id: 2, name: 'Gaming Laptop' },
        { id: 3, name: 'Desktop Computer' },
        { id: 4, name: 'Laptop Bag' }
      ];

      const searchByName = (products, query) => {
        const searchTerm = query.toLowerCase();
        return products.filter(product => 
          product.name.toLowerCase().includes(searchTerm)
        );
      };

      const laptopResults = searchByName(products, 'laptop');
      expect(laptopResults).toHaveLength(3);
      expect(laptopResults.map(p => p.name)).toEqual(['Laptop Computer', 'Gaming Laptop', 'Laptop Bag']);

      const computerResults = searchByName(products, 'computer');
      expect(computerResults).toHaveLength(2);
      expect(computerResults.map(p => p.name)).toEqual(['Laptop Computer', 'Desktop Computer']);
    });

    test('should search products by partial name', () => {
      const products = [
        { id: 1, name: 'Wireless Mouse' },
        { id: 2, name: 'Wireless Keyboard' },
        { id: 3, name: 'Wired Mouse' },
        { id: 4, name: 'Bluetooth Speaker' }
      ];

      const searchByPartialName = (products, query) => {
        return products.filter(product => 
          product.name.toLowerCase().includes(query.toLowerCase())
        );
      };

      const wirelessResults = searchByPartialName(products, 'wireless');
      expect(wirelessResults).toHaveLength(2);
      expect(wirelessResults.map(p => p.name)).toEqual(['Wireless Mouse', 'Wireless Keyboard']);

      const mouseResults = searchByPartialName(products, 'mouse');
      expect(mouseResults).toHaveLength(2);
      expect(mouseResults.map(p => p.name)).toEqual(['Wireless Mouse', 'Wired Mouse']);
    });

    test('should search products by category', () => {
      const products = [
        { id: 1, name: 'Laptop', category: 'Electronics' },
        { id: 2, name: 'T-Shirt', category: 'Clothing' },
        { id: 3, name: 'Headphones', category: 'Electronics' },
        { id: 4, name: 'Jeans', category: 'Clothing' }
      ];

      const searchByCategory = (products, category) => {
        return products.filter(product => 
          product.category.toLowerCase().includes(category.toLowerCase())
        );
      };

      const electronicsResults = searchByCategory(products, 'electronics');
      expect(electronicsResults).toHaveLength(2);
      expect(electronicsResults.map(p => p.name)).toEqual(['Laptop', 'Headphones']);

      const clothingResults = searchByCategory(products, 'clothing');
      expect(clothingResults).toHaveLength(2);
      expect(clothingResults.map(p => p.name)).toEqual(['T-Shirt', 'Jeans']);
    });
  });

  describe('Product Pagination', () => {
    
    test('should paginate product list correctly', () => {
      const products = Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        name: `Product ${i + 1}`
      }));

      const paginate = (products, page, limit) => {
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        return {
          products: products.slice(startIndex, endIndex),
          total: products.length,
          page,
          totalPages: Math.ceil(products.length / limit)
        };
      };

      const page1 = paginate(products, 1, 10);
      expect(page1.products).toHaveLength(10);
      expect(page1.products[0].name).toBe('Product 1');
      expect(page1.products[9].name).toBe('Product 10');
      expect(page1.total).toBe(25);
      expect(page1.totalPages).toBe(3);

      const page2 = paginate(products, 2, 10);
      expect(page2.products).toHaveLength(10);
      expect(page2.products[0].name).toBe('Product 11');
      expect(page2.products[9].name).toBe('Product 20');

      const page3 = paginate(products, 3, 10);
      expect(page3.products).toHaveLength(5);
      expect(page3.products[0].name).toBe('Product 21');
      expect(page3.products[4].name).toBe('Product 25');
    });

    test('should handle edge cases in pagination', () => {
      const products = [
        { id: 1, name: 'Product 1' },
        { id: 2, name: 'Product 2' }
      ];

      const paginate = (products, page, limit) => {
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        return {
          products: products.slice(startIndex, endIndex),
          total: products.length,
          page,
          totalPages: Math.ceil(products.length / limit)
        };
      };

      // Page out of range
      const invalidPage = paginate(products, 5, 10);
      expect(invalidPage.products).toHaveLength(0);
      expect(invalidPage.page).toBe(5);
      expect(invalidPage.totalPages).toBe(1);

      // Zero limit
      const zeroLimit = paginate(products, 1, 0);
      expect(zeroLimit.products).toHaveLength(0);
    });
  });

  describe('Product Display Logic', () => {
    
    test('should format product price correctly', () => {
      const formatPrice = (price) => {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(price);
      };

      expect(formatPrice(99.99)).toBe('$99.99');
      expect(formatPrice(1000)).toBe('$1,000.00');
      expect(formatPrice(0.99)).toBe('$0.99');
      expect(formatPrice(1234.5)).toBe('$1,234.50');
    });

    test('should calculate discount price', () => {
      const calculateDiscountPrice = (originalPrice, discountPercent) => {
        const discountAmount = originalPrice * (discountPercent / 100);
        return Math.max(0, originalPrice - discountAmount);
      };

      expect(calculateDiscountPrice(100, 20)).toBe(80);
      expect(calculateDiscountPrice(50, 50)).toBe(25);
      expect(calculateDiscountPrice(200, 10)).toBe(180);
      expect(calculateDiscountPrice(100, 0)).toBe(100);
      expect(calculateDiscountPrice(100, 100)).toBe(0);
    });

    test('should determine if product is on sale', () => {
      const isOnSale = (product) => {
        return product.originalPrice && product.originalPrice > product.price;
      };

      expect(isOnSale({ price: 50, originalPrice: 100 })).toBe(true);
      expect(isOnSale({ price: 100, originalPrice: 100 })).toBe(false);
      expect(isOnSale({ price: 150 })).toBe(false);
    });

    test('should calculate savings amount', () => {
      const calculateSavings = (originalPrice, currentPrice) => {
        return Math.max(0, originalPrice - currentPrice);
      };

      expect(calculateSavings(100, 80)).toBe(20);
      expect(calculateSavings(50, 45)).toBe(5);
      expect(calculateSavings(100, 100)).toBe(0);
      expect(calculateSavings(80, 100)).toBe(0); // no savings
    });
  });
});