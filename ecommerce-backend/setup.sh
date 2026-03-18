#!/bin/bash

# Development setup script for E-commerce Backend

echo "🚀 Setting up E-commerce Backend Development Environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'.' -f1 | cut -d'v' -f2)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

# Check if MongoDB is installed
if ! command -v mongod &> /dev/null; then
    echo "⚠️  MongoDB is not installed. Please install MongoDB."
    echo "   You can use Docker for easy setup: docker run -d -p 27017:27017 --name mongodb mongo:6.0"
    echo "   Or install MongoDB locally: https://www.mongodb.com/try/download/community"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "🔧 Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created. Please update it with your configuration."
fi

# Create uploads directory
mkdir -p uploads

# Start MongoDB in background if not running
if ! pgrep -x "mongod" > /dev/null; then
    echo "🗄️  Starting MongoDB..."
    mongod --fork --logpath /tmp/mongodb.log --dbpath /tmp/mongodb_data
    echo "✅ MongoDB started in background"
fi

# Run database migrations (if any)
echo "🔄 Running database migrations..."
# Add migration commands here if needed

echo "🎉 Development environment setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update .env file with your configuration"
echo "2. Start the development server: npm run dev"
echo "3. Run tests: npm test"
echo "4. Access the API at: http://localhost:3000"
echo ""
echo "📚 Available scripts:"
echo "  npm run dev    - Start development server"
echo "  npm start      - Start production server"
echo "  npm test       - Run tests"
echo "  npm run test:watch - Run tests in watch mode"