const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const app = require('./src/server');

let mongoServer;

async function startServer() {
  try {
    // Start MongoDB Memory Server
    mongoServer = await MongoMemoryServer.create({
      instance: {
        port: 27017,
        dbName: 'ecommerce',
        storageEngine: 'ephemeralForTest',
      },
      binary: {
        version: '6.0.5',
        skipMD5: true,
      },
    });

    const mongoUri = mongoServer.getUri();
    console.log('MongoDB Memory Server started at:', mongoUri);

    // Connect to MongoDB
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB Memory Server');

    // Start Express server
    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
      console.log(`🚀 E-commerce API server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔗 API endpoints available at: http://localhost:${PORT}/api/`);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, shutting down gracefully...');
      server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close();
        if (mongoServer) {
          mongoServer.stop();
        }
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log('Received SIGINT, shutting down gracefully...');
      server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close();
        if (mongoServer) {
          mongoServer.stop();
        }
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();