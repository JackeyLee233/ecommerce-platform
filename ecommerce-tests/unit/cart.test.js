/**
 * Unit Tests for Shopping Cart Functionality
 * 
 * Tests cart operations, validation, business rules, and calculations
 * for the e-commerce shopping cart system.
 */

const { 
  mockGenerators, 
  assertHelpers 
} = require('../test-config');

describe('Shopping Cart - Unit Tests', () => {
  
  describe('Cart Item Validation', () => {
    
    test('should validate product ID format', () => {
      const productIdValidator = (productId) => {
        return typeof productId === 'number' && productId > 0 && Number.isInteger(productId);
      };

      // Valid product IDs
      expect(productIdValidator(1)).toBe(true);
      expect(productIdValidator(12345)).toBe(true);
      expect(productIdValidator(999999)).toBe(true);

      // Invalid product IDs
      expect(productIdValidator(0)).toBe(false);
      expect(productIdValidator(-1)).toBe(false);
      expect(productIdValidator(1.5)).toBe(false);
      expect(productIdValidator('1')).toBe(false);
      expect(productIdValidator(null)).toBe(false);
      expect(productIdValidator(undefined)).toBe(false);
    });

    test('should validate quantity', () => {
      const quantityValidator = (quantity) => {
        return typeof quantity === 'number' && 
               Number.isInteger(quantity) && 
               quantity >= 1 && 
               quantity <= 99;
      };

      // Valid quantities
      expect(quantityValidator(1)).toBe(true);
      expect(quantityValidator(10)).toBe(true);
      expect(quantityValidator(99)).toBe(true);

      // Invalid quantities
      expect(quantityValidator(0)).toBe(false);
      expect(quantityValidator(-1)).toBe(false);
      expect(quantityValidator(100)).toBe(false);
      expect(quantityValidator(1.5)).toBe(false);
      expect(quantityValidator('5')).toBe(false);
    });

    test('should validate cart item structure', () => {
      const cartItemValidator = (item) => {
        return item && 
               typeof item.productId === 'number' && 
               item.productId > 0 &&
               typeof item.quantity === 'number' && 
               item.quantity >= 1 &&
               item.quantity <= 99 &&
               typeof item.price === 'number' && 
               item.price > 0;
      };

      // Valid cart item
      const validItem = {
        productId: 1,
        quantity: 2,
        price: 99.99
      };
      expect(cartItemValidator(validItem)).toBe(true);

      // Invalid cart items
      expect(cartItemValidator(null)).toBe(false);
      expect(cartItemValidator({})).toBe(false);
      expect(cartItemValidator({ productId: 0, quantity: 1, price: 10 })).toBe(false);
      expect(cartItemValidator({ productId: 1, quantity: 0, price: 10 })).toBe(false);
      expect(cartItemValidator({ productId: 1, quantity: 1, price: -10 })).toBe(false);
    });
  });

  describe('Cart Operations', () => {
    
    test('should add item to cart', () => {
      const cart = [];
      const product = { id: 1, name: 'Laptop', price: 999.99 };

      const addToCart = (cart, productId, quantity, price) => {
        const existingItem = cart.find(item => item.productId === productId);
        
        if (existingItem) {
          existingItem.quantity += quantity;
        } else {
          cart.push({
            productId,
            quantity,
            price
          });
        }
        
        return cart;
      };

      // Add new item
      addToCart(cart, product.id, 1, product.price);
      expect(cart).toHaveLength(1);
      expect(cart[0]).toEqual({
        productId: 1,
        quantity: 1,
        price: 999.99
      });

      // Add same item again (should increase quantity)
      addToCart(cart, product.id, 2, product.price);
      expect(cart).toHaveLength(1);
      expect(cart[0].quantity).toBe(3);
    });

    test('should remove item from cart', () => {
      const cart = [
        { productId: 1, quantity: 2, price: 99.99 },
        { productId: 2, quantity: 1, price: 199.99 }
      ];

      const removeFromCart = (cart, productId) => {
        const index = cart.findIndex(item => item.productId === productId);
        if (index > -1) {
          cart.splice(index, 1);
        }
        return cart;
      };

      // Remove existing item
      removeFromCart(cart, 1);
      expect(cart).toHaveLength(1);
      expect(cart[0].productId).toBe(2);

      // Remove non-existent item (should not change cart)
      removeFromCart(cart, 999);
      expect(cart).toHaveLength(1);
    });

    test('should update item quantity in cart', () => {
      const cart = [
        { productId: 1, quantity: 2, price: 99.99 },
        { productId: 2, quantity: 1, price: 199.99 }
      ];

      const updateQuantity = (cart, productId, newQuantity) => {
        const item = cart.find(item => item.productId === productId);
        if (item) {
          item.quantity = newQuantity;
        }
        return cart;
      };

      // Update existing item quantity
      updateQuantity(cart, 1, 5);
      expect(cart[0].quantity).toBe(5);

      // Update non-existent item (should not change cart)
      updateQuantity(cart, 999, 10);
      expect(cart).toHaveLength(2);
    });

    test('should clear cart', () => {
      const cart = [
        { productId: 1, quantity: 2, price: 99.99 },
        { productId: 2, quantity: 1, price: 199.99 }
      ];

      const clearCart = (cart) => {
        cart.length = 0;
        return cart;
      };

      clearCart(cart);
      expect(cart).toHaveLength(0);
    });
  });

  describe('Cart Calculations', () => {
    
    test('should calculate item total price', () => {
      const calculateItemTotal = (item) => {
        return item.price * item.quantity;
      };

      expect(calculateItemTotal({ price: 10.99, quantity: 2 })).toBe(21.98);
      expect(calculateItemTotal({ price: 25.50, quantity: 3 })).toBe(76.50);
      expect(calculateItemTotal({ price: 100, quantity: 1 })).toBe(100);
    });

    test('should calculate cart subtotal', () => {
      const cart = [
        { productId: 1, quantity: 2, price: 10.99 },
        { productId: 2, quantity: 1, price: 25.50 },
        { productId: 3, quantity: 3, price: 8.99 }
      ];

      const calculateSubtotal = (cart) => {
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
      };

      const subtotal = calculateSubtotal(cart);
      expect(subtotal).toBe(64.47); // (10.99 * 2) + (25.50 * 1) + (8.99 * 3)
    });

    test('should calculate cart total with tax', () => {
      const cart = [
        { productId: 1, quantity: 2, price: 10.99 },
        { productId: 2, quantity: 1, price: 25.50 }
      ];

      const calculateTotal = (cart, taxRate = 0.08) => {
        const subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
        const tax = subtotal * taxRate;
        return subtotal + tax;
      };

      expect(calculateTotal(cart, 0.08)).toBe(39.59); // (21.98 + 25.50) * 1.08
      expect(calculateTotal(cart, 0.10)).toBe(40.33); // (21.98 + 25.50) * 1.10
    });

    test('should calculate shipping cost', () => {
      const calculateShipping = (subtotal, shippingRate = 0.10, freeShippingThreshold = 100) => {
        if (subtotal >= freeShippingThreshold) {
          return 0;
        }
        return subtotal * shippingRate;
      };

      expect(calculateShipping(50)).toBe(5); // 50 * 0.10
      expect(calculateShipping(120)).toBe(0); // above free shipping threshold
      expect(calculateShipping(80, 0.15)).toBe(12); // 80 * 0.15
    });

    test('should calculate final order total', () => {
      const cart = [
        { productId: 1, quantity: 2, price: 10.99 },
        { productId: 2, quantity: 1, price: 25.50 }
      ];

      const calculateFinalTotal = (cart, taxRate = 0.08, shippingRate = 0.10, freeShippingThreshold = 100) => {
        const subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
        const tax = subtotal * taxRate;
        const shipping = subtotal >= freeShippingThreshold ? 0 : subtotal * shippingRate;
        return subtotal + tax + shipping;
      };

      expect(calculateFinalTotal(cart)).toBe(44.59); // 37.50 + 3.00 + 4.09
      expect(calculateFinalTotal(cart, 0.08, 0, 50)).toBe(40.50); // 37.50 + 3.00 + 0
    });
  });

  describe('Cart Validation Rules', () => {
    
    test('should validate stock availability', () => {
      const products = [
        { id: 1, stock: 10 },
        { id: 2, stock: 5 },
        { id: 3, stock: 0 }
      ];

      const checkStockAvailability = (cart, products) => {
        const stockMap = products.reduce((map, product) => {
          map[product.id] = product.stock;
          return map;
        }, {});

        return cart.map(item => ({
          ...item,
          available: item.quantity <= (stockMap[item.productId] || 0)
        }));
      };

      const cart = [
        { productId: 1, quantity: 5 },
        { productId: 2, quantity: 6 },
        { productId: 3, quantity: 1 }
      ];

      const validated = checkStockAvailability(cart, products);
      expect(validated[0].available).toBe(true); // 5 <= 10
      expect(validated[1].available).toBe(false); // 6 > 5
      expect(validated[2].available).toBe(false); // 1 > 0
    });

    test('should validate cart total against maximum order value', () => {
      const maxOrderValue = 5000;

      const validateCartTotal = (cart, maxValue) => {
        const subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
        return {
          isValid: subtotal <= maxValue,
          subtotal,
          maxValue
        };
      };

      const validCart = [{ productId: 1, quantity: 1, price: 100 }];
      const invalidCart = [{ productId: 1, quantity: 100, price: 100 }];

      expect(validateCartTotal(validCart, maxOrderValue).isValid).toBe(true);
      expect(validateCartTotal(invalidCart, maxOrderValue).isValid).toBe(false);
    });

    test('should validate number of unique items in cart', () => {
      const maxUniqueItems = 10;

      const validateUniqueItems = (cart, maxItems) => {
        return {
          isValid: cart.length <= maxItems,
          currentItems: cart.length,
          maxItems
        };
      };

      const smallCart = Array.from({ length: 5 }, (_, i) => ({
        productId: i + 1,
        quantity: 1,
        price: 10
      }));

      const largeCart = Array.from({ length: 15 }, (_, i) => ({
        productId: i + 1,
        quantity: 1,
        price: 10
      }));

      expect(validateUniqueItems(smallCart, maxUniqueItems).isValid).toBe(true);
      expect(validateUniqueItems(largeCart, maxUniqueItems).isValid).toBe(false);
    });
  });

  describe('Cart Persistence', () => {
    
    test('should serialize cart for storage', () => {
      const cart = [
        { productId: 1, quantity: 2, price: 10.99 },
        { productId: 2, quantity: 1, price: 25.50 }
      ];

      const serializeCart = (cart) => {
        return JSON.stringify(cart);
      };

      const serialized = serializeCart(cart);
      expect(serialized).toBe('[{"productId":1,"quantity":2,"price":10.99},{"productId":2,"quantity":1,"price":25.5}]');
    });

    test('should deserialize cart from storage', () => {
      const serializedCart = '[{"productId":1,"quantity":2,"price":10.99},{"productId":2,"quantity":1,"price":25.5}]';

      const deserializeCart = (serialized) => {
        try {
          return JSON.parse(serialized);
        } catch (error) {
          return [];
        }
      };

      const cart = deserializeCart(serializedCart);
      expect(cart).toHaveLength(2);
      expect(cart[0]).toEqual({ productId: 1, quantity: 2, price: 10.99 });
      expect(cart[1]).toEqual({ productId: 2, quantity: 1, price: 25.5 });
    });

    test('should handle corrupted cart data', () => {
      const corruptedData = 'invalid json data';

      const deserializeCart = (serialized) => {
        try {
          return JSON.parse(serialized);
        } catch (error) {
          return [];
        }
      };

      const cart = deserializeCart(corruptedData);
      expect(cart).toEqual([]);
    });
  });

  describe('Cart State Management', () => {
    
    test('should merge carts from different sessions', () => {
      const cart1 = [
        { productId: 1, quantity: 2, price: 10.99 },
        { productId: 2, quantity: 1, price: 25.50 }
      ];

      const cart2 = [
        { productId: 1, quantity: 1, price: 10.99 },
        { productId: 3, quantity: 3, price: 8.99 }
      ];

      const mergeCarts = (cart1, cart2) => {
        const merged = [...cart1];
        
        cart2.forEach(item2 => {
          const existingItem = merged.find(item1 => item1.productId === item2.productId);
          if (existingItem) {
            existingItem.quantity += item2.quantity;
          } else {
            merged.push(item2);
          }
        });
        
        return merged;
      };

      const merged = mergeCarts(cart1, cart2);
      expect(merged).toHaveLength(3);
      expect(merged.find(item => item.productId === 1).quantity).toBe(3); // 2 + 1
      expect(merged.find(item => item.productId === 2).quantity).toBe(1); // unchanged
      expect(merged.find(item => item.productId === 3).quantity).toBe(3); // new item
    });

    test('should split cart for multiple orders', () => {
      const cart = [
        { productId: 1, quantity: 5, price: 10.99 },
        { productId: 2, quantity: 3, price: 25.50 },
        { productId: 3, quantity: 2, price: 8.99 }
      ];

      const splitCart = (cart, itemsPerOrder = 2) => {
        const orders = [];
        let currentOrder = [];
        
        cart.forEach(item => {
          currentOrder.push(item);
          if (currentOrder.length >= itemsPerOrder) {
            orders.push([...currentOrder]);
            currentOrder = [];
          }
        });
        
        if (currentOrder.length > 0) {
          orders.push(currentOrder);
        }
        
        return orders;
      };

      const orders = splitCart(cart, 2);
      expect(orders).toHaveLength(2);
      expect(orders[0]).toHaveLength(2);
      expect(orders[1]).toHaveLength(1); // remaining items
    });
  });
});