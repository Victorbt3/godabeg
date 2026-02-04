# Deploy to Render - Quick Guide

## Prerequisites

1. Create a Render account at https://render.com

## Steps to Deploy:

### 1. Install Git (if not installed)

Download from: https://git-scm.com/download/win

### 2. Initialize Git Repository

```powershell
git init
git add .
git commit -m "Initial commit for Render deployment"
```

### 3. Create GitHub Repository

- Go to https://github.com/new
- Create a new repository named "godabeg"
- Don't initialize with README

### 4. Push to GitHub

```powershell
git remote add origin https://github.com/YOUR_USERNAME/godabeg.git
git branch -M main
git push -u origin main
```

### 5. Deploy on Render

#### Option A: Using render.yaml (Blueprint)

1. Go to https://dashboard.render.com
2. Click "New +"
3. Select "Blueprint"
4. Connect your GitHub repository
5. Click "Apply"
6. Render will automatically create the web service and PostgreSQL database

#### Option B: Manual Setup

1. Go to https://dashboard.render.com
2. Click "New +" → "PostgreSQL"
   - Name: godabeg-db
   - Database: godabeg
   - User: godabeg_user
   - Click "Create Database"
   - Copy the "Internal Database URL"

3. Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Name: godabeg
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Add Environment Variables:
     - NODE_ENV = production
     - DATABASE_URL = [paste the internal database URL]
     - PY_SERVICE_URL = http://localhost:8000 (or your Python service URL)
   - Click "Create Web Service"

### 6. Access Your App

After deployment completes, your app will be available at:
`https://godabeg-XXXX.onrender.com`

## Notes:

- Free tier spins down after 15 mins of inactivity
- First request after inactivity may take 30-60 seconds
- Database persists even when web service spins down
- Automatic deploys happen on git push to main branch
