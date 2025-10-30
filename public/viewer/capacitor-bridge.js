/**
 * Capacitor Bridge for Native Features
 * Provides fallback to web APIs when running in browser
 */

// Check if running in native app
const isNative = window.Capacitor && window.Capacitor.isNativePlatform();

/**
 * Storage API - Uses Capacitor Preferences in native app, localStorage in browser
 */
export const Storage = {
    async get(key) {
        if (isNative && window.Capacitor.Plugins.Preferences) {
            const { value } = await window.Capacitor.Plugins.Preferences.get({ key });
            return value;
        }
        return localStorage.getItem(key);
    },

    async set(key, value) {
        if (isNative && window.Capacitor.Plugins.Preferences) {
            await window.Capacitor.Plugins.Preferences.set({ key, value });
        } else {
            localStorage.setItem(key, value);
        }
    },

    async remove(key) {
        if (isNative && window.Capacitor.Plugins.Preferences) {
            await window.Capacitor.Plugins.Preferences.remove({ key });
        } else {
            localStorage.removeItem(key);
        }
    }
};

/**
 * File System API - Uses Capacitor Filesystem in native app, web APIs in browser
 */
export const FileSystem = {
    async saveFile(filename, data) {
        if (isNative && window.Capacitor.Plugins.Filesystem) {
            const { Filesystem, Directory } = window.Capacitor.Plugins;

            try {
                await Filesystem.writeFile({
                    path: filename,
                    data: data,
                    directory: Directory.Documents,
                    encoding: 'utf8'
                });

                // Show native share dialog
                if (window.Capacitor.Plugins.Share) {
                    const { uri } = await Filesystem.getUri({
                        path: filename,
                        directory: Directory.Documents
                    });

                    await window.Capacitor.Plugins.Share.share({
                        title: 'Study Plans',
                        text: 'Export study plans',
                        url: uri,
                        dialogTitle: 'Save or Share Study Plans'
                    });
                }

                return true;
            } catch (error) {
                console.error('Error saving file:', error);
                throw error;
            }
        } else {
            // Browser fallback - download file
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            return true;
        }
    },

    async loadFile() {
        if (isNative && window.Capacitor.Plugins.Filesystem) {
            // For native, we'd need to implement a file picker
            // For now, just show an alert
            alert('File loading on mobile: Please use the share feature to import files');
            return null;
        } else {
            // Browser fallback - file input
            return new Promise((resolve, reject) => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';

                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) {
                        resolve(null);
                        return;
                    }

                    try {
                        const text = await file.text();
                        resolve(text);
                    } catch (error) {
                        reject(error);
                    }
                };

                input.click();
            });
        }
    }
};

/**
 * Haptics API - Provides tactile feedback on native devices
 */
export const Haptics = {
    async light() {
        if (isNative && window.Capacitor.Plugins.Haptics) {
            await window.Capacitor.Plugins.Haptics.impact({ style: 'light' });
        }
    },

    async medium() {
        if (isNative && window.Capacitor.Plugins.Haptics) {
            await window.Capacitor.Plugins.Haptics.impact({ style: 'medium' });
        }
    },

    async heavy() {
        if (isNative && window.Capacitor.Plugins.Haptics) {
            await window.Capacitor.Plugins.Haptics.impact({ style: 'heavy' });
        }
    }
};

// Make available globally
window.CapacitorBridge = {
    Storage,
    FileSystem,
    Haptics,
    isNative
};
