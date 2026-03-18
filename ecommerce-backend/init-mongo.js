db.createUser({
  user: 'ecommerce_user',
  pwd: 'ecommerce_password',
  roles: [
    {
      role: 'readWrite',
      db: 'ecommerce'
    }
  ]
});

db.createCollection('users');
db.createCollection('products');
db.createCollection('orders');
db.createCollection('payments');
db.createCollection('categories');

print('Database initialized successfully');