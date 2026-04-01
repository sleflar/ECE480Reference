/**
 * localStorage
 * 
 * localStorage utility functions for state persistence
 * 
 */

const STORAGE_KEYS = {
  ACTIVE_VIEW: 'rissar_active_view',
  GRID_LAYOUT: 'rissar_grid_layout',
  CARD_CONFIGURATIONS: 'rissar_card_configurations'
};

/**
 * Save data to localStorage with error handling
 * @param {string} key - Storage key
 * @param {any} data - Data to save
 * @returns {boolean} Success status
 */
export const saveToLocalStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.warn('Failed to save to localStorage:', error);
    return false;
  }
};

/**
 * Load data from localStorage with error handling
 * @param {string} key - Storage key
 * @param {any} defaultValue - Default value if key doesn't exist
 * @returns {any} Loaded data or default value
 */
export const loadFromLocalStorage = (key, defaultValue = null) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn('Failed to load from localStorage:', error);
    return defaultValue;
  }
};

/**
 * Remove data from localStorage
 * @param {string} key - Storage key
 */
export const removeFromLocalStorage = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('Failed to remove from localStorage:', error);
  }
};

// specific state management functions
export const saveActiveView = (view) => {
  return saveToLocalStorage(STORAGE_KEYS.ACTIVE_VIEW, view);
};

// Load active view
export const loadActiveView = () => {
  return loadFromLocalStorage(STORAGE_KEYS.ACTIVE_VIEW, 'Simple View');
};

// Save grid layout configuration
export const saveGridLayout = (gridData) => {
  return saveToLocalStorage(STORAGE_KEYS.GRID_LAYOUT, gridData);
};

// Load grid layout configuration
export const loadGridLayout = () => {
  return loadFromLocalStorage(STORAGE_KEYS.GRID_LAYOUT, {
    columns: 2,
    rows: 2
  });
};

// Save card configurations (which component in which slot)
export const saveCardConfigurations = (cardConfigs) => {
  return saveToLocalStorage(STORAGE_KEYS.CARD_CONFIGURATIONS, cardConfigs);
};

// Load card configurations
export const loadCardConfigurations = () => {
  return loadFromLocalStorage(STORAGE_KEYS.CARD_CONFIGURATIONS, {});
};