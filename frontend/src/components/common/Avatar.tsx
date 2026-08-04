import React, { useMemo } from 'react';

interface AvatarProps {
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ 
  firstName, 
  lastName, 
  email,
  imageUrl, 
  size = 'md',
  className = ''
}) => {
  const initials = useMemo(() => {
    if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
    if (firstName) return firstName.substring(0, 2).toUpperCase();
    if (email) return email.substring(0, 2).toUpperCase();
    return 'US';
  }, [firstName, lastName, email]);

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-24 h-24 text-3xl',
  };

  const baseClasses = `rounded-full flex items-center justify-center font-bold overflow-hidden flex-shrink-0 ${sizeClasses[size]} ${className}`;

  if (imageUrl) {
    return (
      <div className={`${baseClasses} bg-slate-100 dark:bg-slate-800`}>
        <img 
          src={imageUrl} 
          alt={`${firstName || ''} avatar`}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to initials if image fails to load
            (e.target as HTMLImageElement).style.display = 'none';
            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
          }}
        />
        <span className="hidden bg-brand-primary/10 text-brand-primary w-full h-full flex items-center justify-center">
          {initials}
        </span>
      </div>
    );
  }

  return (
    <div className={`${baseClasses} bg-brand-primary/10 text-brand-primary border border-brand-primary/20`}>
      {initials}
    </div>
  );
};

export default Avatar;
