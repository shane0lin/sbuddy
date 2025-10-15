import * as Keychain from 'react-native-keychain';

const SERVICE_NAME = 'com.sbuddy.app';

export async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    await Keychain.setGenericPassword(key, value, {
      service: `${SERVICE_NAME}.${key}`,
    });
  } catch (error) {
    console.error(`Failed to save ${key}:`, error);
    throw error;
  }
}

export async function getSecureItem(key: string): Promise<string | null> {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: `${SERVICE_NAME}.${key}`,
    });

    if (credentials) {
      return credentials.password;
    }
    return null;
  } catch (error) {
    console.error(`Failed to get ${key}:`, error);
    return null;
  }
}

export async function removeSecureItem(key: string): Promise<void> {
  try {
    await Keychain.resetGenericPassword({
      service: `${SERVICE_NAME}.${key}`,
    });
  } catch (error) {
    console.error(`Failed to remove ${key}:`, error);
  }
}
