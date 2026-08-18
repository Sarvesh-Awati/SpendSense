import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Settings, Moon, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../ui/Toast';
import Avatar from './Avatar';

export const UserMenu: React.FC = () => {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
    toast('Logged out successfully', 'info');
    navigate('/login');
  };

  const menuItems = [
    { icon: User, label: 'Profile', path: '/profile' },
    { icon: Settings, label: 'Account Settings', path: '/profile' },
    { icon: Moon, label: 'Theme (Coming Soon)', path: '#', disabled: true },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 p-1 rounded-full hover:bg-slate-50 dark:hover:bg-surface-sunk transition-colors outline-none focus:ring-2 focus:ring-brand-primary/20"
        aria-label="User menu"
        aria-expanded={isOpen}
      >
        <Avatar 
          firstName={user?.firstName} 
          lastName={user?.lastName} 
          email={user?.email} 
          imageUrl={(user as any)?.profilePictureUrl} 
          size="md" 
        />
        <div className="hidden md:block text-left mr-2">
          <span className="text-sm font-semibold block text-text-primaryLight dark:text-text-primaryDark">
            {user?.firstName ? `${user.firstName}` : 'Account'}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-card-dark rounded-2xl shadow-premium dark:shadow-premium-dark border border-border-light dark:border-border-dark overflow-hidden z-50 animate-fade-in-up origin-top-right">
          {/* Header */}
          <div className="p-4 border-b border-border-light dark:border-border-dark flex items-center gap-3">
            <Avatar 
              firstName={user?.firstName} 
              lastName={user?.lastName} 
              email={user?.email} 
              imageUrl={(user as any)?.profilePictureUrl} 
              size="md" 
            />
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-text-primaryLight dark:text-text-primaryDark truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark truncate">
                {user?.email}
              </p>
            </div>
          </div>

          {/* Links */}
          <div className="p-2">
            {menuItems.map((item, index) => (
              <Link
                key={index}
                to={item.path}
                onClick={() => !item.disabled && setIsOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  item.disabled 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:bg-slate-50 dark:hover:bg-surface-sunk text-text-primaryLight dark:text-text-primaryDark'
                }`}
              >
                <item.icon className="w-4 h-4 text-text-secondaryLight dark:text-text-secondaryDark" />
                {item.label}
              </Link>
            ))}
          </div>

          {/* Footer Action */}
          <div className="p-2 border-t border-border-light dark:border-border-dark">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-finance-expense hover:bg-finance-expense/5 transition-colors text-left"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
