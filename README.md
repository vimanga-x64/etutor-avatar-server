# E-Tutor Avatar Cloud Server

A lightweight Node.js server that hosts the 3D avatar for mobile computational offloading.

## 🚀 Quick Deploy to Render.com (FREE)

### Step 1: Push to GitHub

```bash
cd avatar-server
git init
git add .
git commit -m "Initial avatar server"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/etutor-avatar-server.git
git push -u origin main
```

### Step 2: Deploy to Render

1. Go to [render.com](https://render.com) and sign up (FREE, no credit card)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repo: `etutor-avatar-server`
4. Configure:
   - **Name:** `etutor-avatar`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** `Free`
5. Click **"Create Web Service"**

### Step 3: Get Your URL

After deployment (2-3 minutes), you'll get a URL like:
```
https://etutor-avatar.onrender.com
```

### Step 4: Update Flutter App


