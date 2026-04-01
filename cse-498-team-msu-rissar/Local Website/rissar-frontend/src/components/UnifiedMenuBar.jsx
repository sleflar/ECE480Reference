/**
 * Unified Menu Bar Component
 * 
 * The main application menu bar.
 * Provides access to all major application features, views, and settings.
 * 
 */
import React, { useState } from "react";
import { Check } from "lucide-react";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
  MenubarCheckboxItem,
} from "@/components/ui/menubar";

export default function UnifiedMenuBar({
  activeView,
  setActiveView,
  onOpenLayoutModal,
  onExportLayout,
  onImportLayout,
  onResetLayout,
  onConnect,
  onOpenSDCardModal,
  onOpenSFTPModal,
  onOpenSSHModal,
  onOpenTerminalManager,
  connected,
  sftpConnected,
  onDisconnectSFTP,
  onUploadBagFiles,
  onDownloadBagFiles,
  onSelectPlayback,
  onPlayReplay,
  onStopReplay,
  onColorChange,
  onResolutionChange,
  isLooping,
  onToggleLoop,
  isPlaying,
}) {
  const views = ["Two Car View", "Simple View", "Advanced View"];
  const [color, setColor] = useState(true);
  const [resolution, setResolution] = useState(true);

  const handleViewChange = (view) => {
    setActiveView(view);
  };

  const handleLayoutChange = () => {
    if (onOpenLayoutModal) {
      onOpenLayoutModal();
    }
  };

  // Handle connect button click based on current state
  const handleConnectClick = () => {
    if (connected || sftpConnected) {
      if (sftpConnected) {
        onDisconnectSFTP && onDisconnectSFTP();
      } else {
        onConnect && onConnect();
      }
    } else {
      onOpenSFTPModal && onOpenSFTPModal();
    }
  };

  // Determine label for connect button
  const getConnectLabel = () => {
    if (connected && sftpConnected) return "Disconnect";
    if (connected) return "Disconnect Vehicle";
    if (sftpConnected) return "Disconnect SFTP";
    return "Connect";
  };

  return (
    <Menubar className="border-0 bg-white text-black dark:bg-gray-950 dark:text-white">
      {/* Replay Menu - hide in Simple View */}
      {activeView !== "Simple View" && (
        <MenubarMenu>
          <MenubarTrigger>Replay</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={() => onSelectPlayback && onSelectPlayback()}>
              Select Playback
            </MenubarItem>
            <MenubarItem onClick={() => onPlayReplay && onPlayReplay()}>
              Play
            </MenubarItem>
            <MenubarItem onClick={() => onStopReplay && onStopReplay()}>
              Stop
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem
              onClick={() => {
                if (!isPlaying || isLooping) {
                  onToggleLoop && onToggleLoop();
                }
              }}
              className={`relative flex items-center justify-between pr-8 ${isPlaying && !isLooping ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              disabled={isPlaying && !isLooping}
            >
              <span>Loop</span>
              {isLooping && (
                <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                  <Check className="h-4 w-4" />
                </span>
              )}
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      )}

      {/* Car Menu - hide in Simple View */}
      {activeView !== "Simple View" && (
        <MenubarMenu>
          <MenubarTrigger>Car</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={handleConnectClick}>
              {getConnectLabel()}
            </MenubarItem>
            {sftpConnected && (
              <>
                <MenubarSeparator />
                <MenubarItem onClick={onOpenTerminalManager}>
                  Car Terminal
                </MenubarItem>
                {/* <MenubarItem onClick={onOpenSSHModal}>
                  SSH Terminal
                </MenubarItem> */}
                <MenubarItem onClick={onUploadBagFiles}>
                  Upload Bag Files
                </MenubarItem>
                <MenubarItem onClick={onDownloadBagFiles}>
                  Download Bag Files
                </MenubarItem>
                <MenubarSeparator />
              </>
            )}
            <MenubarItem onClick={() => onOpenSDCardModal && onOpenSDCardModal()}>
              SD Card Builder
            </MenubarItem>
            <MenubarItem onClick={() => {
              if (onColorChange && onColorChange(!color)) {
                setColor(!color);
              }
            }}>
              Switch Camera to {color ? "Grayscale" : "Color"}
            </MenubarItem>
            <MenubarItem onClick={() => {
              if (onResolutionChange && onResolutionChange(!resolution)) {
                setResolution(!resolution);
              }
            }}>
              Switch Camera to {resolution ? "High Resolution" : "Low Resolution"}
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      )}

      {/* Layout Menu - only show in Advanced View */}
      {activeView === "Advanced View" && (
        <MenubarMenu>
          <MenubarTrigger>Layout</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={() => onExportLayout && onExportLayout()}>
              Export
            </MenubarItem>
            <MenubarItem onClick={() => onImportLayout && onImportLayout()}>
              Import
            </MenubarItem>
            <MenubarItem onClick={() => onResetLayout && onResetLayout()}>
              Reset
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={handleLayoutChange}>Change Layout</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      )}

      {/* View Menu */}
      <MenubarMenu>
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent>
          {views.map((view) => (
            <MenubarCheckboxItem
              key={view}
              checked={activeView === view}
              onCheckedChange={() => handleViewChange(view)}
              disabled={view === "Two Car View"}
              className={view === "Two Car View" ? "opacity-50 cursor-not-allowed" : ""}
            >
              {view}
            </MenubarCheckboxItem>
          ))}
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}