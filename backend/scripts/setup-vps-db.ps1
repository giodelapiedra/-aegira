# VPS Database Setup Script (PowerShell)
# Usage: .\scripts\setup-vps-db.ps1

param(
    [string]$DatabaseUrl = "",
    [switch]$Seed = $false
)

Write-Host "🚀 Setting up Aegira database on VPS..." -ForegroundColor Green

# Check if DATABASE_URL is provided
if ([string]::IsNullOrEmpty($DatabaseUrl)) {
    Write-Host "⚠️  No DATABASE_URL provided. Using .env file..." -ForegroundColor Yellow
    Write-Host "💡 Tip: Use -DatabaseUrl 'postgresql://user:pass@host:5432/dbname' to specify database" -ForegroundColor Cyan
} else {
    $env:DATABASE_URL = $DatabaseUrl
    $env:DIRECT_URL = $DatabaseUrl
    Write-Host "✅ Using provided DATABASE_URL" -ForegroundColor Green
}

# Check if .env file exists
if (Test-Path ".env") {
    Write-Host "📄 Found .env file" -ForegroundColor Green
} else {
    Write-Host "⚠️  No .env file found. Please create one or provide DATABASE_URL parameter" -ForegroundColor Yellow
    exit 1
}

# Install dependencies
Write-Host "`n📦 Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Generate Prisma Client
Write-Host "`n🔧 Generating Prisma Client..." -ForegroundColor Yellow
npm run db:generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to generate Prisma Client" -ForegroundColor Red
    exit 1
}

# Push schema to database
Write-Host "`n📤 Pushing schema to database..." -ForegroundColor Yellow
npm run db:push
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to push schema to database" -ForegroundColor Red
    Write-Host "💡 Check your DATABASE_URL and database connection" -ForegroundColor Cyan
    exit 1
}

# Seed database (optional)
if ($Seed) {
    Write-Host "`n🌱 Seeding database..." -ForegroundColor Yellow
    npm run seed
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Seeding failed, but schema is updated" -ForegroundColor Yellow
    }
} else {
    $seedChoice = Read-Host "`nDo you want to seed the database? (y/n)"
    if ($seedChoice -eq "y" -or $seedChoice -eq "Y") {
        Write-Host "🌱 Seeding database..." -ForegroundColor Yellow
        npm run seed
    }
}

Write-Host "`n✅ Database setup complete!" -ForegroundColor Green
Write-Host "💡 You can now start your server with: npm run start" -ForegroundColor Cyan













