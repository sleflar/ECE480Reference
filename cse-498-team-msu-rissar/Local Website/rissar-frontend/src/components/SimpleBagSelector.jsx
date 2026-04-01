/**
 * Simple Bag Selector Component
 * 
 * A dialog for selecting ROS bag files for playback.
 * Browses files on the remote vehicle via SFTP.
 * 
 */
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Folder, File, RefreshCw } from 'lucide-react';

export default function SimpleBagSelector({ isOpen, onClose, onBagSelected, connectionId }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeFolder, setActiveFolder] = useState('recorded');

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

  // Fetch list of bag files from the backend for the selected folder
  const fetchFiles = async (folder) => {
    if (!connectionId) {
      setError('No SFTP connection');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${backendUrl}/api/connection/rosbag/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connection_id: connectionId,
          path: `~/ros2_ws/replays/${folder}`
        }),
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        setFiles(data.files || []);
      } else {
        setError(data.error || data.message || 'Failed to load files');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
      console.error('Failed to fetch bag files:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFile = (filename) => {
    const fullPath = `/home/user/ros2_ws/replays/${activeFolder}/${filename}`;
    console.log('Selected bag path:', fullPath);
    onBagSelected?.(fullPath);
    handleClose();
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  useEffect(() => {
    if (isOpen && connectionId) {
      fetchFiles(activeFolder);
    }
  }, [isOpen, connectionId, activeFolder]);

  const handleClose = () => {
    setFiles([]);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Bag File for Playback</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!connectionId && (
            <div className="p-3 text-sm rounded-md bg-yellow-950 border border-yellow-800 text-yellow-400">
              Not connected to SFTP. Please connect first.
            </div>
          )}

          {error && (
            <div className="p-3 text-sm rounded-md bg-red-950 border border-red-800 text-red-400">
              {error}
            </div>
          )}

          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button
                variant={activeFolder === 'recorded' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFolder('recorded')}
                className={activeFolder === 'recorded' ? 'bg-[#008208] hover:bg-[#17453B]' : ''}
              >
                Recorded
              </Button>
              <Button
                variant={activeFolder === 'uploaded' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFolder('uploaded')}
                className={activeFolder === 'uploaded' ? 'bg-[#008208] hover:bg-[#17453B]' : ''}
              >
                Uploaded
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchFiles(activeFolder)}
              disabled={loading || !connectionId}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <div className="border rounded-md overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Loading files...
                </div>
              ) : files.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No files found in directory
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-semibold">Name</th>
                      <th className="text-left p-3 font-semibold">Modified</th>
                      <th className="text-right p-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file, index) => (
                      <tr
                        key={index}
                        className="border-t hover:bg-muted/50 transition-colors"
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {file.is_dir ? (
                              <Folder className="h-4 w-4 text-blue-500" />
                            ) : (
                              <File className="h-4 w-4 text-gray-500" />
                            )}
                            <span className="font-mono">{file.name}</span>
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {formatDate(file.modified)}
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            onClick={() => handleSelectFile(file.name)}
                            className="bg-[#008208] text-white hover:bg-[#17453B]"
                          >
                            Select
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="space-y-1 p-3 bg-muted rounded-md">
            <p className="text-xs font-semibold">Note:</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Select a bag file or directory to play back on the vehicle.
              The selected path will be sent to the bag player node.
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            {/* <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button> */}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}