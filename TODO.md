# Data Vault - Make Files Visible to All Users

## Steps

### Step 1: Backend - Modify GET /api/files to always return files
- [x] Remove `getFileOwner` blocking call from GET /api/files
- [x] Always return all files regardless of auth status
- [x] Only resolve owner identity for `canDelete` flag (non-blocking)

### Step 2: Frontend - Decouple file loading from auth
- [x] Load files immediately on mount without waiting for auth
- [x] Show files even when no user is logged in
- [x] Add inline "Sign in to upload" prompt for unauthenticated users

### Step 3: Frontend - Improve UI for visibility
- [x] Update description text to emphasize all users see all files
- [x] Add upload prompt section for non-authenticated users
- [x] Ensure download works for all visitors regardless of auth status
- [x] Added "Sign in / Register" button for unauthenticated users to navigate to auth

### Step 4: Test
- [x] Verify backend starts without errors — ✅ Started on port 5000
- [x] Verify frontend compiles without errors — ✅ Build succeeded
- [x] Test file listing without authentication — ✅ Files load immediately without auth via separate useEffect

