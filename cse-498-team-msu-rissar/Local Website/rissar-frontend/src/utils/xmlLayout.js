/**
 * xmlLayout
 * 
 * XML utility functions for layout export/import
 * 
 */

/**
 * Exports layout configuration to XML format
 * @param {number} columns - Number of grid columns
 * @param {number} rows - Number of grid rows
 * @param {Object} cardConfigurations - Card configuration object
 * @returns {string} XML string
 */
export const exportLayoutToXML = (columns, rows, cardConfigurations) => {
  const timestamp = new Date().toISOString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<LayoutConfiguration version="1.0" exported="${timestamp}">\n`;
  xml += `  <Grid>\n`;
  xml += `    <Columns>${columns}</Columns>\n`;
  xml += `    <Rows>${rows}</Rows>\n`;
  xml += `  </Grid>\n`;
  xml += `  <Cards>\n`;

  Object.entries(cardConfigurations).forEach(([index, value]) => {
    xml += `    <Card index="${index}" type="${value}" />\n`;
  });

  xml += `  </Cards>\n`;
  xml += `</LayoutConfiguration>`;

  return xml;
};

/**
 * Downloads XML content as a file
 * @param {string} xmlContent - XML content to download
 * @param {string} filename - Filename for the download
 */
export const downloadXMLFile = (xmlContent, filename = 'layout-config.xml') => {
  try {
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return { success: true };
  } catch (error) {
    console.error('Failed to download XML file:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Parses XML string to extract layout configuration
 * @param {string} xmlContent - XML content to parse
 * @returns {Object} Parsed configuration or error object
 */
export const importLayoutFromXML = (xmlContent) => {
  try {
    // Create a DOM parser
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');

    // Check for XML parsing errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      throw new Error('Invalid XML format');
    }

    // Check for root element
    const root = xmlDoc.querySelector('LayoutConfiguration');
    if (!root) {
      throw new Error('Invalid layout configuration file - missing LayoutConfiguration root element');
    }

    // Extract grid configuration
    const gridElement = root.querySelector('Grid');
    if (!gridElement) {
      throw new Error('Invalid layout configuration - missing Grid element');
    }

    const columnsElement = gridElement.querySelector('Columns');
    const rowsElement = gridElement.querySelector('Rows');

    if (!columnsElement || !rowsElement) {
      throw new Error('Invalid layout configuration - missing Columns or Rows elements');
    }

    const columns = parseInt(columnsElement.textContent);
    const rows = parseInt(rowsElement.textContent);

    if (isNaN(columns) || isNaN(rows) || columns < 1 || rows < 1 || columns > 5 || rows > 5) {
      throw new Error('Invalid grid dimensions - columns and rows must be numbers between 1 and 5');
    }

    // Extract card configurations
    const cardsElement = root.querySelector('Cards');
    if (!cardsElement) {
      throw new Error('Invalid layout configuration - missing Cards element');
    }

    const cardElements = cardsElement.querySelectorAll('Card');
    const cardConfigurations = {};

    cardElements.forEach(cardElement => {
      const index = cardElement.getAttribute('index');
      const type = cardElement.getAttribute('type');

      if (index === null || type === null) {
        throw new Error('Invalid card configuration - missing index or type attribute');
      }

      const indexNum = parseInt(index);
      if (isNaN(indexNum) || indexNum < 0) {
        throw new Error('Invalid card index - must be a non-negative number');
      }

      // Validate card type
      const validTypes = [
        'None', 'LiveFeed', 'LiDar', 'GNSS', 'GNSS_chart', 'OnlineMap', 'OfflineMap',
        'IMU', 'IMU_chart', 'BrakeThrottle', 'SteerAngle', 'SpeedRuntime', '3dlidar', 'Joystick'
      ];

      if (!validTypes.includes(type)) {
        throw new Error(`Invalid card type: ${type}`);
      }

      cardConfigurations[index] = type;
    });

    return {
      success: true,
      data: {
        columns,
        rows,
        cardConfigurations
      }
    };

  } catch (error) {
    console.error('Failed to parse XML:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Reads file content from a File object
 * @param {File} file - File object to read
 * @returns {Promise<string>} File content as string
 */
export const readFileContent = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided'));
      return;
    }

    if (!file.type.includes('xml') && !file.name.toLowerCase().endsWith('.xml')) {
      reject(new Error('Please select an XML file'));
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      resolve(event.target.result);
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
};