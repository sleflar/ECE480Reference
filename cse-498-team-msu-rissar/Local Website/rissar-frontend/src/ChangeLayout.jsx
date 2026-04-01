/**
 * ChangeLayout
 * 
 * Modal component for changing the grid layout dimensions in Advanced View.
 * 
 */
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  /* DialogDescription unused */
  DialogHeader,
  DialogTitle,
} from './components/ui/dialog';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';

export default function ChangeLayout({ isOpen, onClose, onLayoutChange, currentColumns, currentRows }) {
  const [rows, setRows] = useState(currentRows || 2);
  const [columns, setColumns] = useState(currentColumns || 2);

  React.useEffect(() => {
    if (isOpen) {
      setRows(currentRows || 2);
      setColumns(currentColumns || 2);
    }
  }, [isOpen, currentRows, currentColumns]);

  const handleSave = () => {
    const layoutKey = `grid-${columns}x${rows}`;
    onLayoutChange(layoutKey, columns, rows);
    onClose();
  };

  const previewCells = Array.from({ length: rows * columns }, (_, index) => (
    <div
      key={index}
      className="rounded"
      style={{ backgroundColor: '#008934', borderWidth: '1px', borderColor: '#17453B' }}
    />
  ));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Layout</DialogTitle>
          {/* <DialogDescription unused /> */}
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Preview</h3>
            <div
              className="gap-2 p-4 rounded"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, 1fr)`,
                minHeight: '120px',
                backgroundColor: '#f0f5f4',
                borderWidth: '1px',
                borderColor: '#17453B'
              }}
            >
              {previewCells}
            </div>
          </div>

          {(rows >= 4 || columns >= 4) && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800">
                <strong>Warning:</strong> Some card components may not display correctly with grid sizes larger than 4 rows or columns.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Grid Layout</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="5"
                  value={rows}
                  onChange={(e) => setRows(parseInt(e.target.value) || 1)}
                  className="w-16"
                />
                <span className="text-sm font-medium">by</span>
                <Input
                  type="number"
                  min="1"
                  max="5"
                  value={columns}
                  onChange={(e) => setColumns(parseInt(e.target.value) || 1)}
                  className="w-16"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="bg-[#008208] text-white shadow-md hover:bg-[#17453B] focus-visible:ring-[#17453B]"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
