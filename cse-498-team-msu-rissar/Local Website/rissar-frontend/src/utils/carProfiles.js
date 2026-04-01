/**
 * carProfiles
 * 
 * Car profile management for storing connection details locally
 * Manages profiles with IP, port, username, and password
 * 
 */

const STORAGE_KEY = 'rissar_car_profiles';
const CURRENT_PROFILE_KEY = 'rissar_current_profile';

/**
 * Create a new car profile with connection details
 * Returns an object with id, name, ip, port, username, and password
 */
export const createProfile = (name, ip, port = 9090, username = '', password = '') => {
  return {
    id: Date.now().toString(),
    name,
    ip,
    port,
    username,
    password,
    createdAt: new Date().toISOString(),
  };
};

/**
 * Save all car profiles to localStorage
 */
export const saveProfiles = (profiles) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    return true;
  } catch (error) {
    console.warn('Failed to save car profiles:', error);
    return false;
  }
};

/**
 * Load all car profiles from localStorage
 */
export const loadProfiles = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.warn('Failed to load car profiles:', error);
    return [];
  }
};

/**
 * Add a new profile to the list
 */
export const addProfile = (name, ip, port = 9090, username = '', password = '') => {
  const profiles = loadProfiles();
  const newProfile = createProfile(name, ip, port, username, password);
  profiles.push(newProfile);
  saveProfiles(profiles);
  return newProfile;
};

/**
 * Update an existing profile by id
 */
export const updateProfile = (id, updates) => {
  const profiles = loadProfiles();
  const index = profiles.findIndex(p => p.id === id);
  if (index !== -1) {
    profiles[index] = { ...profiles[index], ...updates, id };
    saveProfiles(profiles);
    return profiles[index];
  }
  return null;
};

/**
 * Delete a profile by id
 */
export const deleteProfile = (id) => {
  const profiles = loadProfiles();
  const filtered = profiles.filter(p => p.id !== id);
  saveProfiles(filtered);

  // Clear current profile if we deleted it
  const currentId = loadCurrentProfileId();
  if (currentId === id) {
    clearCurrentProfile();
  }

  return filtered;
};

/**
 * Get a profile by id
 */
export const getProfile = (id) => {
  const profiles = loadProfiles();
  return profiles.find(p => p.id === id) || null;
};

/**
 * Set the current profile to use for connection
 */
export const setCurrentProfile = (id) => {
  try {
    localStorage.setItem(CURRENT_PROFILE_KEY, id);
    return true;
  } catch (error) {
    console.warn('Failed to set current profile:', error);
    return false;
  }
};

/**
 * Get the current profile id
 */
export const loadCurrentProfileId = () => {
  try {
    return localStorage.getItem(CURRENT_PROFILE_KEY);
  } catch (error) {
    console.warn('Failed to load current profile id:', error);
    return null;
  }
};

/**
 * Get the current profile object
 */
export const loadCurrentProfile = () => {
  const id = loadCurrentProfileId();
  if (!id) {
    return null;
  }
  return getProfile(id);
};

/**
 * Clear the current profile
 */
export const clearCurrentProfile = () => {
  try {
    localStorage.removeItem(CURRENT_PROFILE_KEY);
    return true;
  } catch (error) {
    console.warn('Failed to clear current profile:', error);
    return false;
  }
};
