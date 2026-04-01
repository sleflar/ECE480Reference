/**
 * Rosbag Download Modal Component
 * 
 * A dialog for browsing and downloading recorded ROS bag files.
 * Connects to the backend via SFTP to list and download files.
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
import { Download, Folder, File, RefreshCw } from 'lucide-react';

export default function RosbagDownloadModal({ isOpen, onClose, connectionId }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState(null);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

  // Fetch list of rosbag files from the backend
  const fetchFiles = async () => {
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
          path: '~/ros2_ws/replays/recorded'
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
      console.error('Failed to fetch rosbag files:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle file download request
  const handleDownload = async (filename) => {
    setDownloading(filename);
    setError(null);

    try {
      const response = await fetch(`${backendUrl}/api/connection/rosbag/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connection_id: connectionId,
          filename: filename,
          path: '~/ros2_ws/replays/recorded'
        }),
      });

      if (response.ok) {
        // Create a blob from the response and trigger download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.headers.get('content-disposition')?.split('filename=')[1]?.replace(/"/g, '') || filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const data = await response.json();
        setError(data.error || 'Download failed');
      }
    } catch (err) {
      setError('Download error: ' + err.message);
      console.error('Failed to download file:', err);
    } finally {
      setDownloading(null);
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  useEffect(() => {
    if (isOpen && connectionId) {
      fetchFiles();
    }
  }, [isOpen, connectionId]);

  const handleClose = () => {
    setFiles([]);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Download ROS Bag Files</DialogTitle>
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
            <p className="text-sm text-muted-foreground">
              Location: ~/ros2_ws/replays/recorded
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchFiles}
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
                            onClick={() => handleDownload(file.name)}
                            disabled={downloading === file.name}
                            className="bg-[#008208] text-white hover:bg-[#17453B]"
                          >
                            {downloading === file.name ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Downloading...
                              </>
                            ) : (
                              <>
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </>
                            )}
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
              Directories will be automatically compressed as .tar.gz files before download.
              Files will be downloaded directly.
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}