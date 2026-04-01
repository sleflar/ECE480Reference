/**
 * Connection Dialog Component
 * 
 * A dialog for managing ROS bridge connections.
 * Allows connecting to a specific IP/port and saving/loading connection profiles.
 * 
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  loadProfiles,
  addProfile,
  deleteProfile,
  setCurrentProfile,
  loadCurrentProfile,
} from '../utils/carProfiles';

export default function ConnectionDialog({ isOpen, onClose, onConnect }) {
  const [mode, setMode] = useState('connect');
  const [profiles, setProfiles] = useState([]);
  const [currentProfile, setCurrentProfileLocal] = useState(null);

  const [ip, setIp] = useState('');
  const [port, setPort] = useState('9090');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [profileName, setProfileName] = useState('');
  const [error, setError] = useState('');

  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const savedProfiles = loadProfiles();
      setProfiles(savedProfiles);

      const current = loadCurrentProfile();
      if (current) {
        setCurrentProfileLocal(current);
        setIp(current.ip);
        setPort(current.port.toString());
        setUsername(current.username);
        setPassword(current.password);
      } else {
        setCurrentProfileLocal(null);
        setIp('');
        setPort('9090');
        setUsername('');
        setPassword('');
      }

      setError('');
      setMode('connect');
      setProfileName('');

      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleInputChange = (e) => {
    setIp(e.target.value);
    setError('');
  };

  const handlePortChange = (e) => {
    setPort(e.target.value);
    setError('');
  };

  const handleUsernameChange = (e) => {
    setUsername(e.target.value);
    setError('');
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    setError('');
  };

  const handleProfileNameChange = (e) => {
    setProfileName(e.target.value);
    setError('');
  };

  // Validate IP address format
  const isValidIP = (ipAddress) => {
    const re = /^((25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)$/;
    return re.test(ipAddress);
  };

  // Validate Port number range
  const isValidPort = (portNum) => {
    const num = parseInt(portNum, 10);
    return num > 0 && num <= 65535;
  };

  // Handle connection attempt
  const handleConnect = () => {
    const trimmedIp = ip.trim();

    if (!trimmedIp) {
      setError('Please enter an IP address');
      return;
    }

    if (!isValidIP(trimmedIp)) {
      setError('Invalid IP address format');
      return;
    }

    if (!isValidPort(port)) {
      setError('Port must be between 1 and 65535');
      return;
    }

    onConnect(trimmedIp);

    if (currentProfile) {
      setCurrentProfile(currentProfile.id);
    }

    onClose();
  };

  // Save current connection settings as a profile
  const handleSaveProfile = () => {
    const trimmedIp = ip.trim();
    const trimmedName = profileName.trim();

    if (!trimmedName) {
      setError('Please enter a profile name');
      return;
    }

    if (!trimmedIp) {
      setError('Please enter an IP address');
      return;
    }

    if (!isValidIP(trimmedIp)) {
      setError('Invalid IP address format');
      return;
    }

    if (!isValidPort(port)) {
      setError('Port must be between 1 and 65535');
      return;
    }

    const newProfile = addProfile(
      trimmedName,
      trimmedIp,
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
      setIp('');
      setPort('9090');
      setUsername('');
      setPassword('');
    }
  };

  const handleSelectProfile = (profile) => {
    setCurrentProfileLocal(profile);
    setIp(profile.ip);
    setPort(profile.port.toString());
    setUsername(profile.username);
    setPassword(profile.password);
    setMode('connect');
    setError('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (mode === 'connect') {
        handleConnect();
      } else if (mode === 'save') {
        handleSaveProfile();
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-96 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'connect' ? 'Connect to Car' : 'Save Connection Profile'}
          </DialogTitle>
        </DialogHeader>

        {mode === 'connect' && (
          <div className="space-y-4">
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
                          {profile.ip}:{profile.port}
                        </div>
                      </div>
                      <button
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

            <div className="space-y-3">
              <div className="space-y-2">
                <label htmlFor="car-ip" className="text-sm font-medium">
                  IP Address
                </label>
                <Input
                  ref={inputRef}
                  id="car-ip"
                  type="text"
                  value={ip}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="192.168.8.4"
                  className="placeholder:text-muted-foreground/50"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="car-port" className="text-sm font-medium">
                  Port
                </label>
                <Input
                  id="car-port"
                  type="number"
                  value={port}
                  onChange={handlePortChange}
                  onKeyDown={handleKeyDown}
                  placeholder="9090"
                  className="placeholder:text-muted-foreground/50"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="car-username" className="text-sm font-medium">
                  Username (optional)
                </label>
                <Input
                  id="car-username"
                  type="text"
                  value={username}
                  onChange={handleUsernameChange}
                  onKeyDown={handleKeyDown}
                  placeholder="user"
                  className="placeholder:text-muted-foreground/50"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="car-password" className="text-sm font-medium">
                  Password (optional)
                </label>
                <Input
                  id="car-password"
                  type="password"
                  value={password}
                  onChange={handlePasswordChange}
                  onKeyDown={handleKeyDown}
                  placeholder="password"
                  className="placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-3 justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => setMode('save')}
                className="px-4 py-2"
              >
                Save Profile
              </Button>
              <Button
                variant="outline"
                onClick={onClose}
                className="px-4 py-2"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConnect}
                className="px-4 py-2"
                style={{
                  backgroundColor: 'var(--accent-green)',
                  color: 'var(--brand-white)',
                }}
              >
                Connect
              </Button>
            </div>
          </div>
        )}

        {mode === 'save' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="profile-name" className="text-sm font-medium">
                Profile Name
              </label>
              <Input
                ref={inputRef}
                id="profile-name"
                type="text"
                value={profileName}
                onChange={handleProfileNameChange}
                onKeyDown={handleKeyDown}
                placeholder="My Car"
                className="placeholder:text-muted-foreground/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">IP Address</label>
              <div className="text-sm bg-muted p-2 rounded">{ip || 'Not set'}</div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Port</label>
              <div className="text-sm bg-muted p-2 rounded">{port}</div>
            </div>

            {username && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Username</label>
                <div className="text-sm bg-muted p-2 rounded">{username}</div>
              </div>
            )}

            {password && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <div className="text-sm bg-muted p-2 rounded">{'•'.repeat(password.length)}</div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-3 justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => setMode('connect')}
                className="px-4 py-2"
              >
                Back
              </Button>
              <Button
                onClick={onClose}
                className="px-4 py-2"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveProfile}
                className="px-4 py-2"
                style={{
                  backgroundColor: 'var(--accent-green)',
                  color: 'var(--brand-white)',
                }}
              >
                Save
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
