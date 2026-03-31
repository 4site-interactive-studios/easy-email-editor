import React, { useState } from 'react';
import { UserPresence, ANIMALS, COLORS } from '@demo/utils/user-identity';

interface AvatarBarProps {
  currentUser: UserPresence;
  roomUsers: UserPresence[];
  connected: boolean;
  onUpdateIdentity: (animal: string, colorHex: string) => void;
}

export function AvatarBar({ currentUser, roomUsers, connected, onUpdateIdentity }: AvatarBarProps) {
  const [showCustomizer, setShowCustomizer] = useState(false);

  if (!connected) return null;

  return (
    <div className='relative flex items-center gap-1'>
      {roomUsers.map(user => {
        const isMe = user.userId === currentUser.userId;
        return (
          <div
            key={user.userId}
            className='relative group'
            onClick={isMe ? () => setShowCustomizer(v => !v) : undefined}
            style={{ cursor: isMe ? 'pointer' : 'default' }}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-transform hover:scale-110 ${
                isMe ? 'ring-2 ring-offset-1 ring-gray-400' : ''
              }`}
              style={{ backgroundColor: user.color }}
              title={user.name + (isMe ? ' (you)' : '')}
            >
              {user.emoji}
            </div>
            {/* Tooltip */}
            <span className='pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2 py-0.5 text-[10px] font-medium text-white bg-gray-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50'>
              {user.name}{isMe ? ' (you)' : ''}
            </span>
          </div>
        );
      })}

      {/* Customizer popover */}
      {showCustomizer && (
        <>
          <div className='fixed inset-0 z-40' onClick={() => setShowCustomizer(false)} />
          <div className='absolute left-0 top-full mt-2 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-[280px]'>
            <p className='text-sm font-semibold text-gray-800 mb-3'>Customize your avatar</p>

            {/* Animals */}
            <p className='text-xs font-medium text-gray-500 mb-1.5'>Animal</p>
            <div className='grid grid-cols-8 gap-1 mb-3'>
              {ANIMALS.map(a => (
                <button
                  key={a.name}
                  className={`w-7 h-7 rounded flex items-center justify-center text-sm transition-colors ${
                    currentUser.animal === a.name
                      ? 'bg-blue-100 ring-2 ring-blue-500'
                      : 'hover:bg-gray-100'
                  }`}
                  title={a.name}
                  onClick={() => onUpdateIdentity(a.name, currentUser.color)}
                >
                  {a.emoji}
                </button>
              ))}
            </div>

            {/* Colors */}
            <p className='text-xs font-medium text-gray-500 mb-1.5'>Color</p>
            <div className='grid grid-cols-6 gap-1.5'>
              {COLORS.map(c => (
                <button
                  key={c.hex}
                  className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${
                    currentUser.color === c.hex
                      ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                      : ''
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                  onClick={() => onUpdateIdentity(currentUser.animal, c.hex)}
                />
              ))}
            </div>

            <p className='text-xs text-gray-400 mt-3 text-center'>
              You are <strong>{currentUser.name}</strong>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
