/**
 * SFTP Connection Modal Component
 * 
 * A dialog for managing SFTP connections.
 * Allows connecting to a remote server and saving/loading connection profiles.
 * 
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  loadProfiles,
  addProfile,
  deleteProfile,
  setCurrentProfile,
  loadCurrentProfile,
} from '../utils/sftpProfiles';

export default function SFTPConnectionModal({ isOpen, onClose, onConnect }) {
  const [mode, setMode] = useState('connect');
  const [profiles, setProfiles] = useState([]);
  const [currentProfile, setCurrentProfileLocal] = useState(null);

  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [profileName, setProfileName] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      const savedProfiles = loadProfiles();
      setProfiles(savedProfiles);

      const current = loadCurrentProfile();
      if (current) {
        setCurrentProfileLocal(current);
        setHost(current.host);
        setPort(current.port.toString());
        setUsername(current.username);
        setPassword(current.password);
      } else {
        setCurrentProfileLocal(null);
        setHost('');
        setPort('22');
        setUsername('');
        setPassword('');
      }

      setError('');
      setMode('connect');
      setProfileName('');
    }
  }, [isOpen]);

  // Handle form submission for connection
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!host || !username || !password) {
      setError('Host, username, and password are required');
      return;
    }

    setConnecting(true);

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
      // Initiate SFTP connection via backend
      const response = await fetch(`${backendUrl}/api/connection/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          host,
          port: parseInt(port),
          username,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('sftp_connection_id', data.connection_id);

        if (currentProfile) {
          setCurrentProfile(currentProfile.id);
        }

        if (onConnect) {
          onConnect(data);
        }
        handleClose();
      } else {
        setError(data.error || 'Connection failed');
      }
    } catch (err) {
      setError('Network error. Please check if the backend is running.');
    } finally {
      setConnecting(false);
    }
  };

  // Save current connection details as a profile
  const handleSaveProfile = () => {
    const trimmedName = profileName.trim();

    if (!trimmedName) {
      setError('Please enter a profile name');
      return;
    }

    if (!host || !username || !password) {
      setError('Host, username, and password are required');
      return;
    }

    const newProfile = addProfile(
      trimmedName,
      host,
      parseInt(port, 10),
      username,
      password
    );

    const updated = loadProfiles();
    setProfiles(updated);
    setCurrentProfileLocal(newProfile);
    setProfileName('');
    setMode('connect');
    setError('');
  };

  const handleDeleteProfile = (profileId) => {
    deleteProfile(profileId);
    const updated = loadProfiles();
    setProfiles(updated);

    if (currentProfile?.id === profileId) {
      setCurrentProfileLocal(null);
      setHost('');
      setPort('22');
      setUsername('');
      setPassword('');
    }
  };

  const handleSelectProfile = (profile) => {
    setCurrentProfileLocal(profile);
    setHost(profile.host);
    setPort(profile.port.toString());
    setUsername(profile.username);
    setPassword(profile.password);
    setError('');
  };

  const handleClose = () => {
    setHost('');
    setPort('22');
    setUsername('');
    setPassword('');
    setError('');
    setConnecting(false);
    setMode('connect');
    setProfileName('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'connect' ? 'SFTP Connection' : 'Save SFTP Profile'}
          </DialogTitle>
        </DialogHeader>

        {mode === 'connect' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {profiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Saved Profiles</label>
                  <span className="text-xs text-muted-foreground">{profiles.length} profile{profiles.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-border rounded p-3 bg-muted/30">
                  {profiles.map((profile) => (
                    <div
                      key={profile.id}
                      className={`flex items-center justify-between p-3 rounded transition-all cursor-pointer ${currentProfile?.id === profile.id
                        ? 'bg-primary text-primary-foreground ring-2 ring-primary'
                        : 'bg-card hover:bg-accent/10 border border-border'
                        }`}
                      onClick={() => handleSelectProfile(profile)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{profile.name}</div>
                        <div className={`text-xs truncate ${currentProfile?.id === profile.id
                          ? 'text-primary-foreground/80'
                          : 'text-muted-foreground'
                          }`}>
                          {profile.host}:{profile.port}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProfile(profile.id);
                        }}
                        className="ml-3 text-xs px-2 py-1 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors flex-shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 text-sm text-destructive-foreground bg-destructive border border-destructive rounded">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="sftp-host">Host / IP Address</Label>
                <Input
                  id="sftp-host"
                  type="text"
                  value={host}
                  onChange={(e) => {
                    setHost(e.target.value);
                    setError('');
                  }}
                  placeholder="192.168.1.100"
                  disabled={connecting}
                  className="placeholder:text-muted-foreground/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sftp-port">Port</Label>
                <Input
                  id="sftp-port"
                  type="number"
                  value={port}
                  onChange={(e) => {
                    setPort(e.target.value);
                    setError('');
                  }}
                  placeholder="22"
                  disabled={connecting}
                  className="placeholder:text-muted-foreground/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sftp-username">Username</Label>
                <Input
                  id="sftp-username"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError('');
                  }}
                  placeholder="username"
                  disabled={connecting}
                  autoComplete="username"
                  className="placeholder:text-muted-foreground/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sftp-password">Password</Label>
                <Input
                  id="sftp-password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="password"
                  disabled={connecting}
                  autoComplete="current-password"
                  className="placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMode('save')}
                disabled={connecting}
              >
                Save Profile
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={connecting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={connecting}
                style={{
                  backgroundColor: 'var(--accent-green)',
                  color: 'var(--brand-white)',
                }}
              >
                {connecting ? 'Connecting...' : 'Connect'}
              </Button>
            </div>
          </form>
        )}

        {mode === 'save' && (
          <form onSubmit={(e) => { e.preventDefault(); handleSaveProfile(); }} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive-foreground bg-destructive border border-destructive rounded">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="profile-name">Profile Name</Label>
              <Input
                id="profile-name"
                type="text"
                value={profileName}
                onChange={(e) => {
                  setProfileName(e.target.value);
                  setError('');
                }}
                placeholder="My SFTP Server"
                className="placeholder:text-muted-foreground/50"
              />
            </div>

            <div className="space-y-2">
              <Label>Host</Label>
              <div className="text-sm bg-muted p-2 rounded">{host || 'Not set'}</div>
            </div>

            <div className="space-y-2">
              <Label>Port</Label>
              <div className="text-sm bg-muted p-2 rounded">{port}</div>
            </div>

            {username && (
              <div className="space-y-2">
                <Label>Username</Label>
                <div className="text-sm bg-muted p-2 rounded">{username}</div>
              </div>
            )}

            {password && (
              <div className="space-y-2">
                <Label>Password</Label>
                <div className="text-sm bg-muted p-2 rounded">{'•'.repeat(password.length)}</div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMode('connect')}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveProfile}
                style={{
                  backgroundColor: 'var(--accent-green)',
                  color: 'var(--brand-white)',
                }}
              >
                Save
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
