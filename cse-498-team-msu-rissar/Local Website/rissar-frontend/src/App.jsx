/**
 * App
 * 
 * Main application component.
 * Handles top-level state, routing between views (Simple, Advanced, Two Car), and global providers.
 * 
 */
import React, { useState, useEffect } from "react";
import TopHeader from "./TopHeader";
import SimpleView from "./SimpleView";
import TwoCarView from "./TwoCarView";
import AdvancedView from "./AdvancedView";
import TestPage from "./TestPage";
import ChangeLayout from "./ChangeLayout";
import { saveActiveView, loadActiveView, saveGridLayout, loadGridLayout, saveCardConfigurations, loadCardConfigurations } from "./utils/localStorage";
import { exportLayoutToXML, downloadXMLFile, importLayoutFromXML, readFileContent } from "./utils/xmlLayout";
import { ROSProvider } from "./utils/ROSContext";
import { DarkModeProvider } from "./utils/DarkModeContext";
import { ReplayProvider } from './utils/ReplayContext';
import { FullscreenProvider } from './utils/FullscreenContext';
import { useTerminalSocket } from "./hooks/useTerminalSocket";
import "./App.css";

export default function App() {
  useTerminalSocket();

  // load initial state from localStorage
  // active view determines which dashboard mode is shown (Simple, Two Car, Advanced, Test)
  const [activeView, setActiveView] = useState(() => loadActiveView());

  // layout modal state management
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const [isAnyModalOpen, setIsAnyModalOpen] = useState(false);

  // initialize grid dimensions from local storage or defaults
  const [gridColumns, setGridColumns] = useState(() => {
    const saved = loadGridLayout();
    return saved.columns;
  });
  const [gridRows, setGridRows] = useState(() => {
    const saved = loadGridLayout();
    return saved.rows;
  });

  // card configurations state management
  // maps grid indices to component names (e.g., { 0: "LiveFeed", 1: "None" })
  const [cardConfigurations, setCardConfigurations] = useState(() => {
    const saved = loadCardConfigurations();
    const cardCount = (loadGridLayout().columns || 2) * (loadGridLayout().rows || 2);
    const defaultConfig = {};
    // ensure all grid slots have a default configuration
    for (let i = 0; i < cardCount; i++) {
      defaultConfig[i] = saved[i] || (i === 0 ? "LiveFeed" : "None");
    }
    return defaultConfig;
  });

  // save activeView to localStorage whenever it changes
  useEffect(() => {
    saveActiveView(activeView);
  }, [activeView]);

  // save grid layout to localStorage whenever it changes
  useEffect(() => {
    saveGridLayout({ columns: gridColumns, rows: gridRows });
  }, [gridColumns, gridRows]);

  // save card configurations to localStorage whenever they change
  useEffect(() => {
    saveCardConfigurations(cardConfigurations);
  }, [cardConfigurations]);

  // update card configurations when grid size changes
  // ensures that new slots are initialized and removed slots are cleaned up
  useEffect(() => {
    const cardCount = gridColumns * gridRows;
    setCardConfigurations(prevConfig => {
      const newConfig = { ...prevConfig };
      // add new cards with "None" value if grid expanded
      for (let i = 0; i < cardCount; i++) {
        if (!(i in newConfig)) {
          newConfig[i] = i === 0 ? "LiveFeed" : "None";
        }
      }
      // remove configurations for cards that no longer exist
      Object.keys(newConfig).forEach(key => {
        const index = parseInt(key);
        if (index >= cardCount) {
          delete newConfig[index];
        }
      });
      return newConfig;
    });
  }, [gridColumns, gridRows]);

  const handleLayoutChange = (layoutKey, columns, rows) => {
    setGridColumns(columns);
    setGridRows(rows);
  };

  const handleCardConfigChange = (index, value) => {
    setCardConfigurations(prev => ({
      ...prev,
      [index]: value
    }));
  };

  const openLayoutModal = () => {
    setIsLayoutModalOpen(true);
    setIsAnyModalOpen(true);
  };

  const closeLayoutModal = () => {
    setIsLayoutModalOpen(false);
    setIsAnyModalOpen(false);
  };

  // export Layout functionality
  // serializes current layout state to XML and triggers download
  const handleExportLayout = () => {
    try {
      const xmlContent = exportLayoutToXML(gridColumns, gridRows, cardConfigurations);
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `dashboard-layout-${timestamp}.xml`;

      const result = downloadXMLFile(xmlContent, filename);
      if (!result.success) {
        alert('Failed to export layout: ' + result.error);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export layout. Please try again.');
    }
  };

  // import Layout functionality
  // reads XML file, parses it, and updates application state
  const handleImportLayout = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml,application/xml';

    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      try {
        const content = await readFileContent(file);
        const result = importLayoutFromXML(content);

        if (result.success) {
          // update grid layout
          setGridColumns(result.data.columns);
          setGridRows(result.data.rows);

          // update card configurations directly
          setCardConfigurations(result.data.cardConfigurations);

          alert('Layout imported successfully!');
        } else {
          alert('Import failed: ' + result.error);
        }
      } catch (error) {
        console.error('Import error:', error);
        alert('Failed to import layout: ' + error.message);
      }
    };

    input.click();
  };

  // reset layout to 2x2, first two cards LiveFeed and OnlineMap, others None
  const handleResetLayout = () => {
    setGridColumns(2);
    setGridRows(2);
    setCardConfigurations({
      0: "LiveFeed",
      1: "OnlineMap",
      2: "None",
      3: "None"
    });
  };

  // handles uploading ROS bag files to the connected vehicle via SFTP
  const handleUploadBagFiles = () => {
    const connectionId = localStorage.getItem('sftp_connection_id');

    if (!connectionId) {
      alert('Please connect to SFTP server first (File > Connect to Server)');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.db3,.mcap';

    input.onchange = async (event) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

        for (const file of files) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('connection_id', connectionId);
          formData.append('remote_path', `/home/user/ros2_ws/replays/uploaded/${file.name}`);

          const uploadResponse = await fetch(`${backendUrl}/api/connection/upload`, {
            method: 'POST',
            body: formData,
          });

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(`Failed to upload ${file.name}: ${errorData.error || 'Unknown error'}`);
          }
        }

        alert(`Successfully uploaded ${files.length} file(s)`);
      } catch (error) {
        console.error('Upload error:', error);
        alert(`Failed to upload files: ${error.message}`);
      }
    };

    input.click();
  };


  const renderView = () => {
    switch (activeView) {
      case "Simple View":
        return <SimpleView />;
      case "Two Car View":
        return <TwoCarView />;
      case "Advanced View":
        return (
          <AdvancedView
            gridColumns={gridColumns}
            gridRows={gridRows}
            cardConfigurations={cardConfigurations}
            onCardConfigChange={handleCardConfigChange}
          />
        );
      case "Test Page":
        return <TestPage />;
      default:
        return null;
    }
  };

  const handleTopHeaderModalStateChange = (isAnyModalOpen) => {
    setIsAnyModalOpen(isAnyModalOpen);
  };

  return (
    <DarkModeProvider>
      <ROSProvider>
        <FullscreenProvider>
          <div className="app-container" data-dialog-visible={isLayoutModalOpen || isAnyModalOpen}>
            <ReplayProvider>
              <TopHeader
                activeView={activeView}
                setActiveView={setActiveView}
                onOpenLayoutModal={openLayoutModal}
                onExportLayout={handleExportLayout}
                onImportLayout={handleImportLayout}
                onResetLayout={handleResetLayout}
                onUploadBagFiles={handleUploadBagFiles}
                onModalStateChange={handleTopHeaderModalStateChange}
              />
              {renderView()}

              {activeView === "Advanced View" && (
                <ChangeLayout
                  isOpen={isLayoutModalOpen}
                  onClose={closeLayoutModal}
                  currentColumns={gridColumns}
                  currentRows={gridRows}
                  onLayoutChange={handleLayoutChange}
                />
              )}
            </ReplayProvider>
          </div>
        </FullscreenProvider>
      </ROSProvider>
    </DarkModeProvider>
  );
}