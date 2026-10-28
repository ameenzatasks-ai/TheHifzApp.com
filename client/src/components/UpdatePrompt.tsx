import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useRegisterSW } from 'virtual:pwa-register/react';

// An open app looks for a new build this often, on top of the check it makes
// each time it starts.
const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * Tells the user when a newer build is waiting and applies it when they tap
 * Update. Applying an update swaps the app's code and reloads the page. Nothing
 * stored on the device or on the server is cleared.
 */
export default function UpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) setInterval(() => registration.update(), UPDATE_CHECK_MS);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    toast(
      (t) => (
        <div className="flex items-center gap-3">
          <span>This app needs an update.</span>
          <button
            type="button"
            onClick={() => toast.dismiss(t.id)}
            className="text-sm font-medium"
            style={{ color: 'var(--c-text-muted)' }}
          >
            Later
          </button>
          <button
            type="button"
            onClick={() => updateServiceWorker(true)}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
            style={{ backgroundColor: '#0F4C3A' }}
          >
            Update
          </button>
        </div>
      ),
      { id: 'app-update', duration: Infinity },
    );
  }, [needRefresh, updateServiceWorker]);

  return null;
}
