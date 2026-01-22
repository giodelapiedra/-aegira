# Aegira Backend VPS Deployment Guide

> **VPS Provider:** Hostinger
> **OS:** Ubuntu 24.04 LTS
> **CDN/DNS:** Cloudflare
> **Stack:** Node.js + Hono + Prisma + PM2 + Nginx

---

## Pre-Deployment Checklist

### Things to Prepare BEFORE Starting

| Item | Where to Get | Status |
|------|--------------|--------|
| VPS IP Address | Hostinger Panel → VPS → Overview | [ ] |
| VPS Root Password | Hostinger Panel → VPS → Overview | [ ] |
| Domain on Cloudflare | Cloudflare Dashboard | [ ] |
| Supabase DATABASE_URL | Supabase → Settings → Database | [ ] |
| Supabase ANON_KEY | Supabase → Settings → API | [ ] |
| Supabase SERVICE_ROLE_KEY | Supabase → Settings → API | [ ] |
| R2 Credentials | Cloudflare → R2 → Manage API Tokens | [ ] |
| OpenAI API Key | platform.openai.com | [ ] |
| JWT_SECRET (32+ chars) | Generate random string | [ ] |

### Generate JWT_SECRET

Run this in PowerShell to generate:
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

Or use: https://generate-secret.vercel.app/32

---

## Part 1: Windows PC Setup

### Step 1.1: Check/Install SSH

Open **PowerShell** and run:

```powershell
ssh
```

- If shows usage info → OK, proceed
- If error "not recognized" → Install Git (next step)

### Step 1.2: Install Git (Recommended)

Download: https://git-scm.com/download/win

During install, select:
- [x] Use Git from Windows Command Prompt
- [x] Use bundled OpenSSH

Restart PowerShell after install.

### Step 1.3: Verify

```powershell
ssh -V
git --version
```

Both should show version numbers.

---

## Part 2: Cloudflare DNS Setup

> Do this BEFORE or WHILE setting up VPS

### Step 2.1: Add DNS Record

1. Login to **Cloudflare Dashboard**
2. Select your domain
3. Go to **DNS** → **Records**
4. Click **Add Record**

| Field | Value |
|-------|-------|
| Type | A |
| Name | `api` |
| IPv4 address | `<your-vps-ip>` |
| Proxy status | **Proxied** (orange cloud ON) |
| TTL | Auto |

This creates: `api.yourdomain.com` → Your VPS

### Step 2.2: SSL/TLS Settings

1. Go to **SSL/TLS** → **Overview**
2. Set encryption mode to: **Full (strict)**

### Step 2.3: Recommended Security Settings

**Security → Settings:**
- Security Level: **Medium**

**Security → Bots:**
- Bot Fight Mode: **On**

**Network:**
- WebSockets: **On**

---

## Part 3: Connect to VPS

### Step 3.1: SSH into VPS

Open **PowerShell** or **Git Bash**:

```bash
ssh root@<your-vps-ip>
```

Example:
```bash
ssh root@123.456.78.90
```

- Type `yes` when asked about fingerprint
- Enter your root password

### Step 3.2: Update System

```bash
apt update && apt upgrade -y
```

---

## Part 4: Install Server Dependencies

Run these commands one by one:

### Step 4.1: Install Essentials

```bash
apt install -y curl git build-essential
```

### Step 4.2: Install Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

### Step 4.3: Install PM2

```bash
npm install -g pm2
```

### Step 4.4: Verify Installations

```bash
node -v
npm -v
pm2 -v
```

Expected output (versions may vary):
```
v20.x.x
10.x.x
5.x.x
```

---

## Part 5: Create Application User

> Security best practice: Don't run app as root

```bash
# Create user
adduser aegira

# Add to sudo group
usermod -aG sudo aegira

# Switch to new user
su - aegira
```

---

## Part 6: Upload Backend Code

### Option A: Git Clone

```bash
cd ~
git clone https://github.com/your-username/aegira.git
cd aegira/backend
```

### Option B: SCP Upload from Windows

On your **Windows PowerShell** (not VPS):

```powershell
scp -r D:\Aegira\backend root@<your-vps-ip>:/home/aegira/
```

Then back on VPS:

```bash
su - aegira
cd ~/backend
```

### Option C: Manual Upload via SFTP

Use FileZilla or WinSCP:
- Host: `<your-vps-ip>`
- Username: `root`
- Password: your password
- Port: `22`

Upload `backend` folder to `/home/aegira/`

---

## Part 7: Setup Environment Variables

```bash
cd ~/backend
nano .env
```

Paste this template (replace with your actual values):

```env
# Server
PORT=3000
NODE_ENV=production

# Database (Supabase PostgreSQL)
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxx.supabase.co:5432/postgres

# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJhxxxxxxxxxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJhxxxxxxxxxxxxxxxx

# JWT (use generated 32+ char string)
JWT_SECRET=your_generated_secret_here

# Cloudflare R2 Storage
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=aegira
R2_PUBLIC_URL=https://pub-xxxx.r2.dev

# OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxx
```

Save: `Ctrl+O` → `Enter` → `Ctrl+X`

---

## Part 8: Build Application

```bash
cd ~/backend

# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Build TypeScript
npm run build

# Test (should show "Server is running on http://localhost:3000")
npm start

# Press Ctrl+C to stop test
```

---

## Part 9: Setup PM2 Process Manager

```bash
# Start application
pm2 start dist/server.js --name aegira-api

# Setup auto-start on reboot
pm2 startup systemd
```

**Important:** Copy and run the command that PM2 outputs!

```bash
# Save process list
pm2 save

# Check status
pm2 status
```

You should see:
```
┌─────┬──────────────┬─────────────┬─────────┬─────────┬──────────┐
│ id  │ name         │ status      │ cpu     │ memory  │
├─────┼──────────────┼─────────────┼─────────┼─────────┼──────────┤
│ 0   │ aegira-api   │ online      │ 0%      │ 50mb    │
└─────┴──────────────┴─────────────┴─────────┴─────────┴──────────┘
```

---

## Part 10: Install & Configure Nginx

### Step 10.1: Install Nginx

```bash
sudo apt install -y nginx
```

### Step 10.2: Create Site Configuration

```bash
sudo nano /etc/nginx/sites-available/aegira
```

Paste (replace `api.yourdomain.com` with your actual domain):

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    # Cloudflare Real IP (important for logging & rate limiting)
    set_real_ip_from 103.21.244.0/22;
    set_real_ip_from 103.22.200.0/22;
    set_real_ip_from 103.31.4.0/22;
    set_real_ip_from 104.16.0.0/13;
    set_real_ip_from 104.24.0.0/14;
    set_real_ip_from 108.162.192.0/18;
    set_real_ip_from 131.0.72.0/22;
    set_real_ip_from 141.101.64.0/18;
    set_real_ip_from 162.158.0.0/15;
    set_real_ip_from 172.64.0.0/13;
    set_real_ip_from 173.245.48.0/20;
    set_real_ip_from 188.114.96.0/20;
    set_real_ip_from 190.93.240.0/20;
    set_real_ip_from 197.234.240.0/22;
    set_real_ip_from 198.41.128.0/17;
    real_ip_header CF-Connecting-IP;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

Save: `Ctrl+O` → `Enter` → `Ctrl+X`

### Step 10.3: Enable Site

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/aegira /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## Part 11: Install SSL Certificate (Certbot)

> Required for Cloudflare "Full (strict)" mode

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Temporarily disable Cloudflare proxy (gray cloud)
# Go to Cloudflare DNS → Click orange cloud to make it gray

# Get certificate
sudo certbot --nginx -d api.yourdomain.com

# Follow prompts:
# - Enter email
# - Agree to terms (Y)
# - Share email (optional, N)
# - Redirect HTTP to HTTPS (2)

# Re-enable Cloudflare proxy (orange cloud)
# Go to Cloudflare DNS → Click gray cloud to make it orange

# Test auto-renewal
sudo certbot renew --dry-run
```

---

## Part 12: Configure Firewall

```bash
# Allow SSH
sudo ufw allow OpenSSH

# Allow Nginx
sudo ufw allow 'Nginx Full'

# Enable firewall
sudo ufw enable

# Type 'y' to confirm

# Check status
sudo ufw status
```

Expected output:
```
Status: active

To                         Action      From
--                         ------      ----
OpenSSH                    ALLOW       Anywhere
Nginx Full                 ALLOW       Anywhere
OpenSSH (v6)               ALLOW       Anywhere (v6)
Nginx Full (v6)            ALLOW       Anywhere (v6)
```

---

## Part 13: Test Your API

### From VPS:

```bash
curl http://localhost:3000
```

### From your Windows PC:

```powershell
curl https://api.yourdomain.com
```

### From browser:

Open: `https://api.yourdomain.com`

---

## Part 14: Create Deployment Script

For easy future deployments:

```bash
nano ~/deploy.sh
```

Paste:

```bash
#!/bin/bash
set -e

echo "========================================="
echo "  Aegira Backend Deployment Script"
echo "========================================="

cd ~/backend

echo "[1/5] Pulling latest code..."
git pull origin main

echo "[2/5] Installing dependencies..."
npm install

echo "[3/5] Generating Prisma client..."
npm run db:generate

echo "[4/5] Building application..."
npm run build

echo "[5/5] Restarting PM2..."
pm2 restart aegira-api

echo "========================================="
echo "  Deployment Complete!"
echo "========================================="
pm2 status
```

Make executable:

```bash
chmod +x ~/deploy.sh
```

Usage:
```bash
~/deploy.sh
```

---

## Troubleshooting

### Check Application Logs

```bash
pm2 logs aegira-api --lines 100
```

### Check Nginx Logs

```bash
# Error logs
sudo tail -f /var/log/nginx/error.log

# Access logs
sudo tail -f /var/log/nginx/access.log
```

### Check if Port 3000 is Running

```bash
sudo lsof -i :3000
```

### Restart Everything

```bash
pm2 restart aegira-api
sudo systemctl restart nginx
```

### Check Disk Space

```bash
df -h
```

### Check Memory

```bash
free -m
```

### Common Errors

| Error | Solution |
|-------|----------|
| `502 Bad Gateway` | Check if PM2 is running: `pm2 status` |
| `Connection refused` | Check firewall: `sudo ufw status` |
| `SSL handshake failed` | Check Cloudflare SSL mode is "Full (strict)" |
| `ECONNREFUSED` on DB | Check DATABASE_URL in .env |

---

## Quick Reference Commands

| Task | Command |
|------|---------|
| SSH to VPS | `ssh aegira@<your-vps-ip>` |
| View logs | `pm2 logs aegira-api` |
| Restart app | `pm2 restart aegira-api` |
| Stop app | `pm2 stop aegira-api` |
| Restart Nginx | `sudo systemctl restart nginx` |
| Check status | `pm2 status` |
| Deploy updates | `~/deploy.sh` |
| Check SSL expiry | `sudo certbot certificates` |
| Renew SSL | `sudo certbot renew` |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         USER                                │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      CLOUDFLARE                             │
│  • SSL/TLS Termination                                      │
│  • DDoS Protection                                          │
│  • Caching                                                  │
│  • Bot Protection                                           │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS (Full Strict)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    HOSTINGER VPS                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                      NGINX                              │ │
│  │  • Reverse Proxy                                        │ │
│  │  • SSL (Certbot)                                        │ │
│  │  • Real IP from Cloudflare                              │ │
│  └─────────────────────────┬──────────────────────────────┘ │
│                            │ HTTP :3000                     │
│                            ▼                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    PM2 + Node.js                        │ │
│  │  • Aegira Backend (Hono)                                │ │
│  │  • Auto-restart                                         │ │
│  │  • Process monitoring                                   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │ Supabase │   │    R2    │   │  OpenAI  │
    │ Postgres │   │ Storage  │   │   API    │
    └──────────┘   └──────────┘   └──────────┘
```

---

## Security Checklist

- [ ] Non-root user created (aegira)
- [ ] UFW firewall enabled
- [ ] SSL certificate installed (Certbot)
- [ ] Cloudflare proxy enabled (orange cloud)
- [ ] Cloudflare SSL mode: Full (strict)
- [ ] Strong JWT_SECRET (32+ chars)
- [ ] NODE_ENV=production
- [ ] No sensitive data in git repo
- [ ] .env file not in git

---

## Next Steps After Deployment

1. [ ] Test all API endpoints
2. [ ] Setup Cloudflare Page Rules (optional)
3. [ ] Setup monitoring (UptimeRobot, etc.)
4. [ ] Configure Supabase backups
5. [ ] Deploy frontend (Vercel/Netlify/same VPS)
