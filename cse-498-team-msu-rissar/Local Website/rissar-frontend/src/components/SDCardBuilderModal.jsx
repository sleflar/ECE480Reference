/**
 * SD Card Builder Modal Component
 * 
 * A placeholder modal for future SD card building functionality.
 * Currently displays a "coming soon" message.
 * 
 */
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  /* DialogDescription unused */
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function SDCardBuilderModal({ isOpen, onClose }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>SD Card Builder</DialogTitle>
          {/* <DialogDescription unused /> */}
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Build and customize the SD card configuration for the vehicle
          </p>

          <div className="p-4 bg-gray-50 rounded border border-gray-200">
            <p className="text-sm text-gray-700">
              SD Card Builder functionality coming soon
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
