/**
 * Terminal Sheet Component
 * 
 * A slide-up sheet containing the TerminalPanel.
 * Provides a collapsible interface for accessing the terminal.
 * 
 */
import React from 'react';
import TerminalPanel from './TerminalPanel';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export default function TerminalSheet({ isOpen, onClose, connectionId, isConnected }) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[600px] sm:max-w-none border-t border-border bg-background shadow-lg p-0 gap-0">
        <div className="h-full overflow-hidden">
          {/* Render TerminalPanel inside the sheet */}
          <TerminalPanel
            connectionId={connectionId}
            isConnected={isConnected}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
