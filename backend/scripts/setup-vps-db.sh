#!/bin/bash

# VPS Database Setup Script
# Usage: ./scripts/setup-vps-db.sh [DATABASE_URL]

set -e  # Exit on error

echo "🚀 Setting up Aegira database on VPS..."

# Check if DATABASE_URL is provided as argument
if [ -n "$1" ]; then
    export DATABASE_URL="$1"
    export DIRECT_URL="$1"
    echo "✅ Using provided DATABASE_URL"
else
    echo "⚠️  No DATABASE_URL provided. Using .env file..."
    echo "💡 Tip: Use './scripts/setup-vps-db.sh postgresql://user:pass@host:5432/dbname' to specify database"
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Please create one or provide DATABASE_URL parameter"
    exit 1
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Generate Prisma Client
echo ""
echo "🔧 Generating Prisma Client..."
npm run db:generate

# Push schema to database
echo ""
echo "📤 Pushing schema to database..."
npm run db:push

# Seed database (optional)
echo ""
read -p "Do you want to seed the database? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🌱 Seeding database..."
    npm run seed
fi

echo ""
echo "✅ Database setup complete!"
echo "💡 You can now start your server with: npm run start"




