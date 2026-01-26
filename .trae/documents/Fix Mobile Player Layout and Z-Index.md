I will fix the Android/Mobile UI layout issues and address the 521 error report.

**1. Fix 521 Error (Backend Connection)**

* **Observation**: The error `521 Web Server Is Down` indicates that the backend server (`spotify-backend-proxy.nargisazgar.workers.dev`) is offline or refusing connections from the Cloudflare Worker.

* **Action**: This is a server-side issue. I cannot "fix" it via code changes in the frontend repository unless the backend URL has changed. I recommend checking if the backend server (hosting the Python app) is running. For now, I will proceed with the UI fixes assuming the backend will come back online.

**2. Fix Mobile Player Layout (Android/iOS)**

* **Problem**: The player controls are mispositioned, and track info is missing on mobile. The Player is also covering the Sidebar menu because of incorrect Z-index stacking.

* **Solution**: Implement a dedicated "Mini Player" layout for mobile.

**Changes to** **`src/components/Player.tsx`**:

* **Layout**: Switch to a standard mobile "Mini Player" design:

  * **Height**: Reduced to `h-16` (64px) for mobile.

  * **Progress Bar**: Move to the **very bottom** of the player as a thin (2px) line, visible on mobile.

  * **Track Info**: Ensure it takes available space (`flex-1`) on the left with the thumbnail.

  * **Controls**: Simplify to just **Play/Pause** (and optionally Next) on the right side.

* **Z-Index Fix**:

  * The Sidebar is currently `z-50`, but the Player is `z-[100]`. This causes the Player to appear *on top* of the Sidebar menu.

  * I will increase the Sidebar's Z-index to `z-[200]` to ensure the menu opens *over* the player.

**Changes to** **`src/components/Sidebar.tsx`**:

* Update Z-index to `z-[200]` (container) and `z-[190]` (backdrop).

**Verification**:

* I will verify the Z-index stacking order.

* I will verify the Tailwind classes for the new mobile layout.

