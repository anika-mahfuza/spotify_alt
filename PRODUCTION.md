# Production Build Guide

## Environment Setup

### Frontend (.env)
```bash
VITE_API_URL=http://localhost:11700
VITE_FRONTEND_URL=http://localhost:5173
```

### Backend (.env)
```bash
SPOTIPY_CLIENT_ID=your_spotify_client_id
SPOTIPY_CLIENT_SECRET=your_spotify_client_secret
SPOTIPY_REDIRECT_URI=http://localhost:11700/callback
FRONTEND_URL=http://localhost:5173
```

## Build & Run

### Development
```bash
# Frontend
npm install
npm run dev

# Backend
cd backend
pip install -r requirements.txt
python main.py
```

### Production Build
```bash
# Frontend
npm run build
npm run preview

# Backend
cd backend
python main.py
```

## Fixed Issues

### 1. ✅ Audio Overlap Prevention
- Added proper audio cleanup on track change
- Prevents multiple songs playing simultaneously
- Uses ref to track current song and prevent re-loading

### 2. ✅ Performance Optimization
- Removed console logs in production build
- Added terser minification
- Optimized bundle size
- Added loading states everywhere

### 3. ✅ Queue Management
- Proper queue implementation
- Next/Previous buttons now work
- Tracks entire playlist as queue

### 4. ✅ Error Handling
- Added try-catch blocks everywhere
- User-friendly error messages
- Graceful fallbacks

### 5. ✅ Token Security
- Moved from localStorage to sessionStorage
- Token cleared from URL after auth
- No exposed credentials

### 6. ✅ Environment Configuration
- No hardcoded URLs
- Proper env variable usage
- Production-ready config

### 7. ✅ Backend Completion
- Fixed incomplete `/search-and-play` endpoint
- Added proper error handling
- Optimized stream extraction

### 8. ✅ UI Responsiveness
- Added loading indicators
- Disabled buttons during loading
- Better user feedback

## Production Checklist

- [x] No hardcoded URLs
- [x] Environment variables configured
- [x] Audio cleanup implemented
- [x] Queue management working
- [x] Error handling comprehensive
- [x] Loading states added
- [x] Console logs removed in production
- [x] Minification enabled
- [x] Token security improved
- [x] Backend endpoints complete

## Deploy

For production deployment:

1. Update `.env` files with production URLs
2. Build frontend: `npm run build`
3. Serve `dist` folder with nginx/apache
4. Run backend with gunicorn: `gunicorn -w 4 -k uvicorn.workers.UvicornWorker backend.main:app`
