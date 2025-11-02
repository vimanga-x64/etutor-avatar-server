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

In `lib/tutor_screen.dart`, set:
```dart
static const String? cloudRenderingServer = 'https://etutor-avatar.onrender.com';
```

## 🧪 Local Testing

```bash
cd avatar-server
npm install
npm start
```

Visit: http://localhost:3000/avatar

## 📡 API Endpoints

- `GET /` - API documentation
- `GET /health` - Health check
- `GET /avatar` - Avatar viewer page
- `POST /avatar/speak` - Make avatar speak
- `POST /avatar/expression` - Change expression
- `GET /avatar/status` - Avatar status

## 🔧 Configuration

Environment variables (set in Render dashboard):
- `PORT` - Server port (auto-set by Render)
- `NODE_ENV` - Set to `production`

## 📦 What's Deployed

- ✅ Express.js server (60KB)
- ✅ Three.js avatar viewer (640KB)
- ✅ Avatar model (served on demand)
- ✅ CORS enabled for mobile app
- ✅ Compression enabled
- ✅ Health checks configured

## 🎓 Student Benefits

**Render.com Free Tier:**
- 750 hours/month
- Automatic HTTPS
- Auto-deploy from GitHub
- No credit card required
- Perfect for thesis demos

**Limitations:**
- Server spins down after 15 min inactivity
- Cold start: ~30 seconds
- 512MB RAM

**Tip:** Keep server warm during thesis presentation by pinging `/health` every 10 minutes.

## 🐛 Troubleshooting

### Server won't start
- Check logs in Render dashboard
- Verify `package.json` is correct
- Ensure Node.js version ≥18

### Avatar doesn't load
- Check browser console for errors
- Verify CORS headers
- Test URL directly: `https://your-url.onrender.com/avatar`

### Mobile app can't connect
- Verify URL in `tutor_screen.dart`
- Check server is running: visit `/health`
- Ensure HTTPS (Render provides this automatically)

## 📝 Alternative: GitHub Student Pack

Get FREE upgrades:
1. Visit: https://education.github.com/pack
2. Verify student status
3. Get $200 DigitalOcean credit
4. Deploy a more powerful server

## 🔒 Security Notes

For production/thesis:
- Add API key authentication
- Rate limiting
- Request validation
- See `SECURITY.md` for full guide

## 📚 Next Steps

1. ✅ Deploy to Render
2. ✅ Update Flutter app with URL
3. ✅ Test on mobile device
4. ✅ Add to thesis documentation
5. ✅ Prepare demo for defense

## 🤝 Support

For questions:
- GitHub Issues
- Email: your-email@example.com
- Thesis Advisor: advisor@university.edu

---

**Good luck with your thesis! 🎓**
